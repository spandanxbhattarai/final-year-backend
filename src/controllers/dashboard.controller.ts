import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const getTodayRange = () => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const todayStart = new Date(`${todayStr}T00:00:00.000Z`);
  const todayEnd = new Date(`${todayStr}T23:59:59.999Z`);

  const yesterday = new Date(now);
  yesterday.setUTCDate(now.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const yesterdayStart = new Date(`${yesterdayStr}T00:00:00.000Z`);
  const yesterdayEnd = new Date(`${yesterdayStr}T23:59:59.999Z`);

  const lastWeek = new Date(now);
  lastWeek.setUTCDate(now.getUTCDate() - 7);
  const lastWeekStr = lastWeek.toISOString().split('T')[0];
  const lastWeekStart = new Date(`${lastWeekStr}T00:00:00.000Z`);
  const lastWeekEnd = new Date(`${lastWeekStr}T23:59:59.999Z`);

  return { todayStr, yesterdayStr, todayStart, todayEnd, yesterdayStart, yesterdayEnd, lastWeekStart, lastWeekEnd };
};

export const getDashboardStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { todayStr, yesterdayStr, todayStart, todayEnd, yesterdayStart, yesterdayEnd, lastWeekStart, lastWeekEnd } = getTodayRange();

    const [
      todayBookings,
      yesterdayBookings,
      todayOrders,
      yesterdayOrders,
      todayRevenueAgg,
      lastWeekRevenueAgg,
      todayCalls,
    ] = await Promise.all([
      prisma.reservation.count({ where: { date: todayStr } }),
      prisma.reservation.count({ where: { date: yesterdayStr } }),
      prisma.order.count({ where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { not: 'CANCELLED' } } }),
      prisma.order.count({ where: { createdAt: { gte: yesterdayStart, lte: yesterdayEnd }, status: { not: 'CANCELLED' } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: lastWeekStart, lte: lastWeekEnd }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
      prisma.callLog.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
    ]);

    const todayRevenue = todayRevenueAgg._sum.total ?? 0;
    const lastWeekRevenue = lastWeekRevenueAgg._sum.total ?? 0;

    const bookingDiff = todayBookings - yesterdayBookings;
    const orderDiff = todayOrders - yesterdayOrders;
    const revenueDiff = lastWeekRevenue > 0
      ? Math.round(((todayRevenue - lastWeekRevenue) / lastWeekRevenue) * 100)
      : null;

    res.json({
      todayBookings,
      todayOrders,
      todayRevenue,
      todayCalls,
      trends: {
        bookings: { diff: bookingDiff, label: bookingDiff >= 0 ? `+${bookingDiff} from yesterday` : `${bookingDiff} from yesterday` },
        orders: { diff: orderDiff, label: orderDiff >= 0 ? `+${orderDiff} from yesterday` : `${orderDiff} from yesterday` },
        revenue: revenueDiff !== null
          ? { diff: revenueDiff, label: revenueDiff >= 0 ? `+${revenueDiff}% from last week` : `${revenueDiff}% from last week` }
          : null,
        calls: null,
      },
    });
  } catch {
    res.status(500).json({ message: 'Failed to fetch dashboard stats' });
  }
};

export const getRevenueData = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const orders = await prisma.order.findMany({
      where: {
        date: { in: last7Days },
        status: { not: 'CANCELLED' },
      },
      select: { date: true, total: true },
    });

    const revenueMap: Record<string, number> = Object.fromEntries(last7Days.map(d => [d, 0]));
    orders.forEach(o => {
      if (revenueMap[o.date] !== undefined) revenueMap[o.date] += o.total;
    });

    const revenueData = last7Days.map(dateStr => {
      const date = new Date(dateStr + 'T12:00:00Z');
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      return { date: dayName, revenue: Math.round(revenueMap[dateStr] * 100) / 100 };
    });

    res.json(revenueData);
  } catch {
    res.status(500).json({ message: 'Failed to fetch revenue data' });
  }
};

export const getTopItems = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const topItems = await prisma.orderItem.groupBy({
      by: ['menuItemId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    const menuItemIds = topItems.map(item => item.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, name: true },
    });

    const menuItemMap = Object.fromEntries(menuItems.map(m => [m.id, m.name]));
    const result = topItems.map(item => ({
      name: menuItemMap[item.menuItemId] || 'Unknown',
      orders: item._sum.quantity ?? 0,
    }));

    res.json(result);
  } catch {
    res.status(500).json({ message: 'Failed to fetch top items' });
  }
};

export const getTodayReservations = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const reservations = await prisma.reservation.findMany({
      where: { date: todayStr },
      orderBy: { time: 'asc' },
    });
    res.json(reservations);
  } catch {
    res.status(500).json({ message: 'Failed to fetch today\'s reservations' });
  }
};

export const getRecentActivity = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [recentOrders, recentReservations, recentCalls] = await Promise.all([
      prisma.order.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, customerName: true, createdAt: true, status: true } }),
      prisma.reservation.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, customerName: true, createdAt: true } }),
      prisma.callLog.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, callerName: true, createdAt: true } }),
    ]);

    const activity = [
      ...recentOrders.map(o => ({
        id: `order-${o.id}`,
        type: 'order' as const,
        message: `New order from ${o.customerName}`,
        createdAt: o.createdAt.toISOString(),
      })),
      ...recentReservations.map(r => ({
        id: `reservation-${r.id}`,
        type: 'reservation' as const,
        message: `Reservation for ${r.customerName}`,
        createdAt: r.createdAt.toISOString(),
      })),
      ...recentCalls.map(c => ({
        id: `call-${c.id}`,
        type: 'call' as const,
        message: `Call from ${c.callerName}`,
        createdAt: c.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 15);

    res.json(activity);
  } catch {
    res.status(500).json({ message: 'Failed to fetch recent activity' });
  }
};

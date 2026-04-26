import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getIO } from '../lib/socket';

export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, date } = req.query;
    const where: any = {};
    if (status) where.status = status;

    // Default to today's orders unless a specific date is provided
    const todayStr = new Date().toISOString().slice(0, 10);
    where.date = (date as string) || todayStr;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        table: true,
        items: { include: { menuItem: true } },
      },
    });
    res.json(orders);
  } catch {
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

export const getOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        table: true,
        items: { include: { menuItem: true } },
      },
    });
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    res.json(order);
  } catch {
    res.status(500).json({ message: 'Failed to fetch order' });
  }
};

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tableId, customerName, items, prepareBy } = req.body;

    // Fetch menu item prices to calculate total
    const menuItemIds = items.map((i: any) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
    });

    const priceMap = new Map<number, number>(menuItems.map((m: any) => [m.id, m.price]));

    let total = 0;
    const orderItems = items.map((item: any) => {
      const price: number = priceMap.get(item.menuItemId) || 0;
      total += price * item.quantity;
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price,
        notes: item.notes || null,
      };
    });

    const todayStr = new Date().toISOString().slice(0, 10);

    const order = await prisma.order.create({
      data: {
        tableId: tableId || null,
        customerName,
        date: todayStr,
        prepareBy: prepareBy || null,
        total,
        items: { create: orderItems },
      },
      include: {
        table: true,
        items: { include: { menuItem: true } },
      },
    });

    // Update table status to occupied if a table was assigned
    if (tableId) {
      await prisma.table.update({
        where: { id: tableId },
        data: { status: 'OCCUPIED' },
      });
      getIO().emit('table:updated', { id: tableId, status: 'OCCUPIED' });
    }

    getIO().emit('order:created', order);
    getIO().emit('new-order', { customerName });

    res.status(201).json(order);
  } catch {
    res.status(500).json({ message: 'Failed to create order' });
  }
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        table: true,
        items: { include: { menuItem: true } },
      },
    });

    // If order is completed or cancelled, check if table can be freed
    if ((status === 'COMPLETED' || status === 'CANCELLED') && order.tableId) {
      const activeOrders = await prisma.order.count({
        where: {
          tableId: order.tableId,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      });

      if (activeOrders === 0) {
        await prisma.table.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE' },
        });
        getIO().emit('table:updated', { id: order.tableId, status: 'AVAILABLE' });
      }
    }

    getIO().emit('order:updated', order);
    res.json(order);
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    res.status(500).json({ message: 'Failed to update order status' });
  }
};

export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const order = await prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        table: true,
        items: { include: { menuItem: true } },
      },
    });

    // Check if table can be freed
    if (order.tableId) {
      const activeOrders = await prisma.order.count({
        where: {
          tableId: order.tableId,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      });

      if (activeOrders === 0) {
        await prisma.table.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE' },
        });
        getIO().emit('table:updated', { id: order.tableId, status: 'AVAILABLE' });
      }
    }

    getIO().emit('order:updated', order);
    res.json(order);
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    res.status(500).json({ message: 'Failed to cancel order' });
  }
};

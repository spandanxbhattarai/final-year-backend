import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getIO } from '../lib/socket';

/**
 * VAPI Server URL (webhook) handler.
 * Receives tool-call requests from the VAPI assistant and executes them against the database.
 */
export const vapiWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // Log incoming request for debugging
    console.log('[VAPI Webhook] Received:', JSON.stringify(req.body, null, 2));

    // VAPI may send payload directly or nested under "message"
    const payload = req.body.message ?? req.body;

    // VAPI sends different message types
    if (payload?.type === 'tool-calls') {
      const toolCalls = payload.toolCalls ?? payload.toolCallList ?? [];
      const results = [];

      for (const toolCall of toolCalls) {
        const fnData = toolCall.function ?? toolCall;
        const name = fnData.name;
        const args = typeof fnData.arguments === 'string' ? JSON.parse(fnData.arguments) : fnData.arguments ?? {};
        const toolCallId = toolCall.id ?? toolCall.toolCallId ?? '';
        let result: string;

        switch (name) {
          case 'checkAvailability': {
            const { date, time, partySize } = args;
            const tables = await prisma.table.findMany({
              where: {
                status: 'AVAILABLE',
                capacity: { gte: Number(partySize) },
              },
              orderBy: { capacity: 'asc' },
            });

            // Also check existing reservations for the same date/time
            const conflicting = await prisma.reservation.findMany({
              where: {
                date,
                time,
                status: { in: ['PENDING', 'CONFIRMED'] },
              },
              select: { tableId: true },
            });

            const bookedTableIds = new Set(conflicting.map((r: any) => r.tableId).filter(Boolean));
            const available = tables.filter((t: any) => !bookedTableIds.has(t.id));

            if (available.length > 0) {
              const tableList = available.map((t: any) => `Table ${t.number} (seats ${t.capacity}, ${t.floor} floor, ID: ${t.id})`).join(', ');
              result = `We have ${available.length} table(s) available for a party of ${partySize} on ${date} at ${time}. Available tables: ${tableList}`;
            } else {
              result = `Sorry, no tables are available for a party of ${partySize} on ${date} at ${time}. Please suggest an alternative date or time.`;
            }
            break;
          }

          case 'createReservation': {
            const { customerName, phone, email, date, time, partySize, tableId } = args;

            const reservation = await prisma.reservation.create({
              data: {
                customerName,
                phone,
                email: email || null,
                date,
                time,
                partySize: Number(partySize),
                tableId: tableId ? Number(tableId) : null,
                status: 'CONFIRMED',
              },
              include: { table: true },
            });

            // If a table was assigned, mark it as reserved
            if (reservation.tableId) {
              await prisma.table.update({
                where: { id: reservation.tableId },
                data: { status: 'RESERVED' },
              });
              getIO().emit('table:updated', { id: reservation.tableId, status: 'RESERVED' });
            }

            getIO().emit('reservation:created', reservation);

            const tableInfo = reservation.table ? ` Table ${reservation.table.number} has been assigned.` : '';
            result = `Reservation confirmed! Reservation ID: ${reservation.id}. Name: ${customerName}, party of ${partySize}, on ${date} at ${time}.${tableInfo}`;
            break;
          }

          case 'getMenu': {
            const { category } = args;
            const where: Record<string, unknown> = { available: true };
            if (category) where.category = category;

            const items = await prisma.menuItem.findMany({
              where,
              orderBy: { name: 'asc' },
            });

            const categories = await prisma.menuCategory.findMany({
              orderBy: { name: 'asc' },
            });

            const catList = categories.map((c: any) => c.name).join(', ');
            const itemList = items.map((i: any) => `${i.name} - ${i.description} ($${i.price.toFixed(2)}, category: ${i.category})`).join('; ');
            result = `Menu categories: ${catList}. Items: ${itemList}`;
            break;
          }

          case 'getOperatingHours': {
            result = 'Operating hours: Monday to Thursday 11:00 AM - 10:00 PM, Friday 11:00 AM - 11:00 PM, Saturday 10:00 AM - 11:00 PM, Sunday 10:00 AM - 9:00 PM.';
            break;
          }

          case 'cancelReservation': {
            const { reservationId, phone: callerPhone } = args;

            const reservation = await prisma.reservation.findUnique({
              where: { id: Number(reservationId) },
            });

            if (!reservation) {
              result = 'Reservation not found. Please check the reservation ID and try again.';
              break;
            }

            if (reservation.phone !== callerPhone) {
              result = 'Phone number does not match the reservation on file. Cannot cancel.';
              break;
            }

            const updated = await prisma.reservation.update({
              where: { id: Number(reservationId) },
              data: { status: 'CANCELLED' },
              include: { table: true },
            });

            if (updated.tableId) {
              await prisma.table.update({
                where: { id: updated.tableId },
                data: { status: 'AVAILABLE' },
              });
              getIO().emit('table:updated', { id: updated.tableId, status: 'AVAILABLE' });
            }

            getIO().emit('reservation:updated', updated);

            result = `Reservation #${reservationId} for ${reservation.customerName} on ${reservation.date} at ${reservation.time} has been cancelled successfully.`;
            break;
          }

          case 'lookupReservation': {
            const { phone: lookupPhone } = args;

            const reservations = await prisma.reservation.findMany({
              where: {
                phone: lookupPhone,
                status: { in: ['PENDING', 'CONFIRMED'] },
              },
              include: { table: true },
              orderBy: { date: 'asc' },
            });

            if (reservations.length > 0) {
              const list = reservations.map((r: any) => {
                const tableInfo = r.table ? `, Table ${r.table.number} (${r.table.floor} floor)` : ', no table assigned yet';
                return `Reservation #${r.id}: ${r.customerName}, party of ${r.partySize}, ${r.date} at ${r.time}, status: ${r.status}${tableInfo}`;
              }).join('; ');
              result = `Found ${reservations.length} upcoming reservation(s). ${list}`;
            } else {
              result = 'No upcoming reservations found for this phone number.';
            }
            break;
          }

          default:
            result = `Unknown tool: ${name}. This tool is not supported.`;
        }

        results.push({
          toolCallId,
          result,
        });
      }

      res.status(200).json({ results });
      return;
    }

    // For end-of-call-report, log the call
    if (payload?.type === 'end-of-call-report') {
      const { customer, transcript, call } = payload;

      await prisma.callLog.create({
        data: {
          callerName: customer?.name || 'Unknown Caller',
          callerPhone: customer?.number || 'Unknown',
          duration: Math.round((call?.duration || 0)),
          status: 'COMPLETED',
          transcript: transcript || null,
        },
      });

      res.json({ ok: true });
      return;
    }

    // Acknowledge other message types (status-update, hang, etc.)
    res.json({ ok: true });
  } catch (error) {
    console.error('VAPI webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
};

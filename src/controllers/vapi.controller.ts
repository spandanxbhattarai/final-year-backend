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
            getIO().emit('new-reservation', { customerName });

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

          case 'createOrder': {
            const { customerName: orderCustomer, phone: orderPhone, items: orderItemsArg, prepareBy: orderPrepareBy, date: orderDate, tableId: orderTableId } = args;

            if (!orderCustomer || !orderItemsArg || !Array.isArray(orderItemsArg) || orderItemsArg.length === 0) {
              result = 'Please provide customer name, phone number, and at least one item with name and quantity.';
              break;
            }

            // Look up menu items by name (case-insensitive)
            const itemNames = orderItemsArg.map((i: any) => i.name?.toLowerCase()).filter(Boolean);
            const menuItemsFound = await prisma.menuItem.findMany({
              where: {
                available: true,
                name: { in: itemNames, mode: 'insensitive' },
              },
            });

            const menuMap = new Map(menuItemsFound.map((m: any) => [m.name.toLowerCase(), m]));

            const notFound: string[] = [];
            let orderTotal = 0;
            const orderItemsData: { menuItemId: number; quantity: number; price: number; notes: string | null }[] = [];

            for (const item of orderItemsArg) {
              const menuItem = menuMap.get(item.name?.toLowerCase());
              if (!menuItem) {
                notFound.push(item.name);
                continue;
              }
              const qty = Number(item.quantity) || 1;
              orderTotal += menuItem.price * qty;
              orderItemsData.push({
                menuItemId: menuItem.id,
                quantity: qty,
                price: menuItem.price,
                notes: item.notes || null,
              });
            }

            if (orderItemsData.length === 0) {
              result = `Could not find any of the requested items on the menu: ${notFound.join(', ')}. Please check the menu and try again.`;
              break;
            }

            // Use provided date or default to today
            const orderDateStr = orderDate || new Date().toISOString().slice(0, 10);
            // Determine type: if tableId is provided, it's dine-in, otherwise phone/takeaway
            const orderType = orderTableId ? 'DINE_IN' : 'PHONE';

            const newOrder = await prisma.order.create({
              data: {
                customerName: orderCustomer,
                phone: orderPhone || '',
                tableId: orderTableId ? Number(orderTableId) : null,
                type: orderType,
                date: orderDateStr,
                prepareBy: orderPrepareBy || null,
                total: orderTotal,
                items: { create: orderItemsData },
              },
              include: {
                table: true,
                items: { include: { menuItem: true } },
              },
            });

            // If dine-in with a table, mark table as occupied
            if (orderTableId) {
              await prisma.table.update({
                where: { id: Number(orderTableId) },
                data: { status: 'OCCUPIED' },
              });
              getIO().emit('table:updated', { id: Number(orderTableId), status: 'OCCUPIED' });
            }

            getIO().emit('order:created', newOrder);
            getIO().emit('new-order', { customerName: orderCustomer });

            const itemSummary = newOrder.items.map((i: any) => `${i.quantity}x ${i.menuItem.name}`).join(', ');
            const notFoundMsg = notFound.length > 0 ? ` Note: could not find these items: ${notFound.join(', ')}.` : '';
            const prepareByMsg = orderPrepareBy ? ` It will be ready by ${orderPrepareBy}.` : '';
            const tableMsg = newOrder.table ? ` Linked to Table ${newOrder.table.number}.` : '';
            const dateMsg = orderDateStr !== new Date().toISOString().slice(0, 10) ? ` Scheduled for ${orderDateStr}.` : '';
            result = `Order #${newOrder.id} created successfully! Items: ${itemSummary}. Total: $${orderTotal.toFixed(2)}.${prepareByMsg}${dateMsg}${tableMsg}${notFoundMsg} The order is being prepared.`;
            break;
          }

          case 'lookupOrder': {
            const { phone: orderLookupPhone } = args;

            const orders = await prisma.order.findMany({
              where: {
                phone: orderLookupPhone,
                status: { notIn: ['CANCELLED'] },
              },
              include: {
                table: true,
                items: { include: { menuItem: true } },
              },
              orderBy: { createdAt: 'desc' },
              take: 5,
            });

            if (orders.length > 0) {
              const list = orders.map((o: any) => {
                const itemList = o.items.map((i: any) => `${i.quantity}x ${i.menuItem.name}`).join(', ');
                const tableInfo = o.table ? `, Table ${o.table.number}` : '';
                const prepareInfo = o.prepareBy ? `, pickup by ${o.prepareBy}` : '';
                return `Order #${o.id}: ${o.customerName}, ${o.type === 'PHONE' ? 'Takeaway' : 'Dine-in'}${tableInfo}, ${o.date}${prepareInfo}, status: ${o.status}, items: ${itemList}, total: $${o.total.toFixed(2)}`;
              }).join('; ');
              result = `Found ${orders.length} order(s). ${list}`;
            } else {
              result = 'No active orders found for this phone number.';
            }
            break;
          }

          case 'cancelOrder': {
            const { orderId, phone: cancelOrderPhone } = args;

            const orderToCancel = await prisma.order.findUnique({
              where: { id: Number(orderId) },
              include: { table: true },
            });

            if (!orderToCancel) {
              result = 'Order not found. Please check the order ID and try again.';
              break;
            }

            if (orderToCancel.phone !== cancelOrderPhone) {
              result = 'Phone number does not match the order on file. Cannot cancel.';
              break;
            }

            if (orderToCancel.status === 'CANCELLED') {
              result = 'This order is already cancelled.';
              break;
            }

            const cancelledOrder = await prisma.order.update({
              where: { id: Number(orderId) },
              data: { status: 'CANCELLED' },
              include: { table: true, items: { include: { menuItem: true } } },
            });

            // Free the table if dine-in and no other active orders on it
            if (cancelledOrder.tableId) {
              const activeOrders = await prisma.order.count({
                where: {
                  tableId: cancelledOrder.tableId,
                  status: { notIn: ['COMPLETED', 'CANCELLED'] },
                },
              });
              if (activeOrders === 0) {
                await prisma.table.update({
                  where: { id: cancelledOrder.tableId },
                  data: { status: 'AVAILABLE' },
                });
                getIO().emit('table:updated', { id: cancelledOrder.tableId, status: 'AVAILABLE' });
              }
            }

            getIO().emit('order:updated', cancelledOrder);

            result = `Order #${orderId} for ${orderToCancel.customerName} has been cancelled successfully.`;
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
      const { customer, transcript, call, summary, recordingUrl, artifact } = payload;

      const callLog = await prisma.callLog.create({
        data: {
          vapiCallId: call?.id || null,
          callerName: customer?.name || 'Unknown Caller',
          callerPhone: customer?.number || 'Unknown',
          duration: Math.round((call?.duration || 0)),
          status: 'COMPLETED',
          summary: summary || artifact?.summary || null,
          transcript: transcript || artifact?.transcript || null,
          recordingUrl: recordingUrl || artifact?.recordingUrl || call?.recordingUrl || null,
        },
      });

      getIO().emit('call-log:created', callLog);

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

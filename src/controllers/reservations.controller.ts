import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getIO } from '../lib/socket';

export const getReservations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, date } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (date) where.date = date as string;

    const reservations = await prisma.reservation.findMany({
      where,
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      include: { table: true },
    });
    res.json(reservations);
  } catch {
    res.status(500).json({ message: 'Failed to fetch reservations' });
  }
};

export const getReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { table: true },
    });
    if (!reservation) {
      res.status(404).json({ message: 'Reservation not found' });
      return;
    }
    res.json(reservation);
  } catch {
    res.status(500).json({ message: 'Failed to fetch reservation' });
  }
};

export const createReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    const reservation = await prisma.reservation.create({
      data: req.body,
      include: { table: true },
    });
    getIO().emit('reservation:created', reservation);
    getIO().emit('new-reservation', { customerName: reservation.customerName });
    res.status(201).json(reservation);
  } catch {
    res.status(500).json({ message: 'Failed to create reservation' });
  }
};

export const updateReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const reservation = await prisma.reservation.update({
      where: { id },
      data: req.body,
      include: { table: true },
    });

    // If reservation is cancelled and had a table, free it
    if (reservation.status === 'CANCELLED' && reservation.tableId) {
      await prisma.table.update({
        where: { id: reservation.tableId },
        data: { status: 'AVAILABLE' },
      });
      getIO().emit('table:updated', { id: reservation.tableId, status: 'AVAILABLE' });
    }

    getIO().emit('reservation:updated', reservation);
    res.json(reservation);
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Reservation not found' });
      return;
    }
    res.status(500).json({ message: 'Failed to update reservation' });
  }
};

export const deleteReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await prisma.reservation.delete({ where: { id } });
    getIO().emit('reservation:deleted', { id });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Reservation not found' });
      return;
    }
    res.status(500).json({ message: 'Failed to delete reservation' });
  }
};

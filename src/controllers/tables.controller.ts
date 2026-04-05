import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getIO } from '../lib/socket';

export const getTables = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tables = await prisma.table.findMany({
      orderBy: { number: 'asc' },
      include: { reservations: { where: { status: 'CONFIRMED' }, take: 1, orderBy: { date: 'asc' } } },
    });
    res.json(tables);
  } catch {
    res.status(500).json({ message: 'Failed to fetch tables' });
  }
};

export const getAvailableTables = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, time, partySize } = req.query;
    const minCapacity = partySize ? parseInt(partySize as string, 10) : 1;

    const tables = await prisma.table.findMany({
      where: {
        status: 'AVAILABLE',
        capacity: { gte: minCapacity },
      },
      orderBy: { number: 'asc' },
    });

    res.json(tables);
  } catch {
    res.status(500).json({ message: 'Failed to fetch available tables' });
  }
};

export const createTable = async (req: Request, res: Response): Promise<void> => {
  try {
    const table = await prisma.table.create({ data: req.body });
    getIO().emit('table:created', table);
    res.status(201).json(table);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ message: 'Table number already exists' });
      return;
    }
    res.status(500).json({ message: 'Failed to create table' });
  }
};

export const updateTable = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const table = await prisma.table.update({
      where: { id },
      data: req.body,
    });
    getIO().emit('table:updated', table);
    res.json(table);
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Table not found' });
      return;
    }
    res.status(500).json({ message: 'Failed to update table' });
  }
};

export const deleteTable = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await prisma.table.delete({ where: { id } });
    getIO().emit('table:deleted', { id });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Table not found' });
      return;
    }
    res.status(500).json({ message: 'Failed to delete table' });
  }
};

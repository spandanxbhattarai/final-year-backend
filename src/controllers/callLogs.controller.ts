import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getCallLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status) where.status = status;

    const callLogs = await prisma.callLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(callLogs);
  } catch {
    res.status(500).json({ message: 'Failed to fetch call logs' });
  }
};

export const getCallLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const callLog = await prisma.callLog.findUnique({
      where: { id },
    });
    if (!callLog) {
      res.status(404).json({ message: 'Call log not found' });
      return;
    }
    res.json(callLog);
  } catch {
    res.status(500).json({ message: 'Failed to fetch call log' });
  }
};

export const createCallLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const callLog = await prisma.callLog.create({ data: req.body });
    res.status(201).json(callLog);
  } catch {
    res.status(500).json({ message: 'Failed to create call log' });
  }
};

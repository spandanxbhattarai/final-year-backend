import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const createContactMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, restaurantName, email, phone, message } = req.body;

    if (!name || !email || !message) {
      res.status(400).json({ message: 'Name, email, and message are required' });
      return;
    }

    const contact = await prisma.contactMessage.create({
      data: {
        name,
        restaurantName: restaurantName || null,
        email,
        phone: phone || null,
        message,
      },
    });

    res.status(201).json(contact);
  } catch {
    res.status(500).json({ message: 'Failed to submit contact message' });
  }
};

export const getContactMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(messages);
  } catch {
    res.status(500).json({ message: 'Failed to fetch contact messages' });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const updated = await prisma.contactMessage.update({
      where: { id },
      data: { isRead: true },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ message: 'Failed to update message' });
  }
};

export const deleteContactMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await prisma.contactMessage.delete({ where: { id } });
    res.status(204).end();
  } catch {
    res.status(500).json({ message: 'Failed to delete message' });
  }
};

import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isBlocked: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

export const getUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Failed to fetch user' });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    if (role === 'SUPER_ADMIN') {
      res.status(403).json({ message: 'Cannot create a SUPER_ADMIN user' });
      return;
    }

    const existing = await prisma.user.findFirst({ where: { email, isDeleted: false } });
    if (existing) {
      res.status(409).json({ message: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: role || 'STAFF' },
      select: userSelect,
    });

    res.status(201).json(user);
  } catch {
    res.status(500).json({ message: 'Failed to create user' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, email, password, role, isBlocked } = req.body;

    if (role === 'SUPER_ADMIN') {
      res.status(403).json({ message: 'Cannot assign SUPER_ADMIN role' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (existing.role === 'SUPER_ADMIN') {
      res.status(403).json({ message: 'Cannot modify SUPER_ADMIN user' });
      return;
    }

    if (email && email !== existing.email) {
      const emailTaken = await prisma.user.findFirst({ where: { email, isDeleted: false } });
      if (emailTaken) {
        res.status(409).json({ message: 'Email already in use' });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (isBlocked !== undefined) updateData.isBlocked = isBlocked;
    if (password) updateData.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({ where: { id }, data: updateData, select: userSelect });
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Failed to update user' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);

    if (id === req.userId) {
      res.status(400).json({ message: 'Cannot delete your own account' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isDeleted: true },
      select: userSelect,
    });
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

export const blockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);

    if (id === req.userId) {
      res.status(400).json({ message: 'Cannot block your own account' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isBlocked: true },
      select: userSelect,
    });
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Failed to block user' });
  }
};

export const unblockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isBlocked: false },
      select: userSelect,
    });
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Failed to unblock user' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: userSelect,
    });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!existing) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (email && email !== existing.email) {
      const emailTaken = await prisma.user.findFirst({ where: { email, isDeleted: false } });
      if (emailTaken) {
        res.status(409).json({ message: 'Email already in use' });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
      select: userSelect,
    });
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

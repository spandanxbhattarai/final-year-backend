import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getIO } from '../lib/socket';

export const getMenuItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    const where: any = {};
    if (category) where.category = category as string;

    const items = await prisma.menuItem.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { categoryRel: true },
    });
    res.json(items);
  } catch {
    res.status(500).json({ message: 'Failed to fetch menu items' });
  }
};

export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.menuCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { items: true } } },
    });
    res.json(categories);
  } catch {
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    const category = await prisma.menuCategory.create({ data: { name } });
    res.status(201).json(category);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ message: 'Category already exists' });
      return;
    }
    res.status(500).json({ message: 'Failed to create category' });
  }
};

export const createMenuItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await prisma.menuItem.create({
      data: req.body,
      include: { categoryRel: true },
    });
    getIO().emit('menu:created', item);
    res.status(201).json(item);
  } catch {
    res.status(500).json({ message: 'Failed to create menu item' });
  }
};

export const updateMenuItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.menuItem.update({
      where: { id },
      data: req.body,
      include: { categoryRel: true },
    });
    getIO().emit('menu:updated', item);
    res.json(item);
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Menu item not found' });
      return;
    }
    res.status(500).json({ message: 'Failed to update menu item' });
  }
};

export const deleteMenuItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await prisma.menuItem.delete({ where: { id } });
    getIO().emit('menu:deleted', { id });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Menu item not found' });
      return;
    }
    res.status(500).json({ message: 'Failed to delete menu item' });
  }
};

export const toggleAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item) {
      res.status(404).json({ message: 'Menu item not found' });
      return;
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data: { available: !item.available },
      include: { categoryRel: true },
    });
    getIO().emit('menu:updated', updated);
    res.json(updated);
  } catch {
    res.status(500).json({ message: 'Failed to toggle availability' });
  }
};

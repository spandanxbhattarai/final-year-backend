import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name required').max(100),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['STAFF', 'COOK']).default('STAFF'),
});

export const createTableSchema = z.object({
  number: z.number().int().min(1),
  capacity: z.number().int().min(1).max(20),
  floor: z.string().min(1),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE']).default('AVAILABLE'),
});

export const updateTableSchema = createTableSchema.partial();

export const createReservationSchema = z.object({
  customerName: z.string().min(2).max(100),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone'),
  email: z.string().email().optional().or(z.literal('')),
  date: z.string().min(1),
  time: z.string().min(1),
  partySize: z.number().int().min(1).max(20),
  tableId: z.number().int().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).optional(),
});

export const updateReservationSchema = createReservationSchema.partial().extend({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).optional(),
});

export const createMenuItemSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(2).max(500),
  price: z.number().min(0.01),
  category: z.string().min(1),
  imageUrl: z.string().url().optional().or(z.literal('')),
  available: z.boolean().default(true),
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

export const createOrderSchema = z.object({
  tableId: z.number().int().min(1),
  customerName: z.string().min(2).max(100),
  items: z.array(z.object({
    menuItemId: z.number().int(),
    quantity: z.number().int().min(1),
    notes: z.string().optional().or(z.literal('')),
  })).min(1, 'At least one item required'),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']),
});

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name required').max(100),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'STAFF', 'COOK']).default('STAFF'),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['ADMIN', 'STAFF', 'COOK']).optional(),
  isBlocked: z.boolean().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

import { Router } from 'express';
import {
  getMenuItems,
  getCategories,
  createCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
} from '../controllers/menu.controller';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createMenuItemSchema, updateMenuItemSchema } from '../schemas';

const router = Router();

router.use(authenticate);

router.get('/', getMenuItems);
router.get('/categories', getCategories);
router.post('/categories', requireAdmin, createCategory);
router.post('/', requireAdmin, validate(createMenuItemSchema), createMenuItem);
router.patch('/:id', requireAdmin, validate(updateMenuItemSchema), updateMenuItem);
router.delete('/:id', requireAdmin, deleteMenuItem);
router.patch('/:id/toggle', toggleAvailability);

export default router;

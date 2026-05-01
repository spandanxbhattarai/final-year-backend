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
import { authenticate, requireStaffOrAbove } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createMenuItemSchema, updateMenuItemSchema } from '../schemas';

const router = Router();

router.use(authenticate);

router.get('/', getMenuItems);
router.get('/categories', getCategories);
router.post('/categories', requireStaffOrAbove, createCategory);
router.post('/', requireStaffOrAbove, validate(createMenuItemSchema), createMenuItem);
router.patch('/:id', requireStaffOrAbove, validate(updateMenuItemSchema), updateMenuItem);
router.delete('/:id', requireStaffOrAbove, deleteMenuItem);
router.patch('/:id/toggle', requireStaffOrAbove, toggleAvailability);

export default router;

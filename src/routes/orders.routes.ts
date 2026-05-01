import { Router } from 'express';
import {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  cancelOrder,
} from '../controllers/orders.controller';
import { authenticate, requireStaffOrAbove, requireCookOrAbove } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createOrderSchema, updateOrderStatusSchema } from '../schemas';

const router = Router();

router.use(authenticate);

// COOK and above can read orders and update status (for kitchen display)
router.get('/', requireCookOrAbove, getOrders);
router.get('/:id', requireCookOrAbove, getOrder);
router.patch('/:id/status', requireCookOrAbove, validate(updateOrderStatusSchema), updateOrderStatus);

// STAFF and above can create or cancel orders
router.post('/', requireStaffOrAbove, validate(createOrderSchema), createOrder);
router.patch('/:id/cancel', requireStaffOrAbove, cancelOrder);

export default router;

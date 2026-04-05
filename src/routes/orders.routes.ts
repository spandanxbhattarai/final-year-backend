import { Router } from 'express';
import {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  cancelOrder,
} from '../controllers/orders.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createOrderSchema, updateOrderStatusSchema } from '../schemas';

const router = Router();

router.use(authenticate);

router.get('/', getOrders);
router.get('/:id', getOrder);
router.post('/', validate(createOrderSchema), createOrder);
router.patch('/:id/status', validate(updateOrderStatusSchema), updateOrderStatus);
router.patch('/:id/cancel', cancelOrder);

export default router;

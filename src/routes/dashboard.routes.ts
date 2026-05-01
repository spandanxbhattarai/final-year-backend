import { Router } from 'express';
import {
  getDashboardStats,
  getRevenueData,
  getTopItems,
  getTodayReservations,
  getRecentActivity,
} from '../controllers/dashboard.controller';
import { authenticate, requireAdminOrAbove } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireAdminOrAbove);

router.get('/stats', getDashboardStats);
router.get('/revenue', getRevenueData);
router.get('/top-items', getTopItems);
router.get('/reservations', getTodayReservations);
router.get('/activity', getRecentActivity);

export default router;

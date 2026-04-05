import { Router } from 'express';
import {
  getReservations,
  getReservation,
  createReservation,
  updateReservation,
  deleteReservation,
} from '../controllers/reservations.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createReservationSchema, updateReservationSchema } from '../schemas';

const router = Router();

router.use(authenticate);

router.get('/', getReservations);
router.get('/:id', getReservation);
router.post('/', validate(createReservationSchema), createReservation);
router.patch('/:id', validate(updateReservationSchema), updateReservation);
router.delete('/:id', deleteReservation);

export default router;

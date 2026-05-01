import { Router } from 'express';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  blockUser,
  unblockUser,
  getProfile,
  updateProfile,
} from '../controllers/users.controller';
import { authenticate, requireSuperAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createUserSchema, updateUserSchema, updateProfileSchema } from '../schemas';

const router = Router();

router.use(authenticate);

// Own profile routes (all authenticated users)
router.get('/profile', getProfile);
router.patch('/profile', validate(updateProfileSchema), updateProfile);

// Super Admin only
router.get('/', requireSuperAdmin, getUsers);
router.post('/', requireSuperAdmin, validate(createUserSchema), createUser);
router.get('/:id', requireSuperAdmin, getUser);
router.patch('/:id', requireSuperAdmin, validate(updateUserSchema), updateUser);
router.delete('/:id', requireSuperAdmin, deleteUser);
router.patch('/:id/block', requireSuperAdmin, blockUser);
router.patch('/:id/unblock', requireSuperAdmin, unblockUser);

export default router;

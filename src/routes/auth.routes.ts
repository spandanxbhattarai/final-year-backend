import { Router } from 'express';
import { login, register, refresh, logout } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema } from '../schemas';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/register', validate(registerSchema), register);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);

export default router;

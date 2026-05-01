import { Router } from 'express';
import { getCallLogs, getCallLog, createCallLog } from '../controllers/callLogs.controller';
import { authenticate, requireAdminOrAbove } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireAdminOrAbove);

router.get('/', getCallLogs);
router.get('/:id', getCallLog);
router.post('/', createCallLog);

export default router;

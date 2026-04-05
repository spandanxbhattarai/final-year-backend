import { Router } from 'express';
import { getCallLogs, getCallLog, createCallLog } from '../controllers/callLogs.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getCallLogs);
router.get('/:id', getCallLog);
router.post('/', createCallLog);

export default router;

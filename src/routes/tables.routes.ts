import { Router } from 'express';
import { getTables, getAvailableTables, createTable, updateTable, deleteTable } from '../controllers/tables.controller';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createTableSchema, updateTableSchema } from '../schemas';

const router = Router();

router.use(authenticate);

router.get('/', getTables);
router.get('/available', getAvailableTables);
router.post('/', requireAdmin, validate(createTableSchema), createTable);
router.patch('/:id', validate(updateTableSchema), updateTable);
router.delete('/:id', requireAdmin, deleteTable);

export default router;

import { Router } from 'express';
import { getTables, getAvailableTables, createTable, updateTable, deleteTable } from '../controllers/tables.controller';
import { authenticate, requireAdminOrAbove, requireStaffOrAbove } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createTableSchema, updateTableSchema } from '../schemas';

const router = Router();

router.use(authenticate, requireStaffOrAbove);

router.get('/', getTables);
router.get('/available', getAvailableTables);
router.post('/', requireAdminOrAbove, validate(createTableSchema), createTable);
router.patch('/:id', validate(updateTableSchema), updateTable);
router.delete('/:id', requireAdminOrAbove, deleteTable);

export default router;

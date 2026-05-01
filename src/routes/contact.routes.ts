import { Router } from 'express';
import { createContactMessage, getContactMessages, markAsRead, deleteContactMessage } from '../controllers/contact.controller';
import { authenticate, requireAdminOrAbove } from '../middleware/auth';

const router = Router();

// Public — anyone can submit a contact form
router.post('/', createContactMessage);

// Protected — admin/superadmin only
router.get('/', authenticate, requireAdminOrAbove, getContactMessages);
router.patch('/:id/read', authenticate, requireAdminOrAbove, markAsRead);
router.delete('/:id', authenticate, requireAdminOrAbove, deleteContactMessage);

export default router;

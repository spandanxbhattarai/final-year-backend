import { Router, Request, Response, NextFunction } from 'express';
import { vapiWebhook } from '../controllers/vapi.controller';
import { config } from '../lib/config';

const router = Router();

/**
 * Optional: Verify the request is actually from VAPI using a shared secret header.
 * Set VAPI_WEBHOOK_SECRET in your .env, then configure the same secret in VAPI dashboard
 * under "Server URL secret" field.
 */
const verifyVapiSecret = (req: Request, res: Response, next: NextFunction): void => {
  const secret = config.vapiWebhookSecret;
  if (!secret) {
    // No secret configured — allow all (dev mode)
    next();
    return;
  }

  const headerSecret = req.headers['x-vapi-secret'];
  if (headerSecret !== secret) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  next();
};

// No JWT authentication — VAPI authenticates via the shared secret
router.post('/', verifyVapiSecret, vapiWebhook);

export default router;

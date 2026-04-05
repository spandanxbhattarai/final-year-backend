import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
  jwtExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
  vapiWebhookSecret: process.env.VAPI_WEBHOOK_SECRET || '',
};

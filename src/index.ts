import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './lib/config';
import { initSocket } from './lib/socket';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import authRoutes from './routes/auth.routes';
import tablesRoutes from './routes/tables.routes';
import reservationsRoutes from './routes/reservations.routes';
import menuRoutes from './routes/menu.routes';
import ordersRoutes from './routes/orders.routes';
import callLogsRoutes from './routes/callLogs.routes';
import vapiRoutes from './routes/vapi.routes';
import usersRoutes from './routes/users.routes';
import dashboardRoutes from './routes/dashboard.routes';
import contactRoutes from './routes/contact.routes';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
initSocket(httpServer);

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowed = config.clientUrl.split(',').map(s => s.trim());
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/call-logs', callLogsRoutes);
app.use('/api/vapi', vapiRoutes);
app.use('/api/contact', contactRoutes);

// Global error handler
app.use(errorHandler);

httpServer.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});

export default app;

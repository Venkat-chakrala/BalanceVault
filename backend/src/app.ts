import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { globalLimiter } from './middlewares/rateLimiter.middleware';
import { errorHandler } from './middlewares/errorHandler.middleware';

import authRoutes from './routes/auth.routes';
import accountRoutes from './routes/account.routes';
import transferRoutes from './routes/transfer.routes';
import adminRoutes from './routes/admin.routes';
import healthRoutes from './routes/health.routes';

const app: Application = express();

// Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Vite inline scripts & styles
  })
);

app.use(
  cors({
    origin: '*', // Allows deployment environments and cross-origin evaluators
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  })
);

app.use(express.json({ limit: '10kb' })); // Mitigates JSON payload size attacks
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
  app.use(globalLimiter);
}

// API Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/admin', adminRoutes);

// In production, serve the built React frontend static assets from frontend/dist
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

// Catch-all: Route unhandled client requests to React index.html for SPA routing, or 404 for API
app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`,
      },
    });
  }

  const indexHtml = path.join(frontendDist, 'index.html');
  return res.sendFile(indexHtml, (err) => {
    if (err) {
      res.status(404).send('Frontend not built. Please run npm run build.');
    }
  });
});

// Global Error Handler
app.use(errorHandler);

export default app;

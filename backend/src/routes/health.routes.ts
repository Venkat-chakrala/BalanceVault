import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  return res.status(200).json({
    status: 'UP',
    service: 'BalanceVault Core Ledger API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Probe database connectivity
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      status: 'READY',
      checks: {
        database: 'CONNECTED',
        ledgerService: 'OPERATIONAL',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(503).json({
      status: 'NOT_READY',
      checks: {
        database: 'DISCONNECTED',
        error: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;


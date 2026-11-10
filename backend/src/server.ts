import app from './app';
import { config } from './config/env';
import prisma from './prisma/client';

const server = app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(`🚀 BalanceVault Server running on port ${config.port}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`🔒 Double-Entry Ledger Engine: ACTIVE`);
  console.log(`🛡️ Cryptographic Tamper-Proof Chain: INITIALIZED`);
  console.log(`====================================================`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Database connections closed. Process terminating.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

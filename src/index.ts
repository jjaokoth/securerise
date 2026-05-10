import express from 'express';
import { PrismaClient } from '@prisma/client';
import { app } from './app';
import apiRouter from './routes/api';

export const prisma = new PrismaClient();

// Middleware: tenant auth globally for /v1 prefix
app.use('/v1', require('./middleware/tenant-auth').default);

// Routing: handshake router mounted at /v1/handshakes
app.use('/v1/handshakes', apiRouter);

// Database Connection
const PORT = process.env.PORT || 3000;

async function bootstrap(): Promise<void> {
  // Ensure Postgres engine is reachable before accepting traffic
  await prisma.$connect();

  // Server
  app.listen(PORT, () => {
    console.log('Securerise Trust API Live on Parrot OS [Port 3000]');
  });
}

bootstrap().catch(async (err) => {
  console.error('[Securerise] Fatal — could not reach Postgres engine:', err);
  await prisma.$disconnect();
  process.exit(1);
});


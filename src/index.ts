/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 * 
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of 
 * Securerise Solutions Limited. Unauthorized copying or distribution 
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */

// Required: patch BigInt serialization early in the process.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import { PrismaClient } from '@prisma/client';
import { app } from './app';


export const prisma = new PrismaClient();

// Database Connection
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function bootstrap(): Promise<void> {
  // Ensure Postgres engine is reachable before accepting traffic
  await prisma.$connect();

  app.listen(PORT, () => {
    console.log('Securerise Trust API Live on Parrot OS [Port 3000]');
  });
}

bootstrap().catch(async (err) => {
  console.error('[Securerise] Fatal — could not reach Postgres engine:', err);
  await prisma.$disconnect();
  process.exit(1);
});



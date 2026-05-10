import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('@prisma/client');

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

async function resolveTenantFromApiKeyRaw(apiKeyRaw: string) {
  const apiKeyHash = sha256Hex(apiKeyRaw);

  const prisma = new PrismaClient();
  try {
    // Requirement: query the Prisma Tenant table for a record matching the hashed key.
    // Requirement: attach the full tenant object on success.
    return prisma.tenant.findUnique({
      where: { hashedApiKey: apiKeyHash },
    });
  } finally {
    await prisma.$disconnect();
  }
}

export async function tenantAuth(req: Request, res: Response, next: NextFunction) {
  const apiKeyRaw = req.header('x-api-key');

  if (!apiKeyRaw) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key',
    });
  }

  try {
    const tenant = await resolveTenantFromApiKeyRaw(apiKeyRaw);

    if (!tenant) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or missing API key',
      });
    }

    // Requirement: attach the full tenant object.
    res.locals.tenant = tenant;
    return next();
  } catch {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key',
    });
  }
}

export default tenantAuth;



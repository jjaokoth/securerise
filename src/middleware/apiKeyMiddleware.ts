import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('@prisma/client');

import { ApiError, sendApiError } from '../lib/httpErrors';

type BearerAuthHeader = `Bearer ${string}`;

function parseBearerAuthorizationHeader(headerValue: unknown): string | null {
  if (typeof headerValue !== 'string') return null;
  const trimmed = headerValue.trim();
  const match = /^Bearer\s+(.+)$/.exec(trimmed);
  if (!match) return null;
  const key = match[1].trim();
  return key.length ? key : null;
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  // Both strings should be hex of same length; if not, fail closed.
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

async function resolveTenantFromApiKeyRaw(apiKeyRaw: string) {
  // Requirement: never store raw keys.
  // We only derive a hash and compare it against the stored hashed value.
  const apiKeyHash = sha256Hex(apiKeyRaw);

  const prisma = new PrismaClient();
  try {
    // Since Tenant.apiKey is indexed/stored as hash, we can query by hash.
    const tenant = await prisma.tenant.findUnique({
      where: { apiKey: apiKeyHash },
      select: {
        id: true,
        name: true,
        webhookSecret: true,
        apiKey: true, // kept for any internal comparisons; never returned to caller
      },
    });

    return tenant;
  } finally {
    await prisma.$disconnect();
  }
}

export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.header('authorization');
    const bearerKey = parseBearerAuthorizationHeader(authHeader);

    if (!bearerKey) {
      return sendApiError(
        res,
        new ApiError({
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid Authorization header',
        })
      );
    }

    const tenant = await resolveTenantFromApiKeyRaw(bearerKey);

    if (!tenant) {
      return sendApiError(
        res,
        new ApiError({
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Invalid API key',
        })
      );
    }

    // Attach tenant to request context for downstream scoping.
    (req as any).tenant = tenant;
    return next();
  } catch (e: any) {
    return sendApiError(
      res,
      new ApiError({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
        details: e?.message,
      })
    );
  }
}

export default apiKeyMiddleware;


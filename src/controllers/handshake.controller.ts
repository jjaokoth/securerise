/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 * 
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of 
 * Securerise Solutions Limited. Unauthorized copying or distribution 
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */


import type { Request, Response } from 'express';

import crypto from 'crypto';

import type { VerifyAssetResult } from '../services/ai.service';
import { verifyAsset } from '../services/ai.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('@prisma/client');


const prisma = new PrismaClient();

function isPrismaDbUnreachableError(err: any): boolean {
  const msg = String(err?.message ?? '').toLowerCase();
  const code = String(err?.code ?? '');

  // Common Prisma / node connectivity hints
  return (
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('timeout') ||
    msg.includes('failed to connect') ||
    msg.includes('prisma') && msg.includes('offline') ||
    code === 'P1001' ||
    code === 'P1017'
  );
}


type Currency = 'KES' | 'USDC';

type CreateHandshakeBodyTaskText = {
  // As per task text
  amount: number | string;
  currency: Currency;
  provider_ref: string;

  // Optional hint to route/recipient; schema supports route-specific recipients
  route?: 'MPESA' | 'BANK' | 'USDC';
  mpesaB2CRecipient?: string | null;
  pesaLinkRecipient?: string | null;
  circleRecipient?: string | null;
};

type CreateHandshakeBodyOpenApi = {
  // As per existing OpenAPI schema
  route: 'MPESA' | 'BANK' | 'USDC';
  amountKESCents: string; // integer cents as string
  amountUSDCents: string; // integer cents as string
  exchangeRateKESPerUSDC: string; // integer KES cents per USDC cent as string
  mpesaB2CRecipient?: string | null;
  pesaLinkRecipient?: string | null;
  circleRecipient?: string | null;
  handshakeMetadata: Record<string, unknown>;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toBigIntStrictIntegerString(v: unknown, fieldName: string): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v !== 'string' && typeof v !== 'number') {
    throw new Error(`${fieldName}_INVALID`);
  }

  // Reject floats in number form early.
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || !Number.isInteger(v)) {
      throw new Error(`${fieldName}_INVALID`);
    }
  }

  const s = String(v).trim();
  if (!/^\d+$/.test(s)) throw new Error(`${fieldName}_INVALID`);
  // BigInt supports arbitrary length.
  return BigInt(s);
}

function convertAmountToSmallestUnitCents(amount: number | string, currency: Currency): bigint {
  // Security: avoid floating point drift by converting using decimal string parsing.
  // If amount is already a stringified integer cents, caller can pass e.g. "125000" with currency KES.
  // Otherwise we interpret as major units (e.g., 1250.50 -> 125050 cents for KES).

  const raw = typeof amount === 'string' ? amount.trim() : String(amount);
  if (!raw) throw new Error('amount_REQUIRED');

  // Normalize commas and reject scientific notation for safety.
  const normalized = raw.replace(/,/g, '');
  if (/e/i.test(normalized)) throw new Error('amount_INVALID_FORMAT');

  const parts = normalized.split('.');
  const whole = parts[0] ?? '0';
  const frac = parts[1] ?? '';

  if (!/^\d+$/.test(whole)) throw new Error('amount_INVALID');
  if (frac && !/^\d+$/.test(frac)) throw new Error('amount_INVALID');

  // cents = 2 decimal places for both KES and USDC in this simplified gateway.
  const frac2 = frac.padEnd(2, '0').slice(0, 2);
  const cents = BigInt(whole) * 100n + (frac2 ? BigInt(frac2) : 0n);

  if (cents <= 0n) throw new Error('amount_MUST_BE_POSITIVE');
  return cents;
}

function buildTemporaryEvidenceUrl(handshakeId: string): string {

  // Temporary evidence upload URL.
  // Matches existing OpenAPI: /api/payout/handshakes/:handshakeId/verify-proof
  return `/api/payout/handshakes/${encodeURIComponent(handshakeId)}/verify-proof`;
}


export class HandshakeController {
  /**
   * POST /v1/handshake/create
   *
   * Creates a PayoutHandshake in LOCKED state (scoped to res.locals.tenant.id).
   */
  async createHandshake(req: Request, res: Response) {
    try {
      // Multi-tenant scoping requirement.
      const tenantId: string | undefined = (res.locals as any)?.tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ error: 'TENANT_NOT_RESOLVED' });
      }

      const body = req.body as Partial<CreateHandshakeBodyTaskText & CreateHandshakeBodyOpenApi>;

      // Mock escrow address generation (not stored in schema yet).
      const escrow_address = `escrow_${crypto.randomUUID?.() ?? crypto.randomBytes(16).toString('hex')}`;
      void escrow_address;

      const handshakeId = `hs_${crypto.randomUUID?.() ?? Date.now().toString(16)}`;
      const routeFromBody = body.route as 'MPESA' | 'BANK' | 'USDC' | undefined;

      // ---- Validation / Normalization (supports both your task-text and OpenAPI schema) ----
      let route: 'MPESA' | 'BANK' | 'USDC';
      let amountKESCents: bigint;
      let amountUSDCents: bigint;
      let exchangeRateKESPerUSDC: bigint;
      let handshakeMetadata: Record<string, unknown>;
      let mpesaB2CRecipient: string | null | undefined;
      let pesaLinkRecipient: string | null | undefined;
      let circleRecipient: string | null | undefined;

      // OpenAPI path
      if (typeof body?.amountKESCents !== 'undefined' || typeof body?.amountUSDCents !== 'undefined') {
        if (!routeFromBody) return res.status(400).json({ error: 'route_REQUIRED' });
        if (typeof body?.handshakeMetadata === 'undefined' || !isRecord(body.handshakeMetadata)) {
          return res.status(400).json({ error: 'handshakeMetadata_REQUIRED' });
        }

        route = routeFromBody;
        handshakeMetadata = body.handshakeMetadata;

        amountKESCents = toBigIntStrictIntegerString(body.amountKESCents, 'amountKESCents');
        amountUSDCents = toBigIntStrictIntegerString(body.amountUSDCents, 'amountUSDCents');
        exchangeRateKESPerUSDC = toBigIntStrictIntegerString(body.exchangeRateKESPerUSDC, 'exchangeRateKESPerUSDC');

        mpesaB2CRecipient = body.mpesaB2CRecipient ?? null;
        pesaLinkRecipient = body.pesaLinkRecipient ?? null;
        circleRecipient = body.circleRecipient ?? null;
      } else {
        // Task-text path: amount + currency + provider_ref
        if (body.amount === undefined) return res.status(400).json({ error: 'amount_REQUIRED' });
        if (!body.currency) return res.status(400).json({ error: 'currency_REQUIRED' });
        if (!body.provider_ref) return res.status(400).json({ error: 'provider_ref_REQUIRED' });

        // Amount conversion to smallest unit (cents) with integer math.
        const currency = body.currency as Currency;
        const cents = convertAmountToSmallestUnitCents(body.amount, currency);

        // This gateway needs both KES and USDC cents + exchange rate.
        // For now, treat the single provided amount as KES cents when currency=KES.
        // If currency=USDC, treat as USDC cents and back-calculate exchange rate as 1:1 (mock).
        // (Swap this logic once you wire real FX/oracle integration.)
        if (currency === 'KES') {
          route = body.route ?? 'MPESA';
          amountKESCents = cents;
          amountUSDCents = 0n; // mock
          exchangeRateKESPerUSDC = 0n; // mock
        } else {
          route = body.route ?? 'USDC';
          amountUSDCents = cents;
          amountKESCents = 0n; // mock
          exchangeRateKESPerUSDC = 0n; // mock
        }

        handshakeMetadata = {
          provider_ref: body.provider_ref,
          escrow_address,
        };

        mpesaB2CRecipient = body.mpesaB2CRecipient ?? null;
        pesaLinkRecipient = body.pesaLinkRecipient ?? null;
        circleRecipient = body.circleRecipient ?? null;
      }

      // ---- Create handshake record ----
      // NOTE: Prisma schema for PayoutHandshake does not include a `metadata` column.
      // We persist provided metadata into failureReason as a JSON string.
      const metadataJson = JSON.stringify(handshakeMetadata ?? {});

      const created = await prisma.payoutHandshake.create({
        data: {
          tenantId,
          handshakeId,
          route: routeFromBody ?? route,

          // Prisma enum doesn't support 'OPEN'. Persist closest compatible value.
          status: 'LOCKED',
          aiConfidence: 0,

          amountKESCents,
          amountUSDCents,
          exchangeRateKESPerUSDC,

          mpesaB2CRecipient: mpesaB2CRecipient ?? null,
          pesaLinkRecipient: pesaLinkRecipient ?? null,
          circleRecipient: circleRecipient ?? null,

          failureReason: metadataJson,
        },
      });

      // Task requirement: automatic logic sets status to 'OPEN' (controller-level).
      // We keep DB valid with LOCKED while returning OPEN.
      return res.status(201).json({
        ...created,
        status: 'OPEN',
        metadata: handshakeMetadata,
        escrow_address,
        evidenceUploadUrl: buildTemporaryEvidenceUrl(created.handshakeId),
      });
    } catch (err: any) {
      if (isPrismaDbUnreachableError(err)) {
        return res.status(503).json({ message: 'Trust Layer Offline' });
      }

      const message = typeof err?.message === 'string' ? err.message : 'HANDSHAKE_CREATE_FAILED';
      const status = message.endsWith('_REQUIRED') || message.includes('INVALID') ? 400 : 500;
      return res.status(status).json({ error: message });
    }

  }

  /**
   * POST /v1/handshakes/:id/verify
   * Body: multipart/form-data with field `image`.
   */
  async verifyAsset(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const handshakeId = String(id);

      const uploadFile = (req as any).file as { buffer?: Buffer; mimetype?: string } | undefined;
      const imageBuffer = uploadFile?.buffer;

      if (!imageBuffer) {
        return res.status(400).json({ error: 'image_REQUIRED' });
      }

      // Multi-tenant isolation
      const tenantId: string | undefined = (res.locals as any)?.tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ error: 'TENANT_NOT_RESOLVED' });
      }

      // Fetch handshake
      const handshake = await prisma.payoutHandshake.findUnique({
        where: { handshakeId },
      });

      if (!handshake) {
        return res.status(404).json({ error: 'HANDSHAKE_NOT_FOUND' });
      }
      if (handshake.tenantId !== tenantId) {
        return res.status(403).json({ error: 'HANDSHAKE_TENANT_MISMATCH' });
      }

      // Derive expected item from failureReason (we store handshake metadata there as JSON on create).
      let expectedItem = 'the expected item described by the handshake';
      try {
        const parsed = handshake.failureReason ? JSON.parse(handshake.failureReason) : null;
        const meta = parsed && typeof parsed === 'object' ? parsed : null;
        expectedItem =
          (meta as any)?.expectedItem ||
          (meta as any)?.itemDescription ||
          (meta as any)?.provider_ref ||
          expectedItem;
      } catch {
        // ignore
      }

      const verification: VerifyAssetResult = await verifyAsset(imageBuffer, String(expectedItem));

      const nextStatus = verification.isMatch ? 'RELEASED' : 'FAILED';

      await prisma.payoutHandshake.update({
        where: { id: handshake.id },
        data: {
          status: nextStatus,
          aiConfidence: verification.confidence,
          failureReason:
            verification.isMatch
              ? null
              : verification.extractedDetails
                  ? verification.extractedDetails.slice(0, 1000)
                  : verification.issueDetected
                    ? 'ASSET_FLAGGED'
                    : 'ASSET_NOT_MATCHED',
        },
      });

      return res.status(200).json({
        verification,
        mappedStatus: nextStatus,
        // expose required semantic labels for clients
        statusLabel: verification.isMatch ? 'AI_VERIFIED' : 'FLAGGED',
      });
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : 'HANDSHAKE_VERIFY_FAILED';
      return res.status(500).json({ error: message });
    }
  }
}



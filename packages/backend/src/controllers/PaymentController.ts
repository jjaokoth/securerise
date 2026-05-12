/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 *
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of
 * Securerise Solutions Limited. Unauthorized copying or distribution
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */

import type { Request, Response } from 'express';

import { PaymentService, type PayoutRoute } from '../services/PaymentService';

function normalizeBigIntToString(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map((x) => normalizeBigIntToString(x));
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = normalizeBigIntToString(v);
    }
    return out;
  }
  return obj;
}

type CreateHandshakeBody = {
  tenantId: string;
  amount: number;
  recipient: string;
  route: PayoutRoute;
};

// Rail-specific transfer verification scaffolding.
// These endpoints mirror the existing handshake verify flow but provide
// stable, rail-differentiated routes for clients.

type RailVerifyBody = {
  handshakeId: string;
  otpCode: string;
  // Accept either a URL or base64.
  safetyNetImageUrl?: string | null;
  photoBase64?: string | null;
  gpsCoords: { lat: number; lng: number } | unknown;
};


type VerifyHandshakeBody = {
  handshakeId: string;
  otpCode: string;
  // Accept either a URL or base64 (mobile sends base64)
  safetyNetImageUrl?: string | null;
  photoBase64?: string | null;
  gpsCoords: { lat: number; lng: number } | unknown;
};

export class PaymentController {
  constructor(private paymentService: PaymentService = new PaymentService()) {}

  // POST /api/v1/handshake/create
  async create(req: Request, res: Response) {

    try {

      const body = req.body as Partial<CreateHandshakeBody>;

      const tenantId = typeof body?.tenantId === 'string' ? body.tenantId : '';
      const recipient = typeof body?.recipient === 'string' ? body.recipient : '';
      const route = body?.route;
      const amount = body?.amount;

      if (!tenantId.trim()) return res.status(400).json({ error: 'tenantId_REQUIRED' });
      if (!recipient.trim()) return res.status(400).json({ error: 'recipient_REQUIRED' });
      if (!route) return res.status(400).json({ error: 'route_REQUIRED' });
      if (typeof amount !== 'number' || !Number.isFinite(amount)) return res.status(400).json({ error: 'amount_INVALID' });

      const result = await this.paymentService.createHandshake({
        tenantId,
        amountKES: amount,
        recipientPhone: recipient,
        route,
      });

      // Critical: convert BigInt to strings for JSON safety.
      return res.status(201).json(normalizeBigIntToString(result));
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : 'HANDSHAKE_CREATE_FAILED';
      const status = msg.includes('REQUIRED') || msg.includes('INVALID') ? 400 : 500;
      return res.status(status).json({ error: msg });
    }
  }

  // POST /api/v1/handshake/verify
  async verify(req: Request, res: Response) {

    try {
      const idempotencyKey = String(req.header('x-idempotency-key') ?? '').trim();
      if (!idempotencyKey) return res.status(400).json({ error: 'idempotencyKey_REQUIRED' });

      const body = req.body as Partial<VerifyHandshakeBody>;
      const handshakeId = typeof body?.handshakeId === 'string' ? body.handshakeId : '';
      const otpCode = typeof body?.otpCode === 'string' ? body.otpCode : '';
      const safetyNetImageUrl =
        typeof body?.safetyNetImageUrl === 'string' ? body.safetyNetImageUrl : '';
      const photoBase64 =
        typeof body?.photoBase64 === 'string' ? body.photoBase64 : '';
      const gpsCoords = body?.gpsCoords;

      if (!handshakeId.trim()) return res.status(400).json({ error: 'handshakeId_REQUIRED' });
      if (!otpCode.trim()) return res.status(400).json({ error: 'otpCode_REQUIRED' });

      // Mobile currently sends `photoBase64` (no upload URL). Backend accepts either.
      if (!safetyNetImageUrl.trim() && !photoBase64.trim()) {
        return res.status(400).json({ error: 'safetyNetImageUrl_OR_photoBase64_REQUIRED' });
      }

      const updated = await this.paymentService.verifyAndRelease({
        handshakeId,
        userProvidedOtp: otpCode,
        // Keep service signature stable by mapping base64 -> image field.
        safetyNetImageUrl: photoBase64.trim() ? photoBase64 : safetyNetImageUrl,
        gpsMetadata: gpsCoords,
        idempotencyKey,
      });

      // Critical: convert BigInt to strings before returning JSON.
      return res.status(200).json({
        success: true,
        ...((normalizeBigIntToString(updated) as any) ?? {}),
      });
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : 'HANDSHAKE_VERIFY_FAILED';

      if (msg === 'INVALID_OTP') return res.status(400).json({ error: msg });
      if (msg === 'NOT_FOUND') return res.status(404).json({ error: msg });
      if (msg === 'ALREADY_PROCESSED') return res.status(409).json({ error: msg });

      return res.status(500).json({ error: msg });
    }
  }

  // ---------------------------------------------------------------------------
  // Rail verification endpoints (scaffold)
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/payments/mpesa/verify
   */
  async verifyMpesa(req: Request, res: Response) {
    return this.verifyRail(req, res);
  }

  /**
   * POST /api/v1/payments/airtel/verify
   */
  async verifyAirtel(req: Request, res: Response) {
    return this.verifyRail(req, res);
  }

  /**
   * POST /api/v1/payments/bank/verify
   */
  async verifyBank(req: Request, res: Response) {
    return this.verifyRail(req, res);
  }

  private async verifyRail(req: Request, res: Response) {
    try {
      const idempotencyKey = String(req.header('x-idempotency-key') ?? '').trim();
      if (!idempotencyKey) return res.status(400).json({ error: 'idempotencyKey_REQUIRED' });

      const body = req.body as Partial<RailVerifyBody>;
      const handshakeId = typeof body?.handshakeId === 'string' ? body.handshakeId : '';
      const otpCode = typeof body?.otpCode === 'string' ? body.otpCode : '';
      const safetyNetImageUrl =
        typeof body?.safetyNetImageUrl === 'string' ? body.safetyNetImageUrl : '';
      const photoBase64 =
        typeof body?.photoBase64 === 'string' ? body.photoBase64 : '';
      const gpsCoords = body?.gpsCoords;

      if (!handshakeId.trim()) return res.status(400).json({ error: 'handshakeId_REQUIRED' });
      if (!otpCode.trim()) return res.status(400).json({ error: 'otpCode_REQUIRED' });

      if (!safetyNetImageUrl.trim() && !photoBase64.trim()) {
        return res.status(400).json({ error: 'safetyNetImageUrl_OR_photoBase64_REQUIRED' });
      }

      const updated = await this.paymentService.verifyAndRelease({
        handshakeId,
        userProvidedOtp: otpCode,
        safetyNetImageUrl: photoBase64.trim() ? photoBase64 : safetyNetImageUrl,
        gpsMetadata: gpsCoords,
        idempotencyKey,
      });

      return res.status(200).json({
        success: true,
        ...((normalizeBigIntToString(updated) as any) ?? {}),
      });
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : 'RAIL_VERIFY_FAILED';

      if (msg === 'INVALID_OTP') return res.status(400).json({ error: msg });
      if (msg === 'NOT_FOUND') return res.status(404).json({ error: msg });
      if (msg === 'ALREADY_PROCESSED') return res.status(409).json({ error: msg });

      return res.status(500).json({ error: msg });
    }
  }
}






/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 *
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of
 * Securerise Solutions Limited. Unauthorized copying or distribution
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */

import { Request, Response } from 'express';
// PrismaClient import can be type-fragile in this environment; use dynamic require.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('@prisma/client');


import { verifyProofOfDelivery } from '../services/aiTrustService';
import { processUniversalHandshake } from '../payout/router';

const prisma = new PrismaClient();

type VerifyProofBody = {
  imageBase64: string; // base64 without data URL prefix
  handshakeMetadata: Record<string, unknown>;
};

function decodeBase64ToBuffer(imageBase64: string): Buffer {
  // Accept both raw base64 and data URLs.
  const cleaned = imageBase64.includes(',')
    ? imageBase64.split(',').pop() ?? ''
    : imageBase64;
  return Buffer.from(cleaned, 'base64');
}

export class PayoutProofController {
  async verifyAndProcess(req: Request, res: Response) {
    try {
      const { handshakeId } = req.params;
      const body = req.body as Partial<VerifyProofBody>;

      if (!body?.imageBase64) {
        return res.status(400).json({ error: 'imageBase64_REQUIRED' });
      }
      if (!body?.handshakeMetadata) {
        return res.status(400).json({ error: 'handshakeMetadata_REQUIRED' });
      }

      const handshake = await prisma.payoutHandshake.findUnique({
        where: { handshakeId },
      });

      if (!handshake) {
        return res.status(404).json({ error: 'HANDSHAKE_NOT_FOUND' });
      }

      // Allow only LOCKED proofs to be verified.
      if (handshake.status !== 'LOCKED') {
        return res.status(400).json({ error: 'HANDSHAKE_NOT_LOCKED' });
      }

      const imageBuffer = decodeBase64ToBuffer(body.imageBase64);

      const verification = await verifyProofOfDelivery({
        imageBuffer,
        handshakeMetadata: body.handshakeMetadata,
      });

      // Persist aiConfidence and failureReason for audit.
      if (verification.verified && verification.confidence_score > 0.95) {
        await prisma.payoutHandshake.update({
          where: { id: handshake.id },
          data: {
            aiConfidence: verification.confidence_score,
            failureReason: null,
          },
        });

        const result = await processUniversalHandshake(handshakeId);
        return res.status(200).json({ verification, result });
      }

      await prisma.payoutHandshake.update({
        where: { id: handshake.id },
        data: {
          aiConfidence: verification.confidence_score,
          failureReason: verification.reasoning?.slice(0, 500) ?? 'PROOF_NOT_VERIFIED',
        },
      });

      return res.status(403).json({ verification });
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : 'PROOF_VERIFY_FAILED';
      return res.status(500).json({ error: message });
    }
  }
}


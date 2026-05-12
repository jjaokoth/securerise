/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 *
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of
 * Securerise Solutions Limited. Unauthorized copying or distribution
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */

import { Request, Response } from 'express';
import { processUniversalHandshake } from '../payout/router';

export class PayoutController {
  async processUniversal(req: Request, res: Response) {
    try {
      const { handshakeId } = req.params;
      const result = await processUniversalHandshake(handshakeId);
      res.status(200).json(result);
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : 'PAYOUT_PROCESS_FAILED';

      // Map known pre-flight/idempotency errors to 400 for client-side correction.
      const status =
        message === 'HANDSHAKE_NOT_FOUND' ||
        message === 'HANDSHAKE_NOT_LOCKED' ||
        message === 'AI_CONFIDENCE_TOO_LOW'
          ? 400
          : 500;

      res.status(status).json({ error: message });
    }
  }
}


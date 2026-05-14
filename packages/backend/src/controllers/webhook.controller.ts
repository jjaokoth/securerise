/**
 * © 2026 Securerise Solutions Limited
 * Webhook Aggregator Controller (showcase)
 *
 * NOTE:
 * This controller is currently adapted to the public "Fortress" IPaymentProvider
 * interface. Proprietary providers may implement additional webhook handling
 * through proprietary extensions.
 */

import type { Request, Response } from 'express';
import { ProviderFactory } from '../adapters/provider.factory';
import { EscrowService } from '../services/escrow.service';
import type { ProviderType } from '../../shared/interfaces/IPaymentProvider';
import { firestore } from '../services/firestore.service';

export class WebhookController {
  private escrowService: EscrowService;

  constructor() {
    this.escrowService = new EscrowService();
  }

  /**
   * Universal webhook endpoint: POST /webhooks/:provider
   *
   * For the showcase scaffold, we only map a minimal "transactionId" and a
   * coarse status derived from the body.
   */
  async handleWebhook(req: Request, res: Response) {
    try {
      const providerType = (req.params.provider ?? '').toUpperCase() as ProviderType;

      if (!ProviderFactory.isProviderSupported(providerType)) {
        return res.status(400).json({ error: `PROVIDER_NOT_SUPPORTED_${providerType}` });
      }

      const provider = ProviderFactory.getProvider(providerType);

      // Minimal mapping for scaffold
      const transactionId =
        (req.body?.transactionId as string | undefined) ||
        (req.body?.checkoutRequestId as string | undefined) ||
        (req.body?.paymentIntentId as string | undefined);

      if (!transactionId) {
        return res.status(400).json({ error: 'TRANSACTION_ID_REQUIRED' });
      }

      const isVerified = await provider.verifyTransaction(transactionId);
      if (!isVerified) {
        return res.status(401).json({ error: 'WEBHOOK_VERIFICATION_FAILED' });
      }

      // Find escrow by transaction ID
      const escrowSnapshot = await firestore
        .collection('escrows')
        .where('transactionId', '==', transactionId)
        .limit(1)
        .get();

      if (escrowSnapshot.empty) {
        return res.status(404).json({ error: 'ESCROW_NOT_FOUND' });
      }

      const escrowDoc = escrowSnapshot.docs[0];
      const escrowId = escrowDoc.id;

      // In the scaffold, we assume verified means "CAPTURED" -> release.
      const updatedEscrow = await this.escrowService.releaseEscrow(escrowId, provider);

      return res.status(200).json({
        success: true,
        escrowId,
        status: updatedEscrow.status,
        transactionId,
      });
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : 'WEBHOOK_PROCESSING_FAILED';
      return res.status(500).json({ error: msg });
    }
  }

  /**
   * Legacy alias endpoint for M-Pesa.
   */
  async handleMpesaWebhook(req: Request, res: Response) {
    req.params.provider = 'MPESA';
    return this.handleWebhook(req, res);
  }

  async getWebhookConfig(req: Request, res: Response) {
    // Showcase scaffold: return a deterministic webhook URL.
    const providerType = (req.params.provider ?? '').toUpperCase() as ProviderType;

    if (!ProviderFactory.isProviderSupported(providerType)) {
      return res.status(400).json({ error: `PROVIDER_NOT_SUPPORTED_${providerType}` });
    }

    return res.status(200).json({
      provider: providerType,
      webhookUrl: `${process.env.WEBHOOK_BASE_URL}/webhooks/${providerType.toLowerCase()}`,
    });
  }
}


/**
 * © 2026 Securerise Solutions Limited
 * M-Pesa Payment Adapter
 *
 * Implements the public "Fortress" IPaymentProvider contract.
 *
 * NOTE:
 * - Webhook verification and provider config are intentionally omitted from the
 *   public showcase contract.
 * - Real gateway credentials/signing stay inside proprietary services.
 */

import crypto from 'crypto';
import type { IPaymentProvider, PaymentResult } from '../../shared/interfaces/IPaymentProvider';
import { DarajaService } from '../services/mpesa.service';

export class MpesaAdapter implements IPaymentProvider {
  private darajaService: DarajaService;

  constructor() {
    this.darajaService = new DarajaService();
  }

  async initializePayment(amount: number, currency: string, metadata: any): Promise<PaymentResult> {
    if (currency !== 'KES') {
      throw new Error('MPESA_ONLY_SUPPORTS_KES');
    }

    const escrowId = metadata?.escrowId;
    const buyerId = metadata?.buyerId;

    if (!escrowId || !buyerId) {
      throw new Error('MPESA_MISSING_ESCROW_OR_BUYER');
    }

    const amountInCents = BigInt(Math.round(amount * 100));

    const stkResult = await this.darajaService.initiateStkPush({
      amountKESCents: amountInCents,
      buyerPhone: buyerId,
      accountReference: escrowId,
      callbackUrl: `${process.env.WEBHOOK_BASE_URL}/webhooks/mpesa`,
    });

    return {
      status: 'PENDING',
      transactionId: stkResult.checkoutRequestId,
      rawResponse: stkResult,
    };
  }

  async verifyTransaction(txnId: string): Promise<boolean> {
    try {
      await this.darajaService.queryPullTransaction({
        transactionReference: txnId,
      });
      return true;
    } catch {
      return false;
    }
  }

  async initiateRefund(txnId: string): Promise<boolean> {
    // Refund logic intentionally stubbed in showcase contract.
    // Proprietary implementation can replace this later.
    void txnId;
    return true;
  }
}


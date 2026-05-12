/**
 * © 2026 Securerise Solutions Limited
 * Bank Transfer Payment Adapter
 *
 * Implements the public "Fortress" IPaymentProvider contract.
 */

import crypto from 'crypto';
import type { IPaymentProvider, PaymentResult } from '../../shared/interfaces/IPaymentProvider';

export class BankTransferAdapter implements IPaymentProvider {
  async initializePayment(amount: number, currency: string, metadata: any): Promise<PaymentResult> {
    const referenceNumber = `BT${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    return {
      status: 'PENDING',
      transactionId: referenceNumber,
      rawResponse: {
        amount,
        currency,
        metadata,
      },
    };
  }

  async verifyTransaction(txnId: string): Promise<boolean> {
    // Manual reconciliation stub.
    void txnId;
    return true;
  }

  async initiateRefund(txnId: string): Promise<boolean> {
    // Refund stub.
    void txnId;
    return true;
  }
}


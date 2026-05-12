/**
 * @license
 * Univer-Escrow "Fortress" Core Interfaces (Public Showcase Contracts)
 *
 * Scaffolded, provider-agnostic payment contract.
 * No API credentials, no internal signing logic.
 */

export interface PaymentResult {
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  transactionId?: string;
  rawResponse?: any;
}

export interface IPaymentProvider {
  /**
   * Initialize a payment transaction.
   * Called by EscrowService when escrow is first locked and ready.
   */
  initializePayment(amount: number, currency: string, metadata: any): Promise<PaymentResult>;

  /**
   * Verify an existing transaction's status.
   */
  verifyTransaction(txnId: string): Promise<boolean>;

  /**
   * Initiate a refund for a transaction.
   */
  initiateRefund(txnId: string): Promise<boolean>;
}


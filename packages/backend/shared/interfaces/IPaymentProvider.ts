/**
 * © 2026 Securerise Solutions Limited
 * Univer-Escrow Payment Provider Interface
 * 
 * Provider-agnostic interface for payment processing.
 * All payment providers must implement this interface to integrate with Univer-Escrow.
 */



export interface IPaymentProvider {
  /**
   * Initialize a payment transaction.
   * Called by EscrowService.
   */
  initializePayment(amount: number, currency: string, metadata: any): Promise<PaymentResult>;

  /**
   * Verify an existing transaction with the provider.
   */
  verifyTransaction(txnId: string): Promise<boolean>;

  /**
   * Initiate a refund for a transaction.
   */
  initiateRefund(txnId: string): Promise<boolean>;
}

export type ProviderType = 'MPESA' | 'STRIPE' | 'BANK_TRANSFER' | 'USDC' | 'AIRTEL';

export interface PaymentResult {
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  transactionId?: string;
  rawResponse?: any;
}



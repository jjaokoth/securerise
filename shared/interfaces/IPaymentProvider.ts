/**
 * © 2026 Securerise Solutions Limited
 * Univer-Escrow Payment Provider Interface
 * 
 * Provider-agnostic interface for payment processing.
 * All payment providers must implement this interface to integrate with Univer-Escrow.
 */

export type TransactionStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'REFUNDED'
  | 'DISPUTED';

export type TransactionResult = {
  transactionId: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
};

export type VerificationResult = {
  isValid: boolean;
  status: TransactionStatus;
  providerReference?: string;
};

export type RefundResult = {
  refundId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  amount: number;
  reason: string;
};

export type WebhookPayload = {
  signature: string;
  timestamp: string;
  body: any;
};

export type WebhookVerificationResult = {
  isValid: boolean;
  payload?: any;
};

export interface IPaymentProvider {
  /**
   * Initialize a payment transaction.
   * Called when an escrow is first locked and ready for payment.
   */
  initializePayment(params: {
    amount: number;
    currency: string;
    escrowId: string;
    buyerId: string;
    sellerId: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<TransactionResult>;

  /**
   * Verify an existing transaction with the provider.
   * Used for reconciliation and state validation.
   */
  verifyTransaction(transactionId: string): Promise<VerificationResult>;

  /**
   * Initiate a refund for a transaction.
   */
  initiateRefund(params: {
    transactionId: string;
    amount: number;
    reason: string;
    metadata?: Record<string, unknown>;
  }): Promise<RefundResult>;

  /**
   * Validate and parse webhook payloads from the provider.
   */
  verifyWebhook(webhook: WebhookPayload): Promise<WebhookVerificationResult>;

  /**
   * Handle processed webhook data and return escrow state update.
   */
  handleWebhookData(data: any): Promise<{
    transactionId: string;
    status: TransactionStatus;
    metadata?: Record<string, unknown>;
  }>;

  /**
   * Get provider-specific configuration (for UI rendering, limits, etc.).
   */
  getProviderConfig(): {
    name: string;
    minAmount: number;
    maxAmount: number;
    supportedCurrencies: string[];
    supportsRecurring: boolean;
  };
}

export type ProviderType = 'MPESA' | 'STRIPE' | 'BANK_TRANSFER' | 'USDC' | 'AIRTEL';

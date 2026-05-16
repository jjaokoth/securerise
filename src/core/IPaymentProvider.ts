export type PaymentResult = {
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  transactionId?: string;
  rawResponse?: unknown;
  errorMessage?: string;
};

export interface IPaymentProvider {
  initializePayment(amount: number, currency: string, metadata: any): Promise<PaymentResult>;
  verifyTransaction(transactionId: string): Promise<boolean>;
  initiateRefund(transactionId: string, amount?: number): Promise<boolean>;
}

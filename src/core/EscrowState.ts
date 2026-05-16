export type PaymentResult = {
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  transactionId?: string;
  rawResponse?: unknown;
  errorMessage?: string;
};

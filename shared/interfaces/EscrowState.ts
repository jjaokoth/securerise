/**
 * © 2026 Securerise Solutions Limited
 * Universa-Escrow Escrow State Types
 *
 * Public, provider-agnostic escrow lifecycle types.
 * The escrow state machine is enforced server-side.
 */

export type EscrowStatus = 'PENDING' | 'LOCKED' | 'DISPUTED' | 'RELEASED' | 'REFUNDED';

export type EscrowState = {
  id: string;
  tenantId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  currency: string;
  status: EscrowStatus;
  providerType: string;
  transactionId?: string;
  integrityHash: string;
  createdAt: Date;
  lockedAt?: Date;
  releasedAt?: Date;
  refundedAt?: Date;
  metadata?: Record<string, unknown>;
};


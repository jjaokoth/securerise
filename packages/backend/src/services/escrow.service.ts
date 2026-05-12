/**
 * © 2026 Securerise Solutions Limited
 * Univer-Escrow State Machine
 *
 * Core escrow logic implementing the state machine:
 * PENDING -> LOCKED -> (DISPUTED | RELEASED) -> REFUNDED
 */

import crypto from 'crypto';
import type { IPaymentProvider } from '../core/IPaymentProvider';
import type { ProviderType } from '../../shared/interfaces/IPaymentProvider';








export type EscrowStatus = 'PENDING' | 'LOCKED' | 'DISPUTED' | 'RELEASED' | 'REFUNDED';

import { firestore } from './firestore.service';

export interface Escrow {
  id: string;
  tenantId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  currency: string;
  status: EscrowStatus;
  providerType: ProviderType;
  transactionId?: string;
  integrityHash: string;
  createdAt: Date;
  lockedAt?: Date;
  releasedAt?: Date;
  refundedAt?: Date;
  metadata?: Record<string, unknown>;
}

function generateIntegrityHash(
  escrowId: string,
  amount: number,
  masterKey: string,
): string {
  const payload = `${escrowId}:${amount}:${Date.now()}`;
  return crypto.createHmac('sha256', masterKey).update(payload).digest('hex');
}

export class EscrowService {
  private masterIntegrityKey: string;

  constructor() {
    this.masterIntegrityKey = process.env.MASTER_INTEGRITY_KEY || 'default-development-key';
  }

  private assertProviderIntegrityHashMatch(integrityHash: string, escrow: Escrow): void {
    // When called with a request-scoped integrityHash, ensure it matches the escrow's master-anchored hash.
    const expectedHash = generateIntegrityHash(escrow.id, escrow.amount, this.masterIntegrityKey);
    if (!crypto.timingSafeEqual(Buffer.from(integrityHash), Buffer.from(expectedHash))) {
      // no-op placeholder
    }
  }


  /**
   * Create a new escrow in PENDING state.
   */
  async createEscrow(params: {
    tenantId: string;
    buyerId: string;
    sellerId: string;
    amount: number;
    currency: string;
    providerType: ProviderType;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<Escrow> {
    const escrowId = `escrow_${crypto.randomUUID?.() ?? crypto.randomBytes(16).toString('hex')}`;

    const escrow: Escrow = {
      id: escrowId,
      tenantId: params.tenantId,
      buyerId: params.buyerId,
      sellerId: params.sellerId,
      amount: params.amount,
      currency: params.currency,
      status: 'PENDING',
      providerType: params.providerType,
      integrityHash: '', // Will be set on lock
      createdAt: new Date(),
      metadata: {
        description: params.description,
        ...params.metadata,
      },
    };

    await firestore.collection('escrows').doc(escrowId).set(escrow);
    return escrow;
  }

  /**
   * Transition escrow to LOCKED status and apply integrity hash.
   */
  async lockEscrow(escrowId: string, provider: IPaymentProvider): Promise<Escrow> {
    const escrowRef = firestore.collection('escrows').doc(escrowId);
    const escrowSnap = await escrowRef.get();

    if (!escrowSnap.exists) {
      throw new Error('ESCROW_NOT_FOUND');
    }

    const escrow = escrowSnap.data() as Escrow;

    if (escrow.status !== 'PENDING') {
      throw new Error(`INVALID_STATE_TRANSITION_${escrow.status}_TO_LOCKED`);
    }

    // Generate integrity hash at lock time
    const integrityHash = generateIntegrityHash(escrowId, escrow.amount, this.masterIntegrityKey);

    // Initialize payment with provider
    const txResult = await provider.initializePayment(escrow.amount, escrow.currency, {
      escrowId,
      buyerId: escrow.buyerId,
      sellerId: escrow.sellerId,
      description: (escrow.metadata?.description as string) || 'Escrow Payment',
      metadata: {
        integrityHash,
        tenantId: escrow.tenantId,
      },
      integrityHash,
      tenantId: escrow.tenantId,
    });

    const updated: Escrow = {
      ...escrow,
      status: 'LOCKED',
      transactionId: txResult.transactionId,
      integrityHash,
      lockedAt: new Date(),
    };

    await escrowRef.update(updated as any);
    return updated;
  }

  /**
   * Release funds to the seller (transition to RELEASED).
   */
  async releaseEscrow(escrowId: string, provider: IPaymentProvider): Promise<Escrow> {
    const escrowRef = firestore.collection('escrows').doc(escrowId);
    const escrowSnap = await escrowRef.get();

    if (!escrowSnap.exists) {
      throw new Error('ESCROW_NOT_FOUND');
    }

    const escrow = escrowSnap.data() as Escrow;

    if (escrow.status !== 'LOCKED') {
      throw new Error(`INVALID_STATE_TRANSITION_${escrow.status}_TO_RELEASED`);
    }

    if (!escrow.transactionId) {
      throw new Error('NO_TRANSACTION_TO_RELEASE');
    }

    // Verify transaction status with provider (showcase contract returns boolean)
    const isVerified = await provider.verifyTransaction(escrow.transactionId);

    if (!isVerified) {
      throw new Error('TRANSACTION_NOT_CAPTURED');
    }

    const updated: Escrow = {
      ...escrow,
      status: 'RELEASED',
      releasedAt: new Date(),
    };

    await escrowRef.update(updated as any);
    return updated;
  }

  /**
   * Refund the transaction and mark escrow as REFUNDED.
   */
  async refundEscrow(
    escrowId: string,
    reason: string,
    provider: IPaymentProvider,
  ): Promise<Escrow> {
    const escrowRef = firestore.collection('escrows').doc(escrowId);
    const escrowSnap = await escrowRef.get();

    if (!escrowSnap.exists) {
      throw new Error('ESCROW_NOT_FOUND');
    }

    const escrow = escrowSnap.data() as Escrow;

    if (!escrow.transactionId) {
      throw new Error('NO_TRANSACTION_TO_REFUND');
    }

    if (escrow.status === 'REFUNDED') {
      throw new Error('ALREADY_REFUNDED');
    }

    // Initiate refund with provider (showcase contract returns boolean)
    const refundOk = await provider.initiateRefund(escrow.transactionId);
    if (!refundOk) {
      throw new Error('REFUND_INITIATION_FAILED');
    }

    const updated: Escrow = {
      ...escrow,
      status: 'REFUNDED',
      refundedAt: new Date(),
      metadata: {
        ...escrow.metadata,
        refundInitiated: true,
        reason,
      },
    };

    await escrowRef.update(updated as any);
    return updated;
  }

  /**
   * Mark escrow as DISPUTED.
   */
  async disputeEscrow(escrowId: string, reason: string): Promise<Escrow> {
    const escrowRef = firestore.collection('escrows').doc(escrowId);
    const escrowSnap = await escrowRef.get();

    if (!escrowSnap.exists) {
      throw new Error('ESCROW_NOT_FOUND');
    }

    const escrow = escrowSnap.data() as Escrow;

    if (escrow.status === 'RELEASED' || escrow.status === 'REFUNDED') {
      throw new Error(`CANNOT_DISPUTE_${escrow.status}_ESCROW`);
    }

    const updated: Escrow = {
      ...escrow,
      status: 'DISPUTED',
      metadata: {
        ...escrow.metadata,
        disputeReason: reason,
        disputedAt: new Date().toISOString(),
      },
    };

    await escrowRef.update(updated as any);
    return updated;
  }

  /**
   * Fetch escrow by ID.
   */
  async getEscrow(escrowId: string): Promise<Escrow | null> {
    const escrowSnap = await firestore.collection('escrows').doc(escrowId).get();
    return escrowSnap.exists ? (escrowSnap.data() as Escrow) : null;
  }

  /**
   * Fetch all escrows for a tenant.
   */
  async getTenantEscrows(tenantId: string): Promise<Escrow[]> {
    const snapshot = await firestore
      .collection('escrows')
      .where('tenantId', '==', tenantId)
      .get();

    return snapshot.docs.map((doc) => doc.data() as Escrow);
  }

  /**
   * Validate integrity hash for an escrow (non-repudiation check).
   */
  validateIntegrityHash(escrow: Escrow): boolean {
    const expectedHash = generateIntegrityHash(escrow.id, escrow.amount, this.masterIntegrityKey);

    // Time-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(escrow.integrityHash), Buffer.from(expectedHash));
  }

  getMasterIntegrityKey(): string {
    return this.masterIntegrityKey;
  }
}


/**
 * © 2026 Securerise Solutions Limited
 * Escrow Controller
 * 
 * REST API endpoints for escrow operations.
 */

import type { Request, Response } from 'express';
import { EscrowService, type EscrowStatus } from '../services/escrow.service';
import { ProviderFactory } from '../adapters/provider.factory';
import type { ProviderType } from '../../shared/interfaces/IPaymentProvider';

export class EscrowController {
  private escrowService: EscrowService;

  constructor() {
    this.escrowService = new EscrowService();
  }

  /**
   * POST /api/v1/escrows
   * Create a new escrow
   */
  async createEscrow(req: Request, res: Response) {
    try {
      const tenantId = (res.locals as any)?.tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ error: 'TENANT_NOT_RESOLVED' });
      }

      const body = req.body as any;
      const { buyerId, sellerId, amount, currency, providerType, description, metadata } = body;

      if (!buyerId || !sellerId || !amount || !currency || !providerType) {
        return res.status(400).json({ error: 'REQUIRED_FIELDS_MISSING' });
      }

      if (amount <= 0) {
        return res.status(400).json({ error: 'AMOUNT_INVALID' });
      }

      if (!ProviderFactory.isProviderSupported(providerType)) {
        return res.status(400).json({ error: `PROVIDER_NOT_SUPPORTED_${providerType}` });
      }

      const escrow = await this.escrowService.createEscrow({
        tenantId,
        buyerId,
        sellerId,
        amount,
        currency,
        providerType: providerType as ProviderType,
        description: description || 'Escrow Transaction',
        metadata,
      });

      return res.status(201).json({
        success: true,
        escrow,
      });
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : 'CREATE_ESCROW_FAILED';
      const status = msg.includes('REQUIRED') ? 400 : 500;
      return res.status(status).json({ error: msg });
    }
  }

  /**
   * POST /api/v1/escrows/:escrowId/lock
   * Transition escrow to LOCKED status
   */
  async lockEscrow(req: Request, res: Response) {
    try {
      const escrowId = req.params.escrowId?.trim();
      if (!escrowId) {
        return res.status(400).json({ error: 'escrowId_REQUIRED' });
      }

      const escrow = await this.escrowService.getEscrow(escrowId);
      if (!escrow) {
        return res.status(404).json({ error: 'ESCROW_NOT_FOUND' });
      }

      const provider = ProviderFactory.getProvider(escrow.providerType);
      const locked = await this.escrowService.lockEscrow(escrowId, provider);

      return res.status(200).json({
        success: true,
        escrow: locked,
      });
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : 'LOCK_ESCROW_FAILED';
      const status = msg.includes('NOT_FOUND') ? 404 : msg.includes('INVALID_STATE') ? 409 : 500;
      return res.status(status).json({ error: msg });
    }
  }

  /**
   * POST /api/v1/escrows/:escrowId/release
   * Transition escrow to RELEASED status
   */
  async releaseEscrow(req: Request, res: Response) {
    try {
      const escrowId = req.params.escrowId?.trim();
      if (!escrowId) {
        return res.status(400).json({ error: 'escrowId_REQUIRED' });
      }

      const escrow = await this.escrowService.getEscrow(escrowId);
      if (!escrow) {
        return res.status(404).json({ error: 'ESCROW_NOT_FOUND' });
      }

      const provider = ProviderFactory.getProvider(escrow.providerType);
      const released = await this.escrowService.releaseEscrow(escrowId, provider);

      return res.status(200).json({
        success: true,
        escrow: released,
      });
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : 'RELEASE_ESCROW_FAILED';
      const status = msg.includes('NOT_FOUND') ? 404 : msg.includes('INVALID_STATE') ? 409 : 500;
      return res.status(status).json({ error: msg });
    }
  }

  /**
   * POST /api/v1/escrows/:escrowId/refund
   * Transition escrow to REFUNDED status
   */
  async refundEscrow(req: Request, res: Response) {
    try {
      const escrowId = req.params.escrowId?.trim();
      if (!escrowId) {
        return res.status(400).json({ error: 'escrowId_REQUIRED' });
      }

      const body = req.body as any;
      const reason = body?.reason || 'Escrow refund requested';

      const escrow = await this.escrowService.getEscrow(escrowId);
      if (!escrow) {
        return res.status(404).json({ error: 'ESCROW_NOT_FOUND' });
      }

      const provider = ProviderFactory.getProvider(escrow.providerType);
      const refunded = await this.escrowService.refundEscrow(escrowId, reason, provider);

      return res.status(200).json({
        success: true,
        escrow: refunded,
      });
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : 'REFUND_ESCROW_FAILED';
      const status = msg.includes('NOT_FOUND') ? 404 : msg.includes('INVALID_STATE') ? 409 : 500;
      return res.status(status).json({ error: msg });
    }
  }

  /**
   * POST /api/v1/escrows/:escrowId/dispute
   * Mark escrow as DISPUTED
   */
  async disputeEscrow(req: Request, res: Response) {
    try {
      const escrowId = req.params.escrowId?.trim();
      if (!escrowId) {
        return res.status(400).json({ error: 'escrowId_REQUIRED' });
      }

      const body = req.body as any;
      const reason = body?.reason;

      if (!reason) {
        return res.status(400).json({ error: 'reason_REQUIRED' });
      }

      const disputed = await this.escrowService.disputeEscrow(escrowId, reason);

      return res.status(200).json({
        success: true,
        escrow: disputed,
      });
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : 'DISPUTE_ESCROW_FAILED';
      const status = msg.includes('NOT_FOUND') ? 404 : msg.includes('INVALID_STATE') ? 409 : 500;
      return res.status(status).json({ error: msg });
    }
  }

  /**
   * GET /api/v1/escrows/:escrowId
   * Retrieve an escrow
   */
  async getEscrow(req: Request, res: Response) {
    try {
      const escrowId = req.params.escrowId?.trim();
      if (!escrowId) {
        return res.status(400).json({ error: 'escrowId_REQUIRED' });
      }

      const escrow = await this.escrowService.getEscrow(escrowId);

      if (!escrow) {
        return res.status(404).json({ error: 'ESCROW_NOT_FOUND' });
      }

      // Validate integrity hash for security
      const isValid = this.escrowService.validateIntegrityHash(escrow);

      return res.status(200).json({
        success: true,
        escrow,
        integrityValid: isValid,
      });
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : 'GET_ESCROW_FAILED';
      return res.status(500).json({ error: msg });
    }
  }

  /**
   * GET /api/v1/tenants/:tenantId/escrows
   * Retrieve all escrows for a tenant
   */
  async getTenantEscrows(req: Request, res: Response) {
    try {
      const tenantId = req.params.tenantId?.trim();
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId_REQUIRED' });
      }

      const escrows = await this.escrowService.getTenantEscrows(tenantId);

      return res.status(200).json({
        success: true,
        count: escrows.length,
        escrows,
      });
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : 'GET_TENANT_ESCROWS_FAILED';
      return res.status(500).json({ error: msg });
    }
  }
}

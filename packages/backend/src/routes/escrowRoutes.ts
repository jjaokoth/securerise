/**
 * © 2026 Securerise Solutions Limited
 * Escrow Routes
 * 
 * REST API endpoints for escrow state management.
 */

import { Router } from 'express';
import tenantAuth from '../middleware/tenant-auth';
import { EscrowController } from '../controllers/escrow.controller';
import { validateRequestIntegrityHashMiddleware } from '../middleware/integrity';


const router = Router();
const escrowController = new EscrowController();

// POST /api/v1/escrows - Create a new escrow
router.post('/', tenantAuth, (req, res) => escrowController.createEscrow(req, res));

// GET /api/v1/escrows/:escrowId - Retrieve an escrow
router.get('/:escrowId', (req, res) => escrowController.getEscrow(req, res));

// GET /api/v1/tenants/:tenantId/escrows - List tenant escrows
router.get('/tenants/:tenantId/escrows', (req, res) =>
  escrowController.getTenantEscrows(req, res),
);

// POST /api/v1/escrows/:escrowId/lock - Lock escrow for payment
router.post(
  '/:escrowId/lock',
  tenantAuth,
  validateRequestIntegrityHashMiddleware,
  (req, res) => escrowController.lockEscrow(req, res),
);

// POST /api/v1/escrows/:escrowId/release - Release escrow (after payment verified)
router.post(
  '/:escrowId/release',
  tenantAuth,
  validateRequestIntegrityHashMiddleware,
  (req, res) => escrowController.releaseEscrow(req, res),
);

// POST /api/v1/escrows/:escrowId/refund - Refund escrow
router.post(
  '/:escrowId/refund',
  tenantAuth,
  validateRequestIntegrityHashMiddleware,
  (req, res) => escrowController.refundEscrow(req, res),
);

// POST /api/v1/escrows/:escrowId/dispute - Mark as disputed
router.post(
  '/:escrowId/dispute',
  tenantAuth,
  validateRequestIntegrityHashMiddleware,
  (req, res) => escrowController.disputeEscrow(req, res),
);


export default router;

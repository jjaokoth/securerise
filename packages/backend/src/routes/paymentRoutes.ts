/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 *
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of
 * Securerise Solutions Limited. Unauthorized copying or distribution
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */

import { Router } from 'express';

import tenantAuth from '../middleware/tenant-auth';
import { PaymentController } from '../controllers/PaymentController';

const router = Router();
const controller = new PaymentController();

// Under app mounting point: /api/v1/handshake
// POST /api/v1/handshake/create
router.post('/create', tenantAuth, (req, res) => controller.create(req, res));

// POST /api/v1/handshake/verify
router.post('/verify', tenantAuth, (req, res) => controller.verify(req, res));

export default router;


/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 *
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of
 * Securerise Solutions Limited. Unauthorized copying or distribution
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */

import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';

const router = Router();
const controller = new PaymentController();

router.post('/create', (req, res) => controller.create(req, res));
router.post('/verify', (req, res) => controller.verify(req, res));

export default router;

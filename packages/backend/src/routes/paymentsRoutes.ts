import { Router } from 'express';

import tenantAuth from '../middleware/tenant-auth';
import { licenseGuardMiddleware } from '../middleware/integrity';
import { PaymentController } from '../controllers/PaymentController';

const router = Router();
const controller = new PaymentController();

router.post('/initiate', licenseGuardMiddleware, tenantAuth, (req, res) =>
  controller.initiateTransaction(req, res),
);

router.post('/mpesa/webhook', (req, res) => controller.handleMpesaWebhook(req, res));

export default router;

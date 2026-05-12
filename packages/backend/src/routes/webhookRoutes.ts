/**
 * © 2026 Securerise Solutions Limited
 * Webhook Routes
 * 
 * Express routes for all payment provider webhooks.
 */

import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';

const router = Router();
const webhookController = new WebhookController();

// Universal webhook endpoint: POST /webhooks/:provider
router.post('/:provider', (req, res) => webhookController.handleWebhook(req, res));

// Legacy M-Pesa endpoint for backward compatibility
router.post('/mpesa/callback', (req, res) => webhookController.handleMpesaWebhook(req, res));

// Get webhook configuration for a provider: GET /webhooks/:provider/config
router.get('/:provider/config', (req, res) =>
  webhookController.getWebhookConfig(req, res),
);

export default router;

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { json } from 'body-parser';
import privacyMiddleware from './middleware/privacyMiddleware';
import apiKeyMiddleware from './middleware/apiKeyMiddleware';
import internalApiKeyMiddleware from './middleware/internalApiKeyMiddleware';
import { logger } from './lib/logger';
import { PayoutController } from './controllers/payoutController';
import { EscrowController } from './controllers/escrowController';
import { EscrowService } from './services/escrowService';
import { PayoutProofController } from './controllers/payoutProofController';

export const app = express();

// BigInt serialization polyfill (prevents JSON.stringify errors)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Middleware
app.use(helmet());
app.use(cors());
app.use(json());
app.use(privacyMiddleware);
app.use('/api', apiKeyMiddleware);

// Routes
const escrowController = new EscrowController(new EscrowService());
app.post('/api/escrow', internalApiKeyMiddleware, (req, res) => escrowController.createEscrow(req, res));
app.get('/api/escrow/:id', internalApiKeyMiddleware, (req, res) => escrowController.getEscrow(req, res));
app.put('/api/escrow/:id', internalApiKeyMiddleware, (req, res) => escrowController.updateEscrow(req, res));
app.delete('/api/escrow/:id', internalApiKeyMiddleware, (req, res) => escrowController.deleteEscrow(req, res));

const payoutController = new PayoutController();
app.post('/api/payout/handshakes/:handshakeId/process', internalApiKeyMiddleware, (req, res) =>
  payoutController.processUniversal(req, res)
);

// Verify Proof-of-Delivery (AI Trust Service) then process handshake.
const payoutProofController = new PayoutProofController();
app.post(
  '/api/payout/handshakes/:handshakeId/verify-proof',
  internalApiKeyMiddleware,
  (req, res) => payoutProofController.verifyAndProcess(req, res)
);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ message: err?.message, stack: err?.stack });
  res.status(500).json({ error: 'Internal Server Error' });
});

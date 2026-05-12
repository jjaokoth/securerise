// Copyright (c) 2023 jjaokoth. All rights reserved.
// This software is proprietary and confidential. Unauthorized copying, modification, or distribution is strictly prohibited.

import express from 'express';
import cors from 'cors';
import paymentRoutes from './routes/paymentRoutes';

const app = express();
const PORT = process.env.PORT || 8080;

// BigInt JSON Patch
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const productionOrigin =
  'https://securerise-gen-lang-client-0791519677-uc.a.run.app';

app.use(
  cors({
    origin: productionOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Idempotency-Key'],
    credentials: false,
  }),
);

app.use(express.json());

// Health Check for Google Cloud Load Balancer
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.use('/api/v1/handshake', paymentRoutes);

app.listen(PORT, () => {
  console.log(`Securerise Trust API Live on Port ${PORT}`);
});

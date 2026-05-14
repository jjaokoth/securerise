// Copyright (c) 2023 jjaokoth. All rights reserved.
// This software is proprietary and confidential. Unauthorized copying, modification, or distribution is strictly prohibited.

import express from 'express';
import cors from 'cors';
import paymentRoutes from './routes/paymentRoutes';
import paymentsRoutes from './routes/paymentsRoutes';
import webhookRoutes from './routes/webhookRoutes';
import escrowRoutes from './routes/escrowRoutes';

const app = express();
const PORT = process.env.PORT || 8080;

// BigInt JSON Patch
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const productionOrigin =
  'https://securerise-gen-lang-client-0791519677-uc.a.run.app';

// Firebase Hosting will serve the Flutter web bundle (SPA). If you later set
// a custom domain, add it here as well.
// Note: Firebase hosting URL is not present in repo metadata, so keep a
// conservative set of common localhost dev origins too.
const localDevOrigins: string[] = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5000',
];


// TODO(securerise): Add production Firebase Hosting origin when known.
// Example: 'https://your-project.web.app'
const firebaseHostingOrigin: string = '';




app.use(
  cors({
    origin: (origin: string | undefined, callback: any) => {
      if (origin == null) {
        return callback(null, true);
      }

      if (origin === productionOrigin) {
        return callback(null, true);
      }

      if (localDevOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (firebaseHostingOrigin !== '' && origin === firebaseHostingOrigin) {
        return callback(null, true);
      }



      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
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
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/escrows', escrowRoutes);
app.use('/webhooks', webhookRoutes);

app.listen(PORT, () => {
  console.log(`Securerise Trust API Live on Port ${PORT}`);
});

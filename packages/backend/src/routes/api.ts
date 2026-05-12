/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 * 
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of 
 * Securerise Solutions Limited. Unauthorized copying or distribution 
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */


import { Router } from 'express';

import multer from 'multer';
import tenantAuth from '../middleware/tenant-auth';
import { HandshakeController } from '../controllers/handshake.controller';

const router = Router();
const handshakeController = new HandshakeController();

// Use memory storage for buffers
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (_req: any, file: any, cb: any) => {
    const ok =
      file.mimetype === 'image/png' || file.mimetype === 'image/jpeg';
    cb(ok ? null : new Error('INVALID_FILE_TYPE'), ok);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});


// Only authenticated providers (valid API key) can create handshakes.
// Mounted at /v1/handshakes in src/index.ts
router.post('/', tenantAuth, (req, res) =>
  handshakeController.createHandshake(req, res)
);

// Image verification: POST /v1/handshakes/:id/verify
router.post(
  '/:id/verify',
  tenantAuth,
  upload.single('image'),
  (req, res) => handshakeController.verifyAsset(req, res)
);


export default router;




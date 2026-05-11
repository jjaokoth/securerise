/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 * 
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of 
 * Securerise Solutions Limited. Unauthorized copying or distribution 
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */



import type { Request, Response, NextFunction } from 'express';


export function internalApiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.header('x-api-key');
  const internalKey = process.env.INTERNAL_API_KEY;

  if (!internalKey) {
    return res.status(500).json({ error: 'Internal configuration error' });
  }

  if (!apiKey || apiKey !== internalKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

export default internalApiKeyMiddleware;


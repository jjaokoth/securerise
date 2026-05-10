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
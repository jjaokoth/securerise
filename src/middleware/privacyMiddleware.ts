import { Request, Response, NextFunction } from 'express';

export function privacyMiddleware(req: Request, res: Response, next: NextFunction) {
  delete req.headers['sensitive-header'];
  next();
}

export default privacyMiddleware;

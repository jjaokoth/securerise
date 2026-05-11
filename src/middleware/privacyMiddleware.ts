/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 *
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of
 * Securerise Solutions Limited. Unauthorized copying or distribution
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */

import { Request, Response, NextFunction } from 'express';

export function privacyMiddleware(req: Request, res: Response, next: NextFunction) {
  delete req.headers['sensitive-header'];
  next();
}

export default privacyMiddleware;

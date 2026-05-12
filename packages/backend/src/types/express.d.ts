/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 *
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of
 * Securerise Solutions Limited. Unauthorized copying or distribution
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */

import type { Tenant } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      tenant?: Pick<Tenant, 'id' | 'name' | 'webhookSecret' | 'apiKey'>;
    }
  }
}

export {};


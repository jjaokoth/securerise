import type { Tenant } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      tenant?: Pick<Tenant, 'id' | 'name' | 'webhookSecret' | 'apiKey'>;
    }
  }
}

export {};


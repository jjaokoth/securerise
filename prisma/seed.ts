/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 *
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of
 * Securerise Solutions Limited. Unauthorized copying or distribution
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */

import { PrismaClient, TenantStatus } from '@prisma/client';
import crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;


const prisma = new PrismaClient();

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

async function main() {
  const tenantId = 'test-tenant-id';
  const apiKeyPlain = 'securerise_test_key';
  const hashedApiKey = sha256Hex(apiKeyPlain);

  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {
      name: 'Test Merchant',
      hashedApiKey,
      status: TenantStatus.ACTIVE,
    },
    create: {
      id: tenantId,
      name: 'Test Merchant',
      hashedApiKey,
      status: TenantStatus.ACTIVE,
      // NOTE: webhookSecret is required by schema.prisma.
      // Seed it deterministically for the test tenant.
      webhookSecret: 'securerise_test_webhook_secret',
    },
  });
}

main()
  .catch(async (e) => {
    console.error('[prisma seed] Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


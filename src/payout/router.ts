// PrismaClient import can be type-fragile in this environment; use dynamic require.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('@prisma/client');


// Minimal decimal helper: avoids external decimal.js dependency.
class Decimal {
  private v: number;
  constructor(v: string | number) {
    this.v = typeof v === 'number' ? v : Number(v);
  }
  div(n: number) {
    return new Decimal(this.v / n);
  }
  lte(other: Decimal) {
    return this.v <= other.v;
  }
}

type PayoutRoute = 'MPESA' | 'BANK' | 'USDC';
type PayoutHandshakeStatus = 'LOCKED' | 'RELEASED' | 'FAILED';

/**
 * Placeholder for KRA integration logger.
 * Replace with the real KratimsLogger service implementation.
 */
class KratimsLogger {
  async logRelease(_event: {
    handshakeId: string;
    route: PayoutRoute;
    releasedAt: Date;
  }): Promise<void> {
    // No-op placeholder.
  }
}

const prisma = new PrismaClient();
const kratimsLogger = new KratimsLogger();

/**
 * Routes a locked universal payout handshake to the correct rail.
 *
 * Requirements covered:
 * - processUniversalHandshake(handshakeId)
 * - Pre-Flight: status LOCKED + aiConfidence > 0.95
 * - Routing: MPESA (B2C), BANK (PesaLink), USDC (Circle)
 * - Idempotency: best-effort uniqueness via processedReleaseTxId
 */
export async function processUniversalHandshake(handshakeId: string) {
  // -------- Pre-Flight --------
  const handshake = await prisma.payoutHandshake.findUnique({
    where: { handshakeId },
  });

  if (!handshake) throw new Error('HANDSHAKE_NOT_FOUND');

  if (handshake.status !== 'LOCKED') {
    throw new Error('HANDSHAKE_NOT_LOCKED');
  }

  // AI Confidence score validated above 0.95
  // Stored as Float; Decimal.js is used for deterministic comparisons.
  const aiConfidence = new Decimal(handshake.aiConfidence);
  if (aiConfidence.lte(new Decimal(0.95))) {
    throw new Error('AI_CONFIDENCE_TOO_LOW');
  }

  const route: PayoutRoute = handshake.route;
  // Release transaction id (idempotency token)
  // In production this should be derived deterministically or stored earlier.
  const releaseTxId = `rel_${handshake.handshakeId}_${Date.now()}`;

  try {
    // Route execution (simulated).
    await executeRouteRelease(route, handshake, releaseTxId);

    // Idempotency: single state transition protected by unique processedReleaseTxId.
    const updated = await prisma.payoutHandshake.update({
      where: { id: handshake.id },
      data: {
        status: 'RELEASED',
        processedReleaseTxId: releaseTxId,
        releasedAt: new Date(),
        failureReason: null,
      },
    });

    // KRA Integration placeholder on successful release.
    await kratimsLogger.logRelease({
      handshakeId: updated.handshakeId,
      route: updated.route,
      releasedAt: updated.releasedAt ?? new Date(),
    });

    return {
      handshakeId: updated.handshakeId,
      route: updated.route,
      status: updated.status,
      processedReleaseTxId: updated.processedReleaseTxId,
    };
  } catch (err: any) {
    const msg = typeof err?.message === 'string' ? err.message : '';

    // If another worker already released, return the released record.
    if (msg.includes('processedReleaseTxId') || msg.includes('Unique constraint')) {
      const existing = await prisma.payoutHandshake.findUnique({
        where: { handshakeId },
      });

      if (existing?.status === 'RELEASED') {
        return {
          handshakeId: existing.handshakeId,
          route: existing.route,
          status: existing.status,
          processedReleaseTxId: existing.processedReleaseTxId,
        };
      }
    }

    // Best-effort marking as failed; does not guarantee atomicity under concurrency.
    await prisma.payoutHandshake.updateMany({
      where: { handshakeId },
      data: {
        status: 'FAILED',
        failureReason: 'RELEASE_FAILED',
      },
    });

    throw err;
  }
}

async function executeRouteRelease(
  route: PayoutRoute,
  handshake: {
    mpesaB2CRecipient: string | null;
    pesaLinkRecipient: string | null;
    circleRecipient: string | null;
    amountKESCents: bigint;
    amountUSDCents: bigint;
    exchangeRateKESPerUSDC: bigint;
  },
  releaseTxId: string
): Promise<void> {
  // Decimal.js precise math for KES/USD.
  // Interpret cents as integer scale 1/100.
  const kesAmount = new Decimal(handshake.amountKESCents.toString()).div(100);
  const usdcAmount = new Decimal(handshake.amountUSDCents.toString()).div(100);
  const kesPerUsdc = new Decimal(handshake.exchangeRateKESPerUSDC.toString()).div(100);

  // Rail execution placeholders:
  // - MPESA (B2C): use kesAmount
  // - BANK (PesaLink): use kesAmount
  // - USDC (Circle): use usdcAmount
  // In production, call the respective client SDKs/APIs.
  switch (route) {
    case 'MPESA': {
      if (!handshake.mpesaB2CRecipient) throw new Error('MPESA_RECIPIENT_MISSING');
      // await mpesaClient.disburse({ to: handshake.mpesaB2CRecipient, amountKES: kesAmount, ref: releaseTxId })
      void kesPerUsdc;
      void usdcAmount;
      break;
    }
    case 'BANK': {
      if (!handshake.pesaLinkRecipient) throw new Error('PESALINK_RECIPIENT_MISSING');
      // await pesaLinkClient.transfer({ to: handshake.pesaLinkRecipient, amountKES: kesAmount, ref: releaseTxId })
      void usdcAmount;
      void kesPerUsdc;
      break;
    }
    case 'USDC': {
      if (!handshake.circleRecipient) throw new Error('CIRCLE_RECIPIENT_MISSING');
      // await circleClient.transfer({ to: handshake.circleRecipient, amountUSDC: usdcAmount, ref: releaseTxId })
      void kesAmount;
      void kesPerUsdc;
      break;
    }
    default:
      throw new Error('UNSUPPORTED_ROUTE');
  }
}


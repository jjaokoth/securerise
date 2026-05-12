/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 *
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of
 * Securerise Solutions Limited. Unauthorized copying or distribution
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */

/**
 *      
 * PaymentService for Securerise Universal Trust Layer.
 * Implements Hybrid-Trust payout handshake:
 *  - OTP (hashed at rest)
 *  - Safety Net PoD binding (placeholders for ciphertext)
 */

/*
 * PaymentService for Securerise Universal Trust Layer.
 * Hybrid-Trust Handshake (OTP + Safety Net PoD binding: photo URL + GPS JSON)
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export type PayoutRoute = 'MPESA' | 'BANK' | 'USDC';

export type CreateHandshakeInput = {
  tenantId: string;
  amountKES: number;
  recipientPhone: string;
  route: PayoutRoute;
};

export type VerifyAndReleaseInput = {
  handshakeId: string;
  userProvidedOtp: string | number;
  safetyNetImageUrl: string;
  gpsMetadata: unknown;
  idempotencyKey: string;
};

function assertNonEmptyString(v: unknown, name: string): string {
  if (typeof v !== 'string') throw new Error(`${name}_INVALID`);
  const s = v.trim();
  if (!s) throw new Error(`${name}_REQUIRED`);
  return s;
}

function toCentsKESBigInt(amountKES: number): bigint {
  if (typeof amountKES !== 'number' || !Number.isFinite(amountKES)) {
    throw new Error('amountKES_INVALID');
  }

  // Fixed 2 decimals (KES cents)
  const s = amountKES.toFixed(2);
  const [whole, frac] = s.split('.');
  const cents = BigInt(whole) * 100n + BigInt(frac);
  if (cents <= 0n) throw new Error('amountKES_MUST_BE_POSITIVE');
  return cents;
}

function generateSecure6DigitOtp(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, '0');
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export class PaymentService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * createHandshake
   * - Generates a 6-digit OTP
   * - Hashes OTP with SHA-256
   * - Stores as LOCKED record
   */
  async createHandshake(input: CreateHandshakeInput) {
    const tenantId = assertNonEmptyString(input.tenantId, 'tenantId');
    const recipientPhone = assertNonEmptyString(input.recipientPhone, 'recipientPhone');
    const route = input.route;

    // CRITICAL: Use BigInt for KES cents
    const amountKESCents = toCentsKESBigInt(input.amountKES);

    // CRITICAL: Use crypto SHA-256 hashing for OTP-at-rest
    const otpPlain = generateSecure6DigitOtp();
    const otpHash = sha256Hex(otpPlain);

    const handshakeId = `hs_${crypto.randomUUID?.() ?? crypto.randomBytes(16).toString('hex')}`;

    const created = await this.prisma.payoutHandshake.create({
      data: {
        tenantId,
        handshakeId,
        route,
        status: 'LOCKED',
        aiConfidence: 0,
        handshakeCodeHash: otpHash,

        // Safety Net PoD binding placeholders
        podPhotoUrlCiphertext: null,
        podPhotoUrlIv: null,
        podGpsCiphertext: null,
        podGpsIv: null,
        podIntegrityHash: null,

        amountKESCents,
        amountUSDCents: 0n,
        exchangeRateKESPerUSDC: 0n,

        // Route destination
        mpesaB2CRecipient: route === 'MPESA' ? recipientPhone : null,
        pesaLinkRecipient: route === 'BANK' ? recipientPhone : null,
        circleRecipient: route === 'USDC' ? recipientPhone : null,

        // Idempotency (release)
        releaseIdempotencyKey: null,
      },
    });

    return {
      handshake: created,
      otp: otpPlain,
    };
  }


  /**
   * verifyAndRelease
   * - Verifies OTP by comparing SHA-256 hash
   * - Logs safetyNetUrl and gpsCoords (stored as-is placeholders for ciphertext)
   * - Updates status to RELEASED
   * - Uses idempotencyKey to ensure single release
   */
  async verifyAndRelease(input: VerifyAndReleaseInput) {
    const handshakeId = assertNonEmptyString(input.handshakeId, 'handshakeId');
    const idempotencyKey = assertNonEmptyString(input.idempotencyKey, 'idempotencyKey');

    const userOtpRaw = typeof input.userProvidedOtp === 'number' ? String(input.userProvidedOtp) : input.userProvidedOtp;
    const userOtp = assertNonEmptyString(userOtpRaw, 'userProvidedOtp');

    if (!/^\d{6}$/.test(userOtp)) throw new Error('INVALID_OTP');

    // CRITICAL: OTP hashing at verify time
    const userOtpHash = sha256Hex(userOtp);

    // Accept both a URL and base64 image (mobile sends base64).
    // This service stores it as-is into podPhotoUrlCiphertext placeholder.
    const podPhotoUrl = assertNonEmptyString(input.safetyNetImageUrl, 'safetyNetImageUrl');
    const podGpsMetadata = input.gpsMetadata;

    // CRITICAL: capture podPhotoUrl and podGps metadata
    // Since schema stores ciphertext/iv placeholders, we store the raw values as-is.
    // Real encryption can replace these without API changes.
    const podGpsCiphertext = JSON.stringify(podGpsMetadata ?? null);

    // Avoid leaking sensitive data into logs.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[Securerise] verifyAndRelease', {
        handshakeId,
        idempotencyKey,
      });
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const handshake = await tx.payoutHandshake.findUnique({ where: { handshakeId } });
        if (!handshake) throw new Error('NOT_FOUND');

        // OTP verify
        if (!handshake.handshakeCodeHash || handshake.handshakeCodeHash !== userOtpHash) {
          throw new Error('INVALID_OTP');
        }

        // Double release protection
        if (handshake.status === 'RELEASED') throw new Error('ALREADY_PROCESSED');

        // Idempotency: releaseIdempotencyKey is unique in schema.
        // Best-effort check + rely on unique constraint for race safety.
        const existing = await tx.payoutHandshake.findFirst({
          where: { releaseIdempotencyKey: idempotencyKey },
          select: { id: true, status: true },
        });
        if (existing) throw new Error('ALREADY_PROCESSED');

        return tx.payoutHandshake.update({
          where: { id: handshake.id },
          data: {
            status: 'RELEASED',
            releaseIdempotencyKey: idempotencyKey,
            podPhotoUrlCiphertext: podPhotoUrl,
            podGpsCiphertext: podGpsCiphertext,
            // Fill integrity binding hash placeholder when/if you introduce true encryption.
            podIntegrityHash: handshake.podIntegrityHash,
            releasedAt: new Date(),
          },
        });
      });

      return result;
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : '';

      if (msg === 'NOT_FOUND' || msg === 'INVALID_OTP' || msg === 'ALREADY_PROCESSED') {
        throw new Error(msg);
      }

      // Unique constraint race on releaseIdempotencyKey
      if (
        typeof err?.message === 'string' &&
        (err.message.includes('Unique constraint') ||
          err.message.toLowerCase().includes('releaseidempotencykey') ||
          err.message.toLowerCase().includes('unique'))
      ) {
        throw new Error('ALREADY_PROCESSED');
      }

      throw err;
    }
  }

}



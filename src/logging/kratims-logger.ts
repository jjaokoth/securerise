/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 *
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of
 * Securerise Solutions Limited. Unauthorized copying or distribution
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */

import CryptoJS from 'crypto-js';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Intentionally loose typing: repo currently has no shared Handshake type.
// Expected (best-effort):
// - invoiceNumber?: string (UUID)
// - invoiceNumberUuid?: string
// - customerPin?: string
// - totalAmount?: number|string
// - buyerId?: string
// - sellerId?: string
export type Handshake = any;

const ITEM_DESCRIPTION = 'Automated Escrow Service';
const VAT_RATE = 0.16;
const TRANSACTION_FEE_RATE = 0.03;

function sha256Hex(input: string): string {
  return CryptoJS.SHA256(input).toString(CryptoJS.enc.Hex);
}

function maskPin(pin: unknown): string {
  const s = typeof pin === 'string' ? pin : pin == null ? '' : String(pin);
  if (!s) return '***';
  if (s.length <= 4) return '*'.repeat(s.length);
  return `${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

function parseTotalAmount(total: unknown): number | null {
  if (typeof total === 'number' && Number.isFinite(total)) return total;
  if (typeof total === 'string') {
    const n = Number(total);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getInvoiceNumber(handshake: Handshake): string {
  const candidate =
    handshake?.invoiceNumber ??
    handshake?.invoiceNumberUuid ??
    handshake?.invoice_no ??
    null;
  if (typeof candidate === 'string' && candidate.length >= 8) return candidate;
  return randomUUID();
}

function getCustomerPin(handshake: Handshake): string {
  const candidate = handshake?.customerPin ?? handshake?.pin ?? handshake?.customer_pin;
  return maskPin(candidate);
}

function getBuyerSellerIds(handshake: Handshake): { buyerId?: string; sellerId?: string } {
  const buyerId = handshake?.buyerId ?? handshake?.buyer_id ?? handshake?.senderId ?? handshake?.sender_id;
  const sellerId = handshake?.sellerId ?? handshake?.seller_id ?? handshake?.receiverId ?? handshake?.receiver_id;
  return { buyerId: typeof buyerId === 'string' ? buyerId : buyerId == null ? undefined : String(buyerId),
           sellerId: typeof sellerId === 'string' ? sellerId : sellerId == null ? undefined : String(sellerId) };
}

async function appendJsonLine(filePath: string, record: Record<string, unknown>) {
  // JSONL append; each record is a single line.
  // Fire-and-forget: we swallow errors by calling this in a try/catch at call site.
  const line = `${JSON.stringify(record)}\n`;
  await fs.appendFile(filePath, line, { encoding: 'utf8' });
}

/**
 * logToETIMS must take a Handshake object.
 *
 * VAT logic:
 * - Calculate 16% VAT on the 3% transaction fee only.
 *   tax = totalAmount * 0.03 * 0.16
 */
export function logToETIMS(handshake: Handshake): void {
  const invoiceNumber = getInvoiceNumber(handshake);
  const customerPinMasked = getCustomerPin(handshake);

  const totalAmount = parseTotalAmount(handshake?.totalAmount ?? handshake?.total ?? handshake?.amount);
  if (totalAmount == null) {
    // Best-effort: no valid accounting amount => nothing to log.
    return;
  }

  const { buyerId, sellerId } = getBuyerSellerIds(handshake);
  const buyerIdHash = buyerId ? sha256Hex(buyerId) : null;
  const sellerIdHash = sellerId ? sha256Hex(sellerId) : null;

  const transactionFeeAmount = totalAmount * TRANSACTION_FEE_RATE;
  const taxAmount = transactionFeeAmount * VAT_RATE;

  const record = {
    // Compliance fields requested
    invoiceNumber,
    customerPinMasked,
    itemDescription: ITEM_DESCRIPTION,
    totalAmount,
    taxAmount,

    // Privacy-safe identifiers
    buyerIdHash,
    sellerIdHash,

    // Metadata
    loggedAt: new Date().toISOString(),
    version: 1,
  };

  // Fire-and-forget: schedule async work, never await.
  void (async () => {
    try {
      const dir = path.join(process.cwd(), 'data', 'compliance');
      const filePath = path.join(dir, 'kratims-etims-compliance.jsonl');
      await fs.mkdir(dir, { recursive: true });
      await appendJsonLine(filePath, record);
    } catch {
      // Swallow errors for high-availability.
    }
  })();
}


/**
 * Master settlement destination configuration.
 *
 * NOTE: Financial destination details are intentionally kept in a single
 * module so downstream payout/settlement logic can reference one source of
 * truth.
 */

export type SettlementDestination = {
  bank: string;
  accountName: string;
  accountNumber: string;
};

export const ncbaLoopSettlementDestination: SettlementDestination = {
  bank: 'NCBA Loop',
  accountName: 'SECURERISE SOLUTIONS LIMITED',
  accountNumber: '880200283180',
};

/**
 * Returns the master payout destination.
 *
 * Future-proofing: allow overriding via env var without changing code.
 *
 * Expected format (optional):
 *   "bank|accountName|accountNumber"
 */
export function getMasterSettlementDestination(): SettlementDestination {
  const raw = process.env.SETTLEMENT_ACC;
  if (!raw || typeof raw !== 'string') return ncbaLoopSettlementDestination;

  const parts = raw.split('|').map((s) => s.trim());
  if (parts.length !== 3) return ncbaLoopSettlementDestination;

  const [bank, accountName, accountNumber] = parts;
  if (!bank || !accountName || !accountNumber) return ncbaLoopSettlementDestination;

  return { bank, accountName, accountNumber };
}


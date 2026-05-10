import crypto from 'crypto';
import { logger } from '../lib/logger';

// Minimal decimal helper using integer math for basis points.
// We need deterministic 3% fee subtraction.
// feeBps = 300 (i.e., 3.00%). Amounts are treated as KES cents integers.
const FEE_BPS = 300n;

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name}_MISSING`);
  return v;
}

async function httpJson<T = any>(url: string, opts: {
  method: string;
  headers?: Record<string, string>;
  body?: any;
}): Promise<T> {
  // Node 14+ has global fetch; fall back if missing.
  const fetchFn: typeof fetch = (globalThis as any).fetch
    ? (globalThis as any).fetch
    : require('node-fetch');

  const res = await fetchFn(url, {
    method: opts.method,
    headers: {
      'content-type': 'application/json',
      ...(opts.headers ?? {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg = json?.errorMessage || json?.message || `MPESA_HTTP_${res.status}`;
    throw new Error(msg);
  }

  return json as T;
}

/**
 * Fetch OAuth access token for MPESA Online.
 */
export async function fetchMpesaOAuthAccessToken(): Promise<string> {
  const consumerKey = getEnv('MPESA_CONSUMER_KEY');
  const consumerSecret = getEnv('MPESA_CONSUMER_SECRET');

  // Common MPESA token endpoint.
  const tokenUrl =
    process.env.MPESA_OAUTH_URL ?? 'https://sandbox.safaricom.co.ke/oauth/v1/generate';

  const basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  const fetchFn: typeof fetch = (globalThis as any).fetch
    ? (globalThis as any).fetch
    : require('node-fetch');

  const res = await fetchFn(tokenUrl, {
    method: 'GET',
    headers: {
      authorization: `Basic ${basic}`,
    },
  });

  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg = json?.errorMessage || json?.message || `MPESA_TOKEN_HTTP_${res.status}`;
    throw new Error(msg);
  }

  const token = json?.access_token;
  if (!token) throw new Error('MPESA_ACCESS_TOKEN_MISSING');
  return String(token);
}

export type StkPushInitiateInput = {
  // C2B fields
  amountKES: bigint; // KES cents integer
  buyerPhone: string; // e.g. 2547...
  accountReference?: string;
  callbackUrl?: string;
};

export type StkPushInitiateResult = {
  checkoutRequestId: string;
  merchantRequestId?: string;
  responseCode?: string | number;
};

/**
 * Initiate an STK Push (KES) to buyer's phone.
 * Triggers a C2B request.
 */
export async function initiateStkPush(
  input: StkPushInitiateInput
): Promise<StkPushInitiateResult> {
  const accessToken = await fetchMpesaOAuthAccessToken();

  const shortcode = getEnv('MPESA_SHORTCODE');
  const passkey = getEnv('MPESA_PASSKEY');
  const callbackUrl =
    input.callbackUrl ??
    process.env.MPESA_STK_CALLBACK_URL ??
    (() => {
      throw new Error('MPESA_STK_CALLBACK_URL_MISSING');
    })();

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('.000', '');

  // MPESA STK password generation: base64(shortcode+passkey+timestamp)
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  const partyA = shortcode;
  const partyB = process.env.MPESA_LNM_SHORTCODE ?? shortcode;
  const initiatorName = process.env.MPESA_INITIATOR_NAME ?? 'Initiator';
  const transactionType = 'CustomerPayBillOnline';
  const callbackURL = callbackUrl;

  // Amount in KES cents -> MPESA expects whole KES amount (assumption).
  // We convert cents to KES with integer division.
  const amountKESWhole = input.amountKES / 100n;

  const transactionReference =
    input.accountReference ??
    `stk_${crypto.randomUUID?.() ?? Date.now().toString()}`;

  const url =
    process.env.MPESA_STK_ENDPOINT ??
    'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: transactionType,
    Amount: amountKESWhole.toString(),
    PartyA: input.buyerPhone,
    PartyB: partyB,
    PhoneNumber: input.buyerPhone,
    CallBackURL: callbackURL,
    AccountReference: transactionReference,
    TransactionDesc: transactionReference,
  };

  const json = await httpJson<any>(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: payload,
  });

  // Expected: { CheckoutRequestID: '...', ResponseCode: '0', ... }
  const checkoutRequestId = String(json?.CheckoutRequestID ?? '');
  if (!checkoutRequestId) {
    throw new Error('MPESA_STK_PUSH_FAILED');
  }

  return {
    checkoutRequestId,
    merchantRequestId: json?.MerchantRequestID,
    responseCode: json?.ResponseCode,
  };
}

export type DisburseFundsInput = {
  sellerPhoneOrAccount: string; // For MPESA B2C, typically phone number (MSISDN)
  amountKESGross: bigint; // KES cents integer (before fee)
  // Fee is 3% securerise.
  // Amount moved to disbursement should be: gross - 3%.
};

export type DisburseFundsResult = {
  resultCode: string | number;
  conversationId?: string;
  originatorConversationId?: string;
};

/**
 * Disbursement (B2C) to seller payout.
 * Applies 3% Securerise fee precisely using integer math.
 */
export async function disburseFunds(
  input: DisburseFundsInput
): Promise<DisburseFundsResult> {
  const accessToken = await fetchMpesaOAuthAccessToken();

  const shortcode = getEnv('MPESA_SHORTCODE');
  const passkey = getEnv('MPESA_PASSKEY');
  const initiatorName = process.env.MPESA_INITIATOR_NAME ?? 'Initiator';
  const securityCredential = process.env.MPESA_SECURITY_CREDENTIAL ?? passkey;

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('.000', '');

  const url =
    process.env.MPESA_B2C_ENDPOINT ??
    'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest';

  // Precise fee subtraction on cents.
  // net = gross - (gross * 3%)
  // gross*FEE_BPS/10000
  const fee = (input.amountKESGross * FEE_BPS) / 10000n;
  const net = input.amountKESGross - fee;
  if (net <= 0n) throw new Error('MPESA_NET_AMOUNT_INVALID');

  // MPESA expects whole KES.
  const amountWholeKES = net / 100n;

  const payload = {
    InitiatorName: initiatorName,
    SecurityCredential: securityCredential,
    CommandID: 'SalaryPayment',
    Amount: amountWholeKES.toString(),
    PartyA: shortcode,
    PartyB: input.sellerPhoneOrAccount,
    Remarks: 'Securerise payout',
    QueueTimeOutURL: process.env.MPESA_QUEUE_TIMEOUT_URL ?? '',
    ResultURL: process.env.MPESA_RESULT_URL ?? '',
    Occasion: 'Payout',
  };

  const fetchFn: typeof fetch = (globalThis as any).fetch
    ? (globalThis as any).fetch
    : require('node-fetch');

  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg = json?.errorMessage || json?.message || `MPESA_B2C_HTTP_${res.status}`;
    throw new Error(msg);
  }

  // result codes checked in callback validation.
  return {
    resultCode: json?.ResultCode ?? 'UNKNOWN',
    conversationId: json?.ConversationID,
    originatorConversationId: json?.OriginatorConversationID,
  };
}

export type MpesaCallbackValidationInput = {
  // Safaricom callback payload (often ResultCode at root for B2C, and nested for STK).
  body: any;
};

export type MpesaCallbackValidationResult = {
  isValid: boolean;
  shouldRelease: boolean;
  resultCode?: string | number;
};

/**
 * Security: callback validation.
 * Only move to 'RELEASED' if Safaricom ResultCode is 0.
 */
export function validateMpesaCallback(
  input: MpesaCallbackValidationInput
): MpesaCallbackValidationResult {
  const body = input.body ?? {};

  // Common patterns:
  // B2C: { Result: { ResultCode: '0', ResultDesc: 'Success', ... } }
  // STK: { Body: { stkCallback: { ResultCode: 0, ResultDesc: 'The service request is processed successfully' ... } } }

  const resultCode =
    body?.Result?.ResultCode ??
    body?.body?.stkCallback?.ResultCode ??
    body?.Body?.stkCallback?.ResultCode ??
    body?.Body?.stkCallback?.Result?.ResultCode ??
    body?.ResultCode;

  const normalized = resultCode === undefined || resultCode === null ? undefined : String(resultCode);

  // Release strictly on 0.
  const shouldRelease = normalized !== undefined && normalized === '0';

  return {
    isValid: normalized !== undefined,
    shouldRelease,
    resultCode: normalized,
  };
}

// Optional helper to compute callback HMAC if you wire it later.
export function computeCallbackSignature(secret: string, payload: any): string {
  const h = crypto.createHmac('sha256', secret);
  h.update(typeof payload === 'string' ? payload : JSON.stringify(payload));
  return h.digest('hex');
}

export function isReleaseStatusAllowedFromSafaricom(resultCode: any): boolean {
  return String(resultCode) === '0';
}


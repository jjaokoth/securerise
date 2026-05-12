/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 *
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of
 * Securerise Solutions Limited. Unauthorized copying or distribution
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */

import crypto from 'crypto';

// Use global fetch if available (Node 18+). Fall back to dynamic import.
async function fetchText(url: string, init: any): Promise<{ ok: boolean; status: number; text: string }> {
  const fetchFn: any = (globalThis as any).fetch;
  if (!fetchFn) {
    throw new Error('FETCH_NOT_AVAILABLE');
  }

  const res = await fetchFn(url, init);
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}


export type SignedWebhookResult = {
  ok: boolean;
  status: number;
  responseText: string;
};

type FetchTextResult = { ok: boolean; status: number; text: string };


function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryPlan({ maxAttempts }: { maxAttempts: number }) {
  // Exponential backoff with jitter; total should fit within ~24 hours.
  // attempts: 5
  // delays: 1m, 2m, 4m, 8m, 16m -> ~31m total (well within 24h)
  const baseMs = 60_000;
  const delays: number[] = [];
  for (let i = 0; i < maxAttempts; i++) {
    delays.push(baseMs * Math.pow(2, i) * (0.8 + Math.random() * 0.4));
  }
  return delays;
}

/**
 * Generates HMAC-SHA256 signature over JSON stringified payload.
 */
// Deprecated: use src/services/webhook.service.ts (class-based) which includes
// retries and writes to Prisma DeadLetterQueue.
export async function sendSignedWebhook<TPayload extends Record<string, unknown>>(
  payload: TPayload,
  {
    secret,
    callbackUrl,
    requestTimeoutMs = 30_000,
  }: {
    secret: string;
    callbackUrl: string;
    requestTimeoutMs?: number;
  }
): Promise<SignedWebhookResult> {
  // Keep old behavior for compatibility, but do NOT implement DeadLetterQueue here.
  if (!secret) throw new Error('WEBHOOK_SECRET_MISSING');
  if (!callbackUrl) throw new Error('WEBHOOK_CALLBACK_URL_MISSING');

  const bodyText = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(bodyText)
    .digest('hex');

  const timestamp = new Date().toISOString();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Securerise-Signature': signature,
    'X-Securerise-Timestamp': timestamp,
  };

  const maxAttempts = 5;
  const delays = getRetryPlan({ maxAttempts });

  let lastStatus = 0;
  let lastText = '';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

      const result = await fetchText(callbackUrl, {
        method: 'POST',
        headers,
        body: bodyText,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      lastStatus = (result as any).status;
      lastText = (result as any).text;

      if (result.ok) {
        return { ok: true, status: result.status, responseText: result.text };
      }
    } catch (e: any) {
      lastStatus = 0;
      lastText = typeof e?.message === 'string' ? e.message : 'WEBHOOK_SEND_FAILED';
    }

    if (attempt < maxAttempts - 1) {
      await sleep(delays[attempt]);
    }
  }

  return { ok: false, status: lastStatus, responseText: lastText };
}



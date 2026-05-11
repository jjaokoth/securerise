/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 *
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of
 * Securerise Solutions Limited. Unauthorized copying or distribution
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */

import crypto from 'crypto';
import axios, { AxiosInstance, AxiosError } from 'axios';

import { logger } from '../lib/logger';

function getPrisma() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client');
  return new PrismaClient();
}



type WebhookEventBase = {
  id: string; // unique event ID
  type: string; // e.g. handshake.verified | handshake.failed
  data: Record<string, unknown>; // handshake details + aiConfidence
};

type SendWebhookEventParams = {
  tenantId: string;
  tenantWebhookSecret: string;

  callbackUrl: string;
  ipAddress?: string;

  // Webhook event payload that will be signed.
  event: WebhookEventBase;

  // Optional request timeout
  requestTimeoutMs?: number;
};

type DeadLetterFailure = {
  tenantId: string;
  eventId: string;
  eventType: string;
  callbackUrl: string;
  ipAddress: string;
  failureReason: string;
  attempts: number;
  payload: Record<string, unknown>;
};


function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hmacSha256Hex(secret: string, jsonBody: string): string {
  return crypto.createHmac('sha256', secret).update(jsonBody).digest('hex');
}

function getExponentialBackoffDelayMs(attemptIndex: number) {
  // attemptIndex: 0 => smallest delay
  // Using exponential backoff with cap to keep retries bounded.
  const base = 1000; // 1s
  const max = 30 * 60_000; // 30 minutes
  const delay = base * Math.pow(2, attemptIndex);
  return Math.min(delay, max);
}

function normalizeIp(ipAddress?: string): string {
  if (!ipAddress) return '';
  return String(ipAddress);
}

async function writeDeadLetterQueueFailure(failure: DeadLetterFailure) {
  try {
    const prisma = await getPrisma();
    await prisma.deadLetterQueue.create({
      data: {
        tenantId: failure.tenantId,
        eventId: failure.eventId,
        eventType: failure.eventType,
        payload: failure.payload as any,
        callbackUrl: failure.callbackUrl,
        ipAddress: failure.ipAddress,
        attempts: failure.attempts,
        failureReason: failure.failureReason,
      },
    });
  } catch (e) {
    // Dead letter logging must not break webhook dispatch.
    logger.warn({
      message: 'DEAD_LETTER_QUEUE_WRITE_FAILED',
      error: e instanceof Error ? e.message : String(e),
      tenantId: failure.tenantId,
      eventId: failure.eventId,
      eventType: failure.eventType,
    });
  }
}


export class WebhookService {
  private axios: AxiosInstance;

  constructor(axiosInstance?: AxiosInstance) {
    this.axios =
      axiosInstance ??
      axios.create({
        // Keep defaults minimal; per-request timeout is applied by caller.
        validateStatus: () => true, // we handle success/failure ourselves
      });
  }

  /**
   * Sends a verified signal to a tenant partner endpoint.
   *
   * Security:
   * - X-Securerise-Signature: HMAC-SHA256(JSON.stringify(body)) using tenantWebhookSecret
   * - X-Securerise-Timestamp: ISO timestamp
   *
   * Reliability:
   * - Retries network errors and 5xx responses with exponential backoff.
   * - On final failure, writes a row to prisma.auditLog.
   */
  async sendWebhookEvent(
    params: SendWebhookEventParams
  ): Promise<{ ok: boolean; status?: number; responseText?: string }> {
    const {
      tenantId,
      tenantWebhookSecret,
      callbackUrl,
      ipAddress,
      event,
      requestTimeoutMs = 30_000,
    } = params;

    if (!tenantId) throw new Error('TENANT_ID_MISSING');
    if (!tenantWebhookSecret) throw new Error('WEBHOOK_SECRET_MISSING');
    if (!callbackUrl) throw new Error('WEBHOOK_CALLBACK_URL_MISSING');
    if (!event?.id) throw new Error('WEBHOOK_EVENT_ID_MISSING');
    if (!event?.type) throw new Error('WEBHOOK_EVENT_TYPE_MISSING');
    if (!event?.data) throw new Error('WEBHOOK_EVENT_DATA_MISSING');

    // Signature: HMAC-SHA256(JSON.stringify(body))
    // Payload MUST follow: { id, type, data }
    const jsonBody = JSON.stringify(event);
    const signature = hmacSha256Hex(tenantWebhookSecret, jsonBody);
    const timestamp = new Date().toISOString();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Securerise-Signature': signature,
      'X-Securerise-Timestamp': timestamp,
    };

    const maxAttempts = 5;

    let lastStatus: number | undefined;
    let lastText: string | undefined;
    let lastFailureReason: string = 'WEBHOOK_SEND_FAILED';

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await this.axios.post(callbackUrl, jsonBody, {
          headers,
          timeout: requestTimeoutMs,
        });

        lastStatus = res.status;
        lastText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');

        // Treat 2xx/3xx as success; retry on 5xx and also on 429 (rate limit).
        if (res.status >= 200 && res.status < 400) {
          return { ok: true, status: res.status, responseText: lastText };
        }

        // Retryable server-side errors.
        if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
          lastFailureReason = `WEBHOOK_SERVER_ERROR_${res.status}`;
        } else {
          // Non-retryable (e.g., 4xx): return failure immediately.
          return { ok: false, status: res.status, responseText: lastText };
        }
      } catch (e) {
        const err = e as AxiosError;
        lastFailureReason = err?.code
          ? `WEBHOOK_NETWORK_ERROR_${err.code}`
          : err?.message
            ? `WEBHOOK_NETWORK_ERROR_${err.message}`
            : 'WEBHOOK_NETWORK_ERROR';

        // Retry on network errors (axios throws).
        lastStatus = undefined;
        lastText = undefined;
      }

      if (attempt < maxAttempts - 1) {
        await sleep(getExponentialBackoffDelayMs(attempt));
      }
    }

    const failure: DeadLetterFailure = {
      tenantId,
      eventId: event.id,
      eventType: event.type,
      callbackUrl,
      ipAddress: normalizeIp(ipAddress),
      attempts: maxAttempts,
      failureReason: lastFailureReason,
      payload: event,
    };

    await writeDeadLetterQueueFailure(failure);

    return { ok: false, status: lastStatus, responseText: lastText };
  }
}



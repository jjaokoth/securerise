import axios from 'axios';
import crypto from 'crypto';

import { getMasterSettlementDestination } from '../config/settlement';
import {
  validateMpesaCallback,
  isReleaseStatusAllowedFromSafaricom,
} from '../payout/mpesa-handler';
import {
  createRecurringSubscriptionRecord,
  updatePremiumStatus,
} from './firestore.service';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`${name}_MISSING`);
  }
  return value.trim();
}

function buildSignature(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/[^0-9]/g, '');
}

export type RecurringInterval = 'WEEKLY' | 'MONTHLY';

export type StkPushResult = {
  checkoutRequestId: string;
  merchantRequestId?: string;
  responseCode?: string | number;
};

export type RecurringSubscriptionResult = {
  subscriptionId: string;
  interval: RecurringInterval;
  nextBillingAt: string;
  status: 'ACTIVE';
};

export class DarajaService {
  private tokenCache:
    | {
        token: string;
        expiresAt: number;
      }
    | null = null;

  private async fetchOAuthToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && now < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const consumerKey = getEnv('MPESA_CONSUMER_KEY');
    const consumerSecret = getEnv('MPESA_CONSUMER_SECRET');
    const oauthUrl =
      process.env.MPESA_OAUTH_URL ?? 'https://sandbox.safaricom.co.ke/oauth/v1/generate';

    const authorization = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const response = await axios.get(oauthUrl, {
      headers: {
        Authorization: `Basic ${authorization}`,
      },
    });

    const token = response.data?.access_token;
    const expiresIn = Number(response.data?.expires_in ?? 3400);
    if (!token || typeof token !== 'string') {
      throw new Error('MPESA_ACCESS_TOKEN_MISSING');
    }

    const expiresAt = now + Math.max(2000, expiresIn - 30) * 1000;
    this.tokenCache = { token, expiresAt };
    return token;
  }

  private buildRequestSignature(payload: Record<string, unknown>): string {
    const secret = process.env.DARAJA_PASSKEY || getEnv('MPESA_PASSKEY');
    const payloadString = JSON.stringify(payload);
    return buildSignature(secret, payloadString);
  }

  async initiateStkPush(params: {
    amountKESCents: bigint;
    buyerPhone: string;
    accountReference: string;
    callbackUrl?: string;
  }): Promise<StkPushResult> {
    const accessToken = await this.fetchOAuthToken();
    const shortcode = getEnv('MPESA_SHORTCODE');
    const passkey = getEnv('MPESA_PASSKEY');

    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('.000', '');
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const amountWholeKES = params.amountKESCents / 100n;
    if (amountWholeKES <= 0n) {
      throw new Error('MPESA_AMOUNT_INVALID');
    }

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amountWholeKES.toString(),
      PartyA: normalizePhoneNumber(params.buyerPhone),
      PartyB: process.env.MPESA_LNM_SHORTCODE ?? shortcode,
      PhoneNumber: normalizePhoneNumber(params.buyerPhone),
      CallBackURL:
        params.callbackUrl ?? process.env.MPESA_STK_CALLBACK_URL ?? '',
      AccountReference: params.accountReference,
      TransactionDesc: params.accountReference,
    };

    const response = await axios.post(
      process.env.MPESA_STK_ENDPOINT ??
        'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Securerise-Signature': this.buildRequestSignature(payload),
        },
      },
    );

    if (!response.data?.CheckoutRequestID) {
      throw new Error('MPESA_STK_PUSH_FAILED');
    }

    return {
      checkoutRequestId: String(response.data.CheckoutRequestID),
      merchantRequestId: response.data.MerchantRequestID,
      responseCode: response.data.ResponseCode,
    };
  }

  async createRecurringSubscription(params: {
    tenantId: string;
    phoneNumber: string;
    amountKESCents: bigint;
    interval: RecurringInterval;
  }): Promise<RecurringSubscriptionResult> {
    const amountWholeKES = params.amountKESCents / 100n;
    if (amountWholeKES <= 0n) {
      throw new Error('RECURRING_AMOUNT_INVALID');
    }

    const subscriptionId = `sub_${crypto.randomUUID?.() ?? Date.now().toString(16)}`;
    const nextBillingAt = new Date(
      Date.now() + (params.interval === 'MONTHLY' ? 30 * 24 * 3600 * 1000 : 7 * 24 * 3600 * 1000),
    );

    await createRecurringSubscriptionRecord({
      tenantId: params.tenantId,
      phoneNumber: params.phoneNumber,
      amountKESCents: params.amountKESCents,
      interval: params.interval,
      subscriptionId,
      nextBillingAt,
    });

    return {
      subscriptionId,
      interval: params.interval,
      nextBillingAt: nextBillingAt.toISOString(),
      status: 'ACTIVE',
    };
  }

  async queryPullTransaction(params: {
    transactionReference: string;
    phoneNumber?: string;
  }): Promise<Record<string, unknown>> {
    const accessToken = await this.fetchOAuthToken();
    const shortcode = getEnv('MPESA_SHORTCODE');

    const payload = {
      CommandID: 'TransactionStatusQuery',
      PartyA: shortcode,
      IdentifierType: '1',
      TransactionID: params.transactionReference,
      ResultURL: process.env.MPESA_PULL_RESULT_URL ?? '',
      Occasion: 'Reconciliation',
      Remarks: 'Pull transaction reconciliation',
    };

    const response = await axios.post(
      process.env.MPESA_PULL_TRANSACTION_ENDPOINT ??
        'https://sandbox.safaricom.co.ke/mpesa/pulltransactions/v1/query',
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Securerise-Signature': this.buildRequestSignature(payload),
        },
      },
    );

    return response.data ?? {};
  }

  async processWebhook(body: any): Promise<{ shouldUpdatePremium: boolean; phoneNumber?: string; resultCode?: string }> {
    const result = validateMpesaCallback({ body });
    const shouldRelease = isReleaseStatusAllowedFromSafaricom(result.resultCode);
    const phoneNumber =
      body?.Body?.stkCallback?.CallbackMetadata?.Item?.find(
        (item: any) => item?.Name === 'PhoneNumber',
      )?.Value ?? body?.PhoneNumber ?? null;

    if (shouldRelease && typeof phoneNumber === 'string') {
      await updatePremiumStatus(phoneNumber, true, {
        source: 'mpesa_webhook',
        resultCode: String(result.resultCode),
      });
      return {
        shouldUpdatePremium: true,
        phoneNumber,
        resultCode: String(result.resultCode),
      };
    }

    return {
      shouldUpdatePremium: false,
      phoneNumber: typeof phoneNumber === 'string' ? phoneNumber : undefined,
      resultCode: result.resultCode !== undefined ? String(result.resultCode) : undefined,
    };
  }

  getMasterSettlementDestination() {
    return getMasterSettlementDestination();
  }
}

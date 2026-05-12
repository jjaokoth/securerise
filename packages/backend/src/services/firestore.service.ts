import admin from 'firebase-admin';

const appOptions: admin.AppOptions = {};

if (process.env.FIREBASE_PROJECT_ID) {
  appOptions.projectId = process.env.FIREBASE_PROJECT_ID;
}

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  appOptions.credential = admin.credential.applicationDefault();
}

if (!admin.apps.length) {
  admin.initializeApp(appOptions);
}

const firestore = admin.firestore();

function normalizePhone(phoneNumber: string): string {
  return phoneNumber.replace(/[^0-9]/g, '');
}

export async function updatePremiumStatus(
  phoneNumber: string,
  isPremium: boolean,
  meta: Record<string, unknown> = {},
): Promise<void> {
  const normalizedPhone = normalizePhone(phoneNumber);
  if (!normalizedPhone) {
    throw new Error('phoneNumber_INVALID');
  }

  const userRef = firestore.collection('users').doc(normalizedPhone);
  await userRef.set(
    {
      phoneNumber: normalizedPhone,
      isPremium,
      premiumMeta: meta,
      premiumUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function logPassiveLicenseRevenue(params: {
  tenantId: string;
  phoneNumber: string;
  originalAmount: number;
  surchargeAmount: number;
  adjustedTotalAmount: number;
  route: string;
  subscriptionType: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const normalizedPhone = normalizePhone(params.phoneNumber);
  await firestore.collection('_private_license_revenue').add({
    tenantId: params.tenantId,
    phoneNumber: normalizedPhone,
    originalAmount: params.originalAmount,
    surchargeAmount: params.surchargeAmount,
    adjustedTotalAmount: params.adjustedTotalAmount,
    route: params.route,
    subscriptionType: params.subscriptionType,
    details: params.details ?? {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function createRecurringSubscriptionRecord(params: {
  tenantId: string;
  phoneNumber: string;
  amountKESCents: bigint;
  interval: 'WEEKLY' | 'MONTHLY';
  subscriptionId: string;
  nextBillingAt: Date;
}): Promise<void> {
  const normalizedPhone = normalizePhone(params.phoneNumber);
  await firestore.collection('recurring_subscriptions').doc(params.subscriptionId).set({
    tenantId: params.tenantId,
    phoneNumber: normalizedPhone,
    amountKESCents: params.amountKESCents.toString(),
    interval: params.interval,
    nextBillingAt: params.nextBillingAt,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    active: true,
  });
}

export { firestore };

# API Reference

## Base URL

```
https://securerise-gen-lang-client-0791519677-uc.a.run.app
```

## Authentication

All requests must include:

- **Authorization**: `Bearer {token}` (in Authorization header)
- **X-Idempotency-Key**: UUID or timestamp (prevents duplicate processing)

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Idempotency-Key: $(uuidgen)" \
     https://securerise-gen-lang-client-XXXX-uc.a.run.app/handshake/status
```

---

## Endpoints

### Create Handshake

Create a new locked handshake for a payout.

```http
POST /handshake/create
Content-Type: application/json
Authorization: Bearer {token}
X-Idempotency-Key: {uuid}

{
  "merchantId": "merchant_123",
  "amountInCents": "50000",
  "currency": "USD",
  "recipientId": "recipient_456"
}
```

**Response (201 Created)**

```json
{
  "handshakeId": "hs_abcd1234",
  "status": "LOCKED",
  "amountInCents": "50000",
  "currency": "USD",
  "otpExpiry": "2026-05-11T16:30:00Z",
  "createdAt": "2026-05-11T16:15:00Z"
}
```

---

### Verify Handshake (OTP + Safety Net)

Verify OTP and bind safety net proof-of-delivery.

```http
POST /handshake/{handshakeId}/verify
Content-Type: application/json
Authorization: Bearer {token}
X-Idempotency-Key: {uuid}

{
  "otp": "123456",
  "safetyNetImageUrl": "https://gcs-bucket.storage.googleapis.com/photo.jpg",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "timestamp": "2026-05-11T16:20:00Z"
  }
}
```

**Response (200 OK)**

```json
{
  "handshakeId": "hs_abcd1234",
  "status": "RELEASED",
  "verification": {
    "otpVerified": true,
    "safetyNetBound": true,
    "verifiedAt": "2026-05-11T16:20:45Z"
  },
  "releaseTxn": "txn_xyz789"
}
```

**Error Responses**

- `400 Bad Request` — OTP invalid or expired
- `422 Unprocessable Entity` — Safety Net proof invalid
- `404 Not Found` — Handshake not found

---

### Get Handshake Status

Retrieve current handshake status and metadata.

```http
GET /handshake/{handshakeId}
Authorization: Bearer {token}
```

**Response (200 OK)**

```json
{
  "handshakeId": "hs_abcd1234",
  "status": "RELEASED",
  "amountInCents": "50000",
  "currency": "USD",
  "merchantId": "merchant_123",
  "recipientId": "recipient_456",
  "createdAt": "2026-05-11T16:15:00Z",
  "verifiedAt": "2026-05-11T16:20:45Z",
  "verification": {
    "otpVerified": true,
    "safetyNetBound": true,
    "proofUrl": "https://gcs-bucket.storage.googleapis.com/photo.jpg",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    }
  }
}
```

---

### Release Payout (Idempotent)

Release funds from a verified handshake. **Idempotent** — same request is safe to retry.

```http
POST /handshake/{handshakeId}/release
Authorization: Bearer {token}
X-Idempotency-Key: {uuid}

{}
```

**Response (200 OK)**

```json
{
  "handshakeId": "hs_abcd1234",
  "status": "RELEASED",
  "releaseTxn": "txn_xyz789",
  "releasedAt": "2026-05-11T16:22:00Z"
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "OTP_INVALID",
    "message": "OTP does not match",
    "timestamp": "2026-05-11T16:20:45Z"
  }
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `OTP_INVALID` | 400 | OTP incorrect or expired |
| `SAFETY_NET_PROOF_INVALID` | 422 | Photo/GPS data invalid |
| `HANDSHAKE_NOT_FOUND` | 404 | Handshake ID doesn't exist |
| `INVALID_STATE` | 409 | Handshake in wrong state for operation |
| `MERCHANT_NOT_AUTHORIZED` | 403 | Merchant not authorized for this handshake |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Data Types & Validation

### Amount Handling

**Amounts are always strings** to preserve precision (BigInt compatibility):

```json
{
  "amountInCents": "50000"
}
```

Not an integer — always a string:
```json
{
  "amountInCents": "50000"  // ✓ Correct
}
```

---

### Location Object

GPS coordinates captured at verification time:

```json
{
  "latitude": 40.7128,    // Number, -90 to 90
  "longitude": -74.0060,  // Number, -180 to 180
  "timestamp": "2026-05-11T16:20:00Z"  // ISO 8601
}
```

---

## Rate Limiting

Requests are rate-limited by `Authorization` token:

- **100 requests/minute** per merchant token
- **1000 requests/hour** per merchant token

Response header includes:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1715416800
```

---

## Idempotency

Use the **X-Idempotency-Key** header to ensure safe retries:

```bash
curl -X POST https://securerise-gen-lang-client-XXXX-uc.a.run.app/handshake/create \
  -H "X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  ...
```

Same key + same request body = guaranteed same response (idempotent).

**Idempotency Key lifetime**: 24 hours

---

## SDK Examples

### Flutter

```dart
import 'package:frontend_flutter/services/trust_client.dart';

final trustClient = TrustClient(authToken: 'your_token');

// Create handshake
final hs = await trustClient.createHandshake(
  merchantId: 'merchant_123',
  amountInCents: '50000',  // String for BigInt safety
  currency: 'USD',
  recipientId: 'recipient_456',
);

// Verify with OTP + Safety Net
final verified = await trustClient.verifyHandshake(
  handshakeId: hs['handshakeId'],
  otp: '123456',
  safetyNetImageUrl: 'https://...',
  latitude: 40.7128,
  longitude: -74.0060,
);
```

### cURL

```bash
# Create handshake
curl -X POST https://securerise-gen-lang-client-XXXX-uc.a.run.app/handshake/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_123",
    "amountInCents": "50000",
    "currency": "USD",
    "recipientId": "recipient_456"
  }'
```

---

## Webhooks (Future)

Webhooks will notify your backend of state changes:

- `handshake.verified` — OTP verified
- `handshake.released` — Payout released
- `handshake.failed` — Verification failed
- `handshake.disputed` — Dispute initiated

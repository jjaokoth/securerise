# API Reference

## Handshake Lifecycle

Securerise implements a secure escrow handshake lifecycle with AI verification:

1. **INITIATED**: Handshake created with transaction details and UUID generation.
2. **LOCKED**: Funds reserved in escrow, awaiting proof-of-delivery.
3. **AI_VERIFYING**: Image uploaded and processed by Gemini 1.5 Flash AI.
4. **RELEASED**: AI confirms asset match, funds released to payout rails.
5. **REFUNDED**: Verification failed, funds returned to buyer.

## Currency Precision

All monetary values use BigInt for 64-bit integer cents to ensure bank-grade precision:

- Amounts stored as `bigint` in PostgreSQL
- JSON serialization handled via global polyfill
- Prevents floating-point errors in financial calculations

## Core Endpoints

### POST /v1/handshakes
Creates a new escrow handshake.

**Request Body:**
```json
{
  "amountKESCents": "125000",
  "amountUSDCents": "10000",
  "exchangeRateKESPerUSDC": "1250000",
  "route": "MPESA",
  "handshakeMetadata": {
    "itemDescription": "Mercedes W123 Headlights"
  }
}
```

**Response:**
```json
{
  "id": 1,
  "handshakeId": "hs_abc123",
  "status": "OPEN",
  "evidenceUploadUrl": "/api/payout/handshakes/hs_abc123/verify-proof"
}
```

### POST /v1/handshakes/:id/verify
Uploads image for AI verification.

**Request:** Multipart form-data with `image` field.

**Response:**
```json
{
  "verification": {
    "isMatch": true,
    "confidence": 0.95,
    "extractedDetails": "Part number: ABC-123"
  },
  "mappedStatus": "RELEASED",
  "statusLabel": "AI_VERIFIED"
}
```
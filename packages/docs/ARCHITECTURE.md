# Architecture Overview

## System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                     Universal Trust Layer                       │
│              (Securerise Monorepo Architecture)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Field Agent (Flutter Mobile/Web)            │  │
│  │  ┌─────────────┐  ┌──────────┐  ┌───────────────────┐   │  │
│  │  │ OTP Input   │  │ Camera   │  │ GPS Location      │   │  │
│  │  │ (6-digit)   │  │ Proof    │  │ (Geolocator)      │   │  │
│  │  └─────────────┘  └──────────┘  └───────────────────┘   │  │
│  │                                                          │  │
│  │  TrustClient Service (HTTP + Headers)                   │  │
│  │  - Idempotency Keys (UUID)                              │  │
│  │  - Bearer Token Authorization                           │  │
│  │  - String amounts (BigInt safety)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                 │
│                              │ HTTPS/TLS                       │
│                              ↓                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Node.js Backend (Google Cloud Run)              │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │          Handshake Controller                       │ │  │
│  │  │  POST /handshake/create          → Lock            │ │  │
│  │  │  POST /handshake/:id/verify      → Verify OTP      │ │  │
│  │  │  POST /handshake/:id/release     → Release Payout  │ │  │
│  │  │  GET  /handshake/:id             → Status          │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │      Trust Layer Services                          │ │  │
│  │  │  - OTP Generation & Hashing (PBKDF2-SHA256)       │ │  │
│  │  │  - Safety Net Proof Binding                       │ │  │
│  │  │  - State Machine Enforcement (LOCKED→RELEASED)    │ │  │
│  │  │  - Idempotency Check (via Redis/Cache)            │ │  │
│  │  │  - Audit Logging                                  │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │       Database Layer (Prisma ORM)                  │ │  │
│  │  │  - PostgreSQL (handshakes, verifications, logs)   │ │  │
│  │  │  - Multi-tenant isolation by merchantId           │ │  │
│  │  │  - Immutable audit records                        │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │      External Services                             │ │  │
│  │  │  - Google Cloud Storage (proof photos)            │ │  │
│  │  │  - Google Cloud Logging (audit trails)            │ │  │
│  │  │  - Secret Manager (encryption keys)               │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Handshake Verification

### Phase 1: Lock (Merchant Creates Handshake)

```
Merchant Backend
    │
    ├─ POST /handshake/create
    │   { merchantId, amountInCents, currency, recipientId }
    │
    ↓
Securerise Backend
    │
    ├─ Validate merchant authorization
    ├─ Generate 6-digit OTP
    ├─ Hash OTP (PBKDF2-SHA256)
    ├─ Create handshake record (LOCKED)
    │   - Store: { id, merchantId, amountInCents, otpHash, salt }
    │   - Status: LOCKED
    ├─ Send OTP to Field Agent (SMS/App)
    │
    ↓
Response: { handshakeId, status: "LOCKED", otpExpiry }
```

### Phase 2: Verify (Field Agent Submits OTP + Safety Net)

```
Field Agent (Flutter)
    │
    ├─ User enters 6-digit OTP
    ├─ Camera captures proof photo
    ├─ Geolocator retrieves GPS coordinates
    │
    ├─ POST /handshake/:id/verify
    │   {
    │     otp: "123456",
    │     safetyNetImageUrl: "base64_or_url",
    │     location: { latitude, longitude, timestamp }
    │   }
    │
    ↓
Securerise Backend
    │
    ├─ Retrieve handshake record (LOCKED)
    ├─ Hash incoming OTP with stored salt
    ├─ Constant-time comparison: incomingOtpHash == storedOtpHash
    │   If mismatch → Status: FAILED, Return 400
    │
    ├─ If OTP matches:
    │   ├─ Upload proof photo to Google Cloud Storage
    │   ├─ Compute photo hash (SHA256)
    │   ├─ Bind proof to handshake record
    │   │   - Store: { photoUrl, photoHash, gpsCoordinates, timestamp }
    │   ├─ Update Status: RELEASED
    │   ├─ Log verification event (audit trail)
    │
    ├─ Generate release transaction ID
    │
    ↓
Response: { handshakeId, status: "RELEASED", releaseTxn, verification }
```

### Phase 3: Release (Backend Processes Payout)

```
Merchant Backend
    │
    ├─ GET /handshake/:id (check status)
    │   Response: status = RELEASED ✓
    │
    ├─ POST /handshake/:id/release
    │   (Idempotent - same key returns same result)
    │
    ↓
Securerise Backend
    │
    ├─ Check status: RELEASED (required)
    ├─ Verify idempotency key (no duplicate processing)
    ├─ Process payout (atomic)
    │   - Debit escrow account
    │   - Credit recipient account
    │   - Mark handshake as RELEASED_CONFIRMED
    ├─ Log release event
    │
    ↓
Response: { handshakeId, status: "RELEASED_CONFIRMED", releaseTxn }
```

---

## State Machine

```
                  ┌─────────────────────────┐
                  │        CREATED          │
                  │  (Initial handshake)    │
                  └────────────┬────────────┘
                               │
                               ↓
                  ┌─────────────────────────┐
                  │        LOCKED           │
                  │ (Escrow reserved)       │
                  │ (OTP sent to Field Ag)  │
                  └────────────┬────────────┘
                    │          │          │
                    │ OTP OK   │ OTP Bad  │ Timeout
                    ↓          ↓          ↓
       ┌─────────────────┐  ┌────────┐   ┌────────┐
       │ SAFETY_NET_PEND │  │ FAILED │   │ EXPIRED│
       │ (Verifying PoD) │  │        │   │        │
       └────────┬────────┘  └────────┘   └────────┘
                │
                │ Safety Net OK
                ↓
       ┌─────────────────┐
       │    RELEASED     │
       │ (Payout ready)  │
       └────────┬────────┘
                │
                │ Release confirmed
                ↓
       ┌─────────────────┐
       │  RELEASED_CONF  │
       │ (Payout done)   │
       └─────────────────┘

       Future States:
       Any → DISPUTED (manual review)
```

---

## Security Model

### OTP Security

**Generation**
```
1. Generate random 6-digit number (000000-999999)
2. Create random salt (32 bytes)
3. Hash: PBKDF2-SHA256(OTP + salt, iterations=10000)
4. Store: { otpHash, salt }
5. Discard: OTP plaintext is never stored
```

**Verification**
```
1. Retrieve stored salt from handshake
2. Hash incoming OTP: PBKDF2-SHA256(incomingOtp + salt, iterations=10000)
3. Constant-time compare: hashA == hashB
   - Prevents timing attacks
4. Return MATCH or MISMATCH
```

### Safety Net Security

**Proof Binding**
```
1. Receive proof photo (base64 or URL)
2. Store in Google Cloud Storage (encrypted at rest)
3. Compute proof hash: SHA256(photoData)
4. Bind to handshake:
   {
     proofUrl: "gs://bucket/photos/...",
     proofHash: "abc123...",
     gpsCoordinates: { latitude, longitude },
     timestamp: "2026-05-11T16:20:00Z"
   }
5. Handshake now immutable (proof-bound)
```

**Verification Flow**
```
If OTP matches:
  ├─ Is proof valid (not corrupted)?
  ├─ Is GPS within expected bounds?
  ├─ Is timestamp reasonable (not future)?
  └─ If all pass → Status = RELEASED
  └─ If any fail → Status = FAILED
```

### Multi-Tenant Isolation

```
Every query filters by merchantId:

Query: SELECT * FROM handshakes WHERE id = ? AND merchantId = ?
       (Not just: SELECT * FROM handshakes WHERE id = ?)

This ensures:
- Merchant A cannot access Merchant B's handshakes
- Audit logs include merchant context
- Cross-tenant data leaks impossible
```

### API Authentication

```
Header: Authorization: Bearer {JWT_TOKEN}

Token contains:
- Issuer: Securerise
- Subject: merchantId
- Expires: 24 hours
- Signature: HS256(secret)
```

---

## Deployment

### Google Cloud Run

```yaml
service: securerise
platform: managed
region: us-central1
memory: 512MB
timeout: 60s

Environment:
- DATABASE_URL: Cloud SQL PostgreSQL
- GCS_BUCKET: Cloud Storage bucket for proofs
- JWT_SECRET: Secret Manager secret
- ENCRYPTION_KEY: Secret Manager secret
```

### Database (Cloud SQL)

```sql
-- PostgreSQL 14+
CREATE DATABASE securerise;

CREATE TABLE merchants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  apiKey TEXT UNIQUE NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW()
);

CREATE TABLE handshakes (
  id UUID PRIMARY KEY,
  merchantId UUID REFERENCES merchants(id) NOT NULL,
  amountInCents BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,  -- LOCKED, RELEASED, FAILED, DISPUTED
  otpHash TEXT,
  otpSalt TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  verifiedAt TIMESTAMP,
  releaseAt TIMESTAMP,
  INDEX (merchantId, status)
);

CREATE TABLE proofs (
  id UUID PRIMARY KEY,
  handshakeId UUID REFERENCES handshakes(id) NOT NULL,
  photoUrl TEXT,
  photoHash TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  timestamp TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW()
);

CREATE TABLE auditLogs (
  id UUID PRIMARY KEY,
  merchantId UUID REFERENCES merchants(id),
  handshakeId UUID REFERENCES handshakes(id),
  event TEXT,
  result TEXT,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

---

## Monitoring & Observability

### Key Metrics

- **OTP verification success rate** (target: >95%)
- **Safety Net binding success rate** (target: >90%)
- **API latency** (p99 < 500ms)
- **Failed verifications** (alert if >5% in 5min)

### Logging

All events logged to Google Cloud Logging:
```
{
  "timestamp": "2026-05-11T16:20:45Z",
  "severity": "INFO",
  "handshakeId": "hs_abcd1234",
  "merchantId": "merchant_123",
  "event": "otp_verified",
  "result": "success"
}
```

---

## Future Extensions

1. **Dispute Resolution** (Manual review workflow)
2. **Webhooks** (Real-time state change notifications)
3. **Multi-signature Verification** (Add second approver)
4. **Batch Release** (Process multiple handshakes atomically)
5. **Compliance Reporting** (PCI-DSS, SOC 2 audit logs)

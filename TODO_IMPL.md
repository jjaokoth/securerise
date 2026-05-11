# Securerise Hybrid Payment Processor Upgrade — TODO (Implementation)

## Step 1 — Prisma schema
- [ ] Add OTP fields: hashed OTP, OTP matched timestamp, otp attempts counters
- [ ] Add PoD immutables: photo URL reference + GPS coordinates reference
- [ ] Add encrypted-at-rest payloads: ciphertext + iv/authTag fields
- [ ] Add integrity binding hash (PoD integrity hash) stored immutably
- [ ] Add atomic release idempotency fields and optimistic state fields for safe transitions

## Step 2 — Transaction state machine types
- [ ] Add TS state machine output types (INITIATED → LOCKED → OTP_SENT → WAITING_FOR_POD → OTP_MATCHED_AND_POD_VERIFIED → RELEASED/FAILED/DISPUTED)

## Step 3 — Security helpers
- [ ] Add Securerise proprietary header middleware for new OTP/PoD endpoints
- [ ] Add encryption utilities (AES-256-GCM) for PoD payloads
- [ ] Add hashing utilities for OTP comparison (timing-safe)

## Step 4 — Controllers & routes
- [ ] Extend HandshakeController.createHandshake to generate OTP and store hashed OTP
- [ ] Add endpoint: POST /v1/handshakes/:id/otp/verify
- [ ] Add endpoint: POST /v1/handshakes/:id/pod/submit (multipart: image + GPS fields)
- [ ] Ensure release gating: only set RELEASED when (OTP_Match && Image_UploadSuccess) and PoD integrity present

## Step 5 — PaymentChannelManager
- [ ] Create PaymentChannelManager skeleton with pipes for MPESA/BANK/INTERNAL_LEDGER
- [ ] Use BigInt for balances and transfer amounts

## Step 6 — Atomic settlement + idempotency
- [ ] Implement atomic release in DB transaction with conditional update
- [ ] Replace routing execution in src/payout/router.ts with PaymentChannelManager skeleton usage

## Step 7 — README & docs
- [ ] Rewrite README vision + double-layer verification explanation
- [ ] Update API docs (at least narrative + state machine diagram)

## Step 8 — Migrations/build
- [ ] Create prisma migration(s)
- [ ] Run npm run build + tsc --noEmit


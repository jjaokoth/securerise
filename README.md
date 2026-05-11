# Securerise: Universal Trust Layer for Fintech & Logistics

Securerise is a Universal Trust Layer for fintech and logistics. The platform secures payment intent, physical proof-of-delivery, and automated settlement through an OTP Handshake + Safety Net architecture.

## Project Vision

Securerise empowers secure commercial exchange across logistics and financial corridors by creating a trusted boundary between authorization and delivery. The architecture is optimized for high-value operations, including agribusiness, supply chain logistics, and payment settlement.

## Project Roadmap

### Phase 1: Handshake Core (Current)
- OTP-based transaction intent capture
- Escrow locking mechanism
- Basic webhook integration for settlement

### Phase 2: Hybrid-Trust Mobile App (In Progress)
- Flutter-based cross-platform mobile app (Web, iOS, Android)
- Safety Net UI: OTP input, camera PoD, GPS binding
- AI-powered verification with multimodal analysis

### Phase 3: Global Scaling
- Multi-region Cloud Run deployment
- Enterprise API integrations
- Advanced fraud detection and compliance features

## Core Technology Stack

- **TypeScript**
- **Node.js**
- **PostgreSQL** with Prisma ORM
- **Firebase** for secure orchestration and webhook management
- **Vertex AI / Gemini 1.5 Flash** for multimodal verification

## Key Architecture

### OTP Handshake + Safety Net
The platform couples a one-time transaction intent with a safety net of photo evidence and GPS location. This ensures funds remain locked until verification conditions are met.

### AI Handshake State Machine
The settlement flow is staged:

- `LOCKED`: transaction intent captured and escrow reserved
- `VERIFIED`: proof-of-delivery and risk checks validated
- `RELEASED`: funds executed to payout rail

This model reduces fraud exposure while preserving operational momentum.

### High-Precision Validation
Financial values are managed using BigInt-safe handling in the backend, while cross-platform clients pass amounts as strings to avoid precision loss.

## Deployment

This repository includes containerization and automatic deployment to Google Cloud Run.

## Setup

```bash
# Clone the repository
git clone https://github.com/jjaokoth/securerise.git
cd securerise

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run locally
npm run dev
```

## Google Cloud Run

Deployment is automated via `.github/workflows/deploy.yml` on pushes to `main`.

## Contact

Technical and investment inquiries: **securerise@outlook.com**

---

Note: Specific verification internals are intentionally abstracted to protect intellectual property.

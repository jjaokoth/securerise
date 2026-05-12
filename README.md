# Universal Trust Layer — Secure Payment Release System

A **Universal Trust Layer** securing multi-stage commercial exchange across fintech and logistics by coupling hybrid-trust verification (OTP + Safety Net) with atomic state transitions and proof-of-delivery binding. Now featuring **universal payment provider integration** supporting M-Pesa, Airtel Money, bank transfers, and extensible to any payment gateway.

**Supports:** Web • iOS • Android • Node.js Backend  
**Payment Integrations:** M-Pesa • Airtel Money • Bank Transfers • Extensible API

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Payment Provider Integrations](#payment-provider-integrations)
- [Quick Start](#quick-start)
- [Installation & Setup](#installation--setup)
- [API Documentation](#api-documentation)
- [Mobile App Usage](#mobile-app-usage)
- [Contributing](#contributing)

---

## Overview

The Universal Trust Layer (UTL) revolutionizes secure payment releases by implementing a two-factor verification system that combines digital OTP authentication with physical proof-of-delivery. This ensures that funds are only released when the authorized field agent is physically present at the delivery location with verifiable evidence.

### Core Problem Solved

Traditional payment systems release funds immediately upon order confirmation, creating risks of fraud, non-delivery, or disputes. UTL introduces a "trust lock" that holds funds until physical delivery is verified through:

1. **OTP Verification**: 6-digit one-time password sent to authorized personnel
2. **Safety Net Proof**: GPS coordinates + photo evidence captured at delivery point
3. **Atomic State Transitions**: Funds only release after both verifications pass

### Universal Payment Integration

UTL now supports integration with all major payment providers through a modular architecture:

- **M-Pesa**: Mobile money payments across East Africa
- **Airtel Money**: Pan-African mobile payment solutions
- **Bank Transfers**: Direct bank account deposits
- **Extensible API**: Add any payment provider via plugin architecture

---

## Key Features

### 🔐 Hybrid-Trust Verification
- **Layer 1**: OTP-based authorization (PBKDF2-SHA256 hashed, never stored in plaintext)
- **Layer 2**: Safety Net proof-of-delivery (GPS + photo binding)
- **Brute-force Protection**: Rate limiting and constant-time comparison

### 💰 Universal Payment Support
- **Multi-Provider**: Single API for all payment methods
- **Atomic Transactions**: Funds held until verification complete
- **Instant Release**: Automatic payout upon successful verification
- **Audit Trail**: Complete transaction history with evidence

### 📱 Cross-Platform Mobile App
- **Flutter Framework**: Native performance on iOS, Android, and Web
- **Real-time Camera**: Proof-of-delivery photo capture
- **GPS Integration**: Location verification with high accuracy
- **Offline Support**: Queue verifications for later sync

### 🏗️ Enterprise-Grade Architecture
- **Microservices**: Modular backend with clear separation of concerns
- **Multi-Tenant**: Isolated merchant environments
- **Cloud-Native**: Deployed on Google Cloud Run with auto-scaling
- **Database**: PostgreSQL with Prisma ORM for type safety

### 🔒 Security & Compliance
- **End-to-End Encryption**: All sensitive data encrypted at rest and in transit
- **Idempotency**: Prevents duplicate transactions
- **Audit Logging**: Comprehensive activity tracking
- **GDPR Compliant**: Data minimization and user consent

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     Universal Trust Layer                       │
│              (Securerise Monorepo Architecture)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Field Agent (Flutter Mobile/Web)            │  │
│  │  ┌─────────────┐  ┌──────────┐  ┌───────────────────┐   │  │
│  │  │ OTP Input   │  │ Camera   │  │ GPS Location      │   │
│  │  │ (6-digit)   │  │ Proof    │  │ (Geolocator)      │   │
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
│  │                                                          │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │      Payment Provider Integrations                 │ │  │
│  │  │  - M-Pesa API Integration                         │ │  │
│  │  │  - Airtel Money API Integration                   │ │  │
│  │  │  - Bank Transfer API Integration                  │ │  │
│  │  │  - Extensible Provider Plugin System              │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                          │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │       Database Layer (Prisma ORM)                  │ │  │
│  │  │  - PostgreSQL (handshakes, verifications, logs)   │ │  │
│  │  │  - Multi-tenant isolation by merchantId           │ │  │
│  │  │  - Immutable audit records                        │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                          │
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

### State Machine

```
┌──────────────────────────────────────────────────────────────┐
│                   Handshake Lifecycle                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  LOCKED ──[OTP verified]──> SAFETY_NET_PENDING              │
│                                                              │
│  SAFETY_NET_PENDING ──[PoD bound]──> RELEASED               │
│                                                              │
│  Any stage ──[verification fails]──> FAILED                 │
│                                                              │
│  Any stage ──[dispute initiated]──> DISPUTED (future)       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Payment Provider Integrations

UTL supports seamless integration with multiple payment providers through a unified API. Each provider is implemented as a modular service that can be easily extended or replaced.

### Supported Providers

#### M-Pesa Integration
- **API**: Safaricom M-Pesa API
- **Regions**: Kenya, Tanzania, Mozambique
- **Features**: C2B, B2C, B2B transactions
- **Settlement**: Real-time mobile money transfers

#### Airtel Money Integration
- **API**: Airtel Africa Payment Gateway
- **Regions**: 14 African countries
- **Features**: Mobile money, airtime, data bundles
- **Settlement**: Instant cross-border payments

#### Bank Transfer Integration
- **API**: Local banking APIs (customizable per country)
- **Features**: EFT, RTGS, direct account credits
- **Settlement**: 1-3 business days depending on bank

### Adding New Payment Providers

To integrate a new payment provider:

1. **Create Provider Service** in `packages/backend/src/services/payments/`
   ```typescript
   export class NewProviderService implements PaymentProvider {
     async initiatePayment(amount: BigInt, recipient: string): Promise<PaymentResult> {
       // Implementation
     }
     
     async checkStatus(transactionId: string): Promise<PaymentStatus> {
       // Implementation
     }
   }
   ```

2. **Register Provider** in `packages/backend/src/services/payment-factory.ts`
   ```typescript
   const providers = {
     'mpesa': new MpesaService(),
     'airtel': new AirtelService(),
     'bank': new BankTransferService(),
     'newprovider': new NewProviderService(),
   };
   ```

3. **Configure Environment Variables**
   ```env
   NEWPROVIDER_API_KEY=your-api-key
   NEWPROVIDER_BASE_URL=https://api.newprovider.com
   ```

4. **Update API Documentation** in `packages/docs/API_REFERENCE.md`

### Configuration

Set payment provider credentials in your `.env` file:

```env
# M-Pesa
MPESA_CONSUMER_KEY=your-consumer-key
MPESA_CONSUMER_SECRET=your-consumer-secret
MPESA_SHORTCODE=your-shortcode
MPESA_PASSKEY=your-passkey

# Airtel Money
AIRTEL_CLIENT_ID=your-client-id
AIRTEL_CLIENT_SECRET=your-client-secret
AIRTEL_ENVIRONMENT=sandbox|production

# Bank Transfers
BANK_API_KEY=your-bank-api-key
BANK_BASE_URL=https://api.yourbank.com
```

---

## Quick Start

### Prerequisites

- **Node.js** 18+ (backend)
- **Flutter** 3.24+ (frontend)
- **Google Cloud SDK** (for deployment)
- **Docker** (for containerized backend)
- **PostgreSQL** (database)

### One-Command Setup

```bash
# Clone and setup
git clone https://github.com/jjaokoth/securerise.git
cd securerise

# Install all dependencies
npm run install:all

# Configure environment
cp packages/backend/.env.example packages/backend/.env
# Edit .env with your database and payment provider credentials

# Setup database
npm run db:setup

# Start development servers
npm run dev
```

This will start:
- Backend on `http://localhost:3000`
- Flutter web app on `http://localhost:8080`

---

## Installation & Setup

### Backend Setup

```bash
cd packages/backend

# Install dependencies
npm install

# Database setup
npx prisma generate
npx prisma db push

# Configure environment
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/securerise

# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
GCS_BUCKET=your-bucket-name

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key

# Payment Providers
MPESA_CONSUMER_KEY=...
AIRTEL_CLIENT_ID=...

# API
API_BASE_URL=http://localhost:3000
```

### Mobile App Setup

```bash
cd packages/frontend_flutter

# Install Flutter dependencies
flutter pub get

# Configure environment
cp .env.example .env
```

Edit `.env`:

```env
API_BASE_URL=http://localhost:3000
API_KEY=your-internal-api-key
```

### Running the Application

```bash
# Backend
cd packages/backend && npm run dev

# Mobile App (separate terminal)
cd packages/frontend_flutter && flutter run

# Or run on web
cd packages/frontend_flutter && flutter run -d web
```

---

## API Documentation

### Authentication

All API requests require:
- **Authorization**: `Bearer {token}` header
- **X-Idempotency-Key**: UUID to prevent duplicates

### Core Endpoints

#### Create Handshake with Payment

```http
POST /api/v1/handshake/create
Content-Type: application/json
Authorization: Bearer {token}
X-Idempotency-Key: {uuid}

{
  "merchantId": "merchant_123",
  "amountInCents": "50000",
  "currency": "KES",
  "recipient": "+254712345678",
  "paymentProvider": "mpesa",
  "description": "Delivery payment for Order #123"
}
```

**Response:**
```json
{
  "handshakeId": "hs_abcd1234",
  "status": "LOCKED",
  "otp": "123456",
  "expiresAt": "2026-05-12T12:30:00Z",
  "paymentProvider": "mpesa"
}
```

#### Verify Handshake

```http
POST /api/v1/handshake/{handshakeId}/verify
Content-Type: application/json
Authorization: Bearer {token}
X-Idempotency-Key: {uuid}

{
  "otp": "123456",
  "photoBase64": "data:image/jpeg;base64,...",
  "latitude": -1.2833,
  "longitude": 36.8167
}
```

**Response:**
```json
{
  "status": "RELEASED",
  "transactionId": "txn_xyz789",
  "paymentStatus": "COMPLETED",
  "releasedAt": "2026-05-12T12:25:00Z"
}
```

### Payment-Specific Endpoints

#### Check Payment Status

```http
GET /api/v1/payments/{transactionId}/status
```

#### Supported Payment Providers

- `mpesa` - M-Pesa mobile money
- `airtel` - Airtel Money
- `bank` - Bank transfer
- `custom` - Custom provider

For complete API reference, see [packages/docs/API_REFERENCE.md](packages/docs/API_REFERENCE.md).

---

## Mobile App Usage

### Field Agent Workflow

1. **Receive Assignment**: Get handshake ID and OTP via SMS/app notification
2. **Launch App**: Open Safety Net screen with handshake ID
3. **Enter OTP**: Input the 6-digit code
4. **Capture Location**: App automatically gets GPS coordinates
5. **Take Photo**: Capture proof-of-delivery image
6. **Verify**: Submit all data for verification
7. **Confirmation**: Receive success notification and payment release

### Key Screens

#### Safety Net Verification Screen
- **OTP Input**: 6-digit field with validation
- **Camera Preview**: Real-time camera feed
- **GPS Status**: Location accuracy indicator
- **Loading States**: Clear feedback during verification
- **Error Handling**: User-friendly error messages

#### Features
- **Offline Queue**: Store verifications when offline
- **Photo Quality**: Automatic focus and lighting checks
- **Location Accuracy**: High-accuracy GPS with fallback
- **Biometric Auth**: Optional fingerprint/face unlock

### Permissions Required

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

**iOS** (`ios/Runner/Info.plist`):
```xml
<key>NSCameraUsageDescription</key>
<string>Camera access required for proof-of-delivery verification</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Location required for delivery point verification</string>
```

---

## Deployment

### Google Cloud Run

```bash
cd packages/backend

# Build and deploy
npm run deploy

# Or manually:
docker build -t securerise .
docker tag securerise gcr.io/YOUR_PROJECT/securerise
docker push gcr.io/YOUR_PROJECT/securerise
gcloud run deploy securerise --image gcr.io/YOUR_PROJECT/securerise --platform managed
```

### Mobile App Distribution

```bash
cd packages/frontend_flutter

# Build APK
flutter build apk --release

# Build iOS
flutter build ios --release

# Build Web
flutter build web --release
```

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Adding Payment Providers

1. Fork the repository
2. Create a new provider service in `packages/backend/src/services/payments/`
3. Implement the `PaymentProvider` interface
4. Add configuration to environment variables
5. Update documentation
6. Submit a pull request

### Development Workflow

```bash
# Setup development environment
npm run install:all
npm run db:setup

# Run tests
npm test

# Format code
npm run format

# Lint code
npm run lint
```

---

## Security

- **OTP Security**: PBKDF2-SHA256 hashing, never stored in plaintext
- **Data Encryption**: AES-256 encryption for sensitive data
- **API Security**: Bearer token authentication, idempotency keys
- **Audit Logging**: Complete transaction audit trail
- **Compliance**: GDPR, PCI DSS compliant architecture

---

## License

CC-BY-NC-ND-4.0

---

## Support

For issues, questions, or feature requests:

- **GitHub Issues**: [Open an issue](https://github.com/jjaokoth/securerise/issues)
- **Email**: securerise@outlook.com
- **Documentation**: [packages/docs/](packages/docs/)

**Maintainer**: Joshua Joel A Okoth

### Frontend (Flutter)

```bash
cd packages/frontend_flutter

# Install dependencies
flutter pub get

# Run on connected device/emulator
flutter run

# Or run on web
flutter run -d web
```

---

## Folder Structure

```
universal-trust-layer/
├── packages/
│   ├── backend/              # Node.js backend
│   │   ├── src/
│   │   ├── prisma/
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── frontend_flutter/     # Flutter application
│   │   ├── lib/
│   │   │   ├── main.dart
│   │   │   ├── services/
│   │   │   │   ├── trust_client.dart
│   │   │   │   └── location_service.dart
│   │   │   ├── screens/
│   │   │   │   └── safety_net_screen.dart
│   │   │   ├── widgets/
│   │   │   └── models/
│   │   ├── android/
│   │   ├── ios/
│   │   ├── web/
│   │   └── pubspec.yaml
│   │
│   └── docs/
│       ├── API_REFERENCE.md
│       ├── ARCHITECTURE.md
│       └── MOBILE_SETUP.md
│
├── .gitignore
└── README.md
```

---

## Backend Setup

### Deploy to Google Cloud Run

```bash
cd packages/backend

# Build Docker image
docker build -t securerise .

# Tag for Google Cloud Registry
docker tag securerise gcr.io/[PROJECT_ID]/securerise

# Push to GCR
docker push gcr.io/[PROJECT_ID]/securerise

# Deploy to Cloud Run
gcloud run deploy securerise \
  --image gcr.io/[PROJECT_ID]/securerise \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/securerise

# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
GCS_BUCKET=your-bucket-name

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key

# API
API_BASE_URL=https://securerise-gen-lang-client-XXXX-uc.a.run.app
```

---

## Mobile Setup

### Configure Environment

Create `.env` in `packages/frontend_flutter/`:

```env
API_BASE_URL=https://securerise-gen-lang-client-XXXX-uc.a.run.app
API_KEY=your-internal-api-key
```

### TrustClient Service

The [lib/services/trust_client.dart](packages/frontend_flutter/lib/services/trust_client.dart) provides:

- `createHandshake()`: Initialize a new payout flow
- `verifyHandshake()`: Submit OTP + safety net proof
- Automatic idempotency key generation
- BigInt-safe JSON serialization (amounts as strings)

### Safety Net Verification Screen

The [lib/screens/safety_net_screen.dart](packages/frontend_flutter/lib/screens/safety_net_screen.dart) implements:

**Features:**
- 6-digit OTP input with `PinCodeTextField` (visual feedback)
- Real-time camera preview (proof-of-delivery photo)
- GPS location capture via `Geolocator`
- Loading state with "Securing Transaction..." message
- Error handling with shake animation on validation failure

**User Flow:**
1. Field agent enters 6-digit OTP
2. System captures location (requires permission)
3. Agent takes proof-of-delivery photo via camera
4. Agent taps "Verify Handshake"
5. System sends OTP + photo + GPS to backend
6. Backend verifies and releases funds

### Permissions (Android)

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- Camera -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- Location -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Internet -->
<uses-permission android:name="android.permission.INTERNET" />
```

### Permissions (iOS)

Add to `ios/Runner/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera access required for proof-of-delivery photo capture</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>Location required for safety net verification at point of release</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Location required for proof of delivery binding</string>
```

### Running on Device

**Android Emulator:**
```bash
cd packages/frontend_flutter
flutter run
```

**iOS Simulator:**
```bash
cd packages/frontend_flutter
flutter run -d "iPhone 15 Pro"
```

**Physical Device:**
```bash
flutter run -v
```

### Testing Workflow

1. Create a handshake via backend: `POST /api/v1/handshake/create`
2. Launch SafetyNetScreen with `handshakeId`
3. Enter OTP (from backend response)
4. Take a photo and verify location
5. Tap "Verify Handshake"
6. Observe "Securing Transaction..." loading state
7. Check response for `status: "RELEASED"`

---

## API Documentation

### Handshake Endpoints

See [packages/docs/API_REFERENCE.md](packages/docs/API_REFERENCE.md) for complete REST API documentation.

#### Create Handshake

**Endpoint:** `POST /api/v1/handshake/create`

**Request:**
```json
{
  "tenantId": "merchant-123",
  "amount": 5000,
  "recipient": "+254712345678",
  "route": "MPESA"
}
```

**Response:**
```json
{
  "handshakeId": "hs_abc123def456",
  "otp": "123456",
  "status": "LOCKED",
  "expiresAt": "2026-05-12T12:30:00Z"
}
```

#### Verify Handshake

**Endpoint:** `POST /api/v1/handshake/verify`

**Headers:**
- `X-Idempotency-Key`: UUID or timestamp (required)
- `X-API-Key`: Internal API key (if configured)

**Request:**
```json
{
  "handshakeId": "hs_abc123def456",
  "otpCode": "123456",
  "safetyNetImageUrl": "https://storage.example.com/pod-photo-xyz.jpg",
  "gpsCoords": {
    "lat": -1.2833,
    "lng": 36.8167
  }
}
```

**Response:**
```json
{
  "status": "RELEASED",
  "transactionId": "txn_xyz789",
  "releasedAt": "2026-05-12T12:25:00Z"
}
```

#### Get Handshake Status

**Endpoint:** `GET /api/v1/handshake/:id`

**Response:**
```json
{
  "id": "hs_abc123def456",
  "status": "LOCKED",
  "createdAt": "2026-05-12T12:00:00Z",
  "expiresAt": "2026-05-12T12:30:00Z"
}
```

---

## Security Model

### OTP Storage
- **Hash Algorithm**: PBKDF2-SHA256 (10,000 iterations)
- **Never Stored**: OTP plaintext is generated, hashed, and discarded
- **Verification**: Incoming OTP is hashed using stored salt and compared

### Safety Net
- **GPS Binding**: Coordinates are captured at verification time
- **Evidence Integrity**: Photo hash + metadata bound to handshake
- **Audit Trail**: All verification attempts logged with timestamp and result

### API Authentication
- **Bearer Token**: X-Authorization header
- **Idempotency**: X-Idempotency-Key header (UUID or timestamp)
- **CORS**: Restricted to trusted domains

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

### Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes in `packages/backend` or `packages/frontend_flutter`
3. Test locally before pushing
4. Create a pull request with a clear description

---

## License

CC-BY-NC-ND-4.0

---

## Support

For issues, questions, or feature requests, open an issue on GitHub.

**Maintainer**: Joshua Joel A Okoth <securerise@outlook.com>

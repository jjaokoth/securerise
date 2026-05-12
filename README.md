# Universal Trust Layer — Triple-Platform Monorepo

A **Universal Trust Layer** securing multi-stage commercial exchange across fintech and logistics by coupling hybrid-trust verification (OTP + Safety Net) with atomic state transitions and proof-of-delivery binding.

**Supports:** Web • iOS • Android • Node.js Backend

---

## 📋 Table of Contents

- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Folder Structure](#folder-structure)
- [Backend Setup](#backend-setup)
- [Mobile Setup](#mobile-setup)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)

---

## Architecture

### Monorepo Structure

This monorepo is organized as a **Yarn/npm workspaces** project:

```
packages/
├── backend/           # Node.js/Express backend running on Google Cloud Run
├── frontend_flutter/  # Unified Flutter app for Web, iOS, and Android
└── docs/              # Shared API and architectural documentation
```

### Trust Model: Hybrid-Trust Handshake

Securerise enforces a two-layer verification model:

#### Layer A: OTP Authorization
- Server generates a **6-digit OTP**
- OTP is stored **hashed** (never plaintext)
- Verification compares OTP hashes via constant-time comparison
- Prevention: Brute-force resistant with rate limiting

#### Layer B: Safety Net Proof Binding
- **Proof-of-Delivery (PoD)** captures location and evidence (photos, timestamps)
- **GPS Coordinates**: Captured at verification time via Geolocator
- **Evidence Binding**: Photo + GPS metadata bound into the handshake record
- **Immutability**: Once bound, release becomes auditable and tamper-resistant
- Prevention: OTP-only attacks; ensures physical presence at point-of-release

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

### Multi-Tenant Isolation

- Each **merchant** is isolated at the database level
- All queries filtered by `merchantId`
- Audit logs include tenant context
- Cryptographic verification prevents cross-tenant access

---

## Quick Start

### Prerequisites

- **Node.js** 18+ (backend)
- **Flutter** 3.24+ (frontend)
- **Google Cloud SDK** (for local Cloud Run testing)
- **Docker** (for containerized backend)

### Backend

```bash
cd packages/backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your secrets

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev
```

Backend runs on `http://localhost:3000`

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

### Configure TrustClient

Edit [lib/services/trust_client.dart](packages/frontend_flutter/lib/services/trust_client.dart):

```dart
const String baseUrl = 'https://securerise-gen-lang-client-XXXX-uc.a.run.app';
```

### Permissions (Android)

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- Camera -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- Location -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### Permissions (iOS)

Add to `ios/Runner/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera access is required for proof-of-delivery photo capture</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>Location is required for safety net verification</string>
```

---

## API Documentation

See [packages/docs/API_REFERENCE.md](packages/docs/API_REFERENCE.md) for detailed endpoint documentation.

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/handshake/create` | Create a new locked handshake |
| `POST` | `/handshake/:id/verify` | Verify OTP and bind safety net proof |
| `GET` | `/handshake/:id` | Retrieve handshake status |
| `POST` | `/handshake/:id/release` | Release payout (idempotent) |

### Base URL

```
https://securerise-gen-lang-client-XXXX-uc.a.run.app
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

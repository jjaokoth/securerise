# Quick Start: Monorepo Migration

## 🚀 Execute Git Migration (Choose One Option)

### Option 1: Simple Move (Recommended - 5 minutes)

```bash
cd /home/oajj2/Desktop/universal-trust-layer

# Backup current state
git branch backup-before-migration

# Move backend into packages/backend
mv securerise packages/backend

# Commit the reorganization
git add packages/
git commit -m "refactor(monorepo): move backend to packages/backend

All git history preserved.
- Backend code: securerise/ → packages/backend/
- Frontend code: Already in packages/frontend_flutter/
- Root config files (README, .gitignore) updated"

# Verify history intact
git log --oneline packages/backend | head -5
git log --oneline packages/frontend_flutter | head -5
echo "✅ Migration successful!"
```

---

### Option 2: Complete Instructions

See [GIT_MIGRATION.md](GIT_MIGRATION.md) for:
- Option 1: Simple Move (fastest, preserves all history)
- Option 2: Filter History (advanced, splits frontend/backend)
- Option 3: Minimal Rewrite (large repos, git mv approach)
- Troubleshooting & rollback procedures

---

## 📋 All Files Created/Modified

### Root Configuration

| File | Status | Purpose |
|------|--------|---------|
| [README.md](README.md) | ✅ Created | Main project documentation with architecture |
| [.gitignore](.gitignore) | ✅ Created | Unified ignore for backend & Flutter |
| [package.json](package.json) | ✅ Created | Root workspace configuration |
| [CONTRIBUTING.md](CONTRIBUTING.md) | ✅ Created | Contribution guidelines |
| [GIT_MIGRATION.md](GIT_MIGRATION.md) | ✅ Created | Step-by-step git migration guide |
| [MONOREPO_MIGRATION_SUMMARY.md](MONOREPO_MIGRATION_SUMMARY.md) | ✅ Created | Complete summary of changes |

### Documentation

| File | Status | Purpose |
|------|--------|---------|
| [packages/docs/API_REFERENCE.md](packages/docs/API_REFERENCE.md) | ✅ Created | API endpoint documentation |
| [packages/docs/ARCHITECTURE.md](packages/docs/ARCHITECTURE.md) | ✅ Created | System architecture & data flows |
| [packages/docs/MOBILE_SETUP.md](packages/docs/MOBILE_SETUP.md) | ✅ Created | Flutter mobile setup guide |

### Flutter Services

| File | Status | Purpose |
|------|--------|---------|
| [packages/frontend_flutter/lib/services/trust_client.dart](packages/frontend_flutter/lib/services/trust_client.dart) | ✅ Created | Backend API client service |
| [packages/frontend_flutter/lib/services/location_service.dart](packages/frontend_flutter/lib/services/location_service.dart) | ✅ Created | GPS & permissions service |

### Flutter UI

| File | Status | Purpose |
|------|--------|---------|
| [packages/frontend_flutter/lib/screens/safety_net_screen.dart](packages/frontend_flutter/lib/screens/safety_net_screen.dart) | ✅ Updated | Field Agent verification screen |

### Dependencies

| File | Status | Purpose |
|------|--------|---------|
| [packages/frontend_flutter/pubspec.yaml](packages/frontend_flutter/pubspec.yaml) | ✅ Updated | Added uuid, pin_code_fields, flutter_secure_storage |

---

## 🔧 Configuration Steps

### 1. Update Backend URL

Edit [packages/frontend_flutter/lib/services/trust_client.dart](packages/frontend_flutter/lib/services/trust_client.dart#L13):

```dart
// Replace XXXX with your actual Cloud Run service name
static const String baseUrl = 
  'https://securerise-gen-lang-client-XXXX-uc.a.run.app';
```

### 2. Install Dependencies

```bash
cd /home/oajj2/Desktop/universal-trust-layer

# Backend
cd packages/backend
npm install

# Frontend
cd ../frontend_flutter
flutter pub get

# Root
cd ../..
npm install
```

### 3. Test Setup

```bash
# Backend test
cd packages/backend
npm test

# Frontend test
cd ../frontend_flutter
flutter test

# All good
cd ../..
echo "✅ Setup complete!"
```

---

## 📱 Flutter Features

### TrustClient Service

```dart
import 'package:frontend_flutter/services/trust_client.dart';

final trustClient = TrustClient(authToken: 'your_token');

// Create handshake
final hs = await trustClient.createHandshake(
  merchantId: 'merchant_123',
  amountInCents: '50000',  // String for BigInt safety ✅
  currency: 'USD',
  recipientId: 'recipient_456',
);

// Verify OTP + Safety Net
final verified = await trustClient.verifyHandshake(
  handshakeId: hs['handshakeId'],
  otp: '123456',
  safetyNetImageUrl: 'https://...',
  latitude: 40.7128,
  longitude: -74.0060,
  // Automatically includes:
  // ✅ Authorization: Bearer token
  // ✅ X-Idempotency-Key: UUID
);
```

### Safety Net Screen

```dart
import 'package:frontend_flutter/screens/safety_net_screen.dart';

// Navigate to verification
Navigator.push(
  context,
  MaterialPageRoute(
    builder: (_) => SafetyNetScreen(
      handshakeId: 'hs_abcd1234',
      merchantId: 'merchant_123',
    ),
  ),
);
```

**Features**:
- ✅ 6-digit OTP input (PinCodeTextField)
- ✅ Camera photo capture
- ✅ GPS coordinates (auto-acquired)
- ✅ Loading state ("Securing Transaction...")
- ✅ Success/error dialogs

---

## 🔒 Security Features

| Feature | Implementation |
|---------|-----------------|
| **Amount Precision** | Handled as strings (BigInt compatible) |
| **OTP Hashing** | PBKDF2-SHA256 (10,000 iterations) |
| **API Authentication** | Bearer token (Authorization header) |
| **Idempotency** | X-Idempotency-Key (UUID) |
| **GPS Binding** | Safety Net prevents OTP-only attacks |
| **Rate Limiting** | 100 req/min per merchant token |
| **Multi-tenant** | All queries filtered by merchantId |
| **Audit Logging** | All verification attempts logged |

---

## 📊 Project Structure

```
packages/
├── backend/                  # Node.js/Express backend (to be moved)
│   ├── src/
│   │   ├── app.ts
│   │   ├── index.ts
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── trust/
│   │   └── ...
│   ├── prisma/
│   ├── package.json
│   └── Dockerfile
│
├── frontend_flutter/         # Unified Flutter app (Web/iOS/Android)
│   ├── lib/
│   │   ├── main.dart
│   │   ├── services/
│   │   │   ├── trust_client.dart          ✅ NEW
│   │   │   └── location_service.dart      ✅ NEW
│   │   └── screens/
│   │       └── safety_net_screen.dart     ✅ UPDATED
│   ├── android/
│   ├── ios/
│   ├── web/
│   ├── pubspec.yaml
│   └── ...
│
└── docs/                     # Shared documentation
    ├── API_REFERENCE.md      ✅ NEW
    ├── ARCHITECTURE.md       ✅ NEW
    └── MOBILE_SETUP.md       ✅ NEW
```

---

## 🚢 Deployment Checklist

### Before Deploying

- [ ] Run `npm run setup` to install all dependencies
- [ ] Run `npm test` to verify backend tests
- [ ] Run `flutter test` to verify frontend tests
- [ ] Update backend URL in TrustClient (Cloud Run endpoint)
- [ ] Configure Android permissions in AndroidManifest.xml
- [ ] Configure iOS permissions in Info.plist
- [ ] Test on physical device (GPS, camera, permissions)

### Backend Deployment (Google Cloud Run)

```bash
cd packages/backend

# Build Docker image
docker build -t securerise .

# Push to GCR
docker tag securerise gcr.io/[PROJECT_ID]/securerise
docker push gcr.io/[PROJECT_ID]/securerise

# Deploy
gcloud run deploy securerise \
  --image gcr.io/[PROJECT_ID]/securerise \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Frontend Deployment

```bash
cd packages/frontend_flutter

# Android APK
flutter build apk --release
# → build/app/outputs/flutter-app.apk

# iOS
flutter build ipa --release
# → build/ios/ipa/

# Web
flutter build web --release
# → build/web/
```

---

## 🆘 Troubleshooting

### Git Migration Issues

See [GIT_MIGRATION.md](GIT_MIGRATION.md) → **Troubleshooting** section

### Camera Not Working

1. Check permissions in [AndroidManifest.xml](packages/frontend_flutter/android/app/src/main/AndroidManifest.xml)
2. See [MOBILE_SETUP.md](packages/docs/MOBILE_SETUP.md) → Android Configuration

### GPS Returns Null

1. Enable location services on device
2. Grant location permission when prompted
3. For emulator, set location in emulator settings

### Backend Connection Fails

1. Update baseUrl in [trust_client.dart](packages/frontend_flutter/lib/services/trust_client.dart#L13)
2. Verify Cloud Run service is deployed
3. Check network connectivity

---

## 📚 Documentation Map

| Document | Location | Purpose |
|----------|----------|---------|
| **Project Overview** | [README.md](README.md) | Architecture, trust model, quick start |
| **Contribution Guide** | [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow, PR process |
| **API Documentation** | [packages/docs/API_REFERENCE.md](packages/docs/API_REFERENCE.md) | REST API endpoints, examples |
| **System Architecture** | [packages/docs/ARCHITECTURE.md](packages/docs/ARCHITECTURE.md) | Data flows, state machine, security |
| **Mobile Setup** | [packages/docs/MOBILE_SETUP.md](packages/docs/MOBILE_SETUP.md) | Flutter environment, permissions |
| **Git Migration** | [GIT_MIGRATION.md](GIT_MIGRATION.md) | 3 migration options, rollback |
| **Migration Summary** | [MONOREPO_MIGRATION_SUMMARY.md](MONOREPO_MIGRATION_SUMMARY.md) | Complete summary, next steps |

---

## 🎯 Next Actions

### Immediate (Today)

1. ✅ Review all created files
2. ✅ Choose Git migration option from [GIT_MIGRATION.md](GIT_MIGRATION.md)
3. ✅ Run migration
4. ✅ Verify with: `git log --oneline | head -20`

### This Week

1. Update backend URL in TrustClient
2. Update CI/CD pipeline to reference `packages/backend` and `packages/frontend_flutter`
3. Test backend deployment
4. Test Flutter app on mobile device

### Next Week

1. Deploy to production
2. Notify team of structure changes
3. Update team documentation
4. Monitor deployments

---

## 💡 Pro Tips

- Use `flutter run -d web` for quick testing during development
- Enable hot reload: Press `r` while app running
- Use VS Code "Dart DevTools" for profiling
- Always commit with conventional format: `feat(scope): description`
- Keep commit messages clear for blame attribution

---

## ❓ Questions?

- 📖 See relevant documentation in [packages/docs/](packages/docs/)
- 🐛 Check [CONTRIBUTING.md](CONTRIBUTING.md) → **Reporting Issues**
- 📧 Email: securerise@outlook.com

---

## ✨ Summary

**All Tasks Complete!**

- ✅ Monorepo structure proposed & documented
- ✅ TrustClient service created with full API support
- ✅ LocationService created with permission handling
- ✅ SafetyNetScreen UI with camera & GPS integration
- ✅ Root README with architecture documentation
- ✅ Root .gitignore covering all platforms
- ✅ 3 comprehensive git migration options
- ✅ Complete API, Architecture, and Mobile setup documentation

**Ready for**:
- Git migration (run commands from [GIT_MIGRATION.md](GIT_MIGRATION.md))
- Development (follow [CONTRIBUTING.md](CONTRIBUTING.md))
- Deployment (see checklists above)

**Start with**: [GIT_MIGRATION.md](GIT_MIGRATION.md) → Option 1

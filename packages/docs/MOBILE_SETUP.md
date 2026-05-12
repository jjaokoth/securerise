# Mobile Setup Guide

## Flutter Environment Setup

### Prerequisites

Ensure you have Flutter 3.24+ installed:

```bash
flutter --version
# Output: Flutter 3.24.0 • channel stable • ...
```

If not installed, follow [Flutter installation guide](https://flutter.dev/docs/get-started/install).

---

## Project Structure

```
packages/frontend_flutter/
├── lib/
│   ├── main.dart              # App entry point
│   ├── screens/
│   │   └── safety_net_screen.dart  # Field Agent verification UI
│   ├── services/
│   │   ├── trust_client.dart       # Backend API client
│   │   └── location_service.dart   # GPS & permissions
│   ├── widgets/                # Reusable UI components
│   ├── models/                 # Data models
│   └── constants/              # Config constants
├── android/
├── ios/
├── web/
├── pubspec.yaml               # Dependencies
└── analysis_options.yaml       # Linter config
```

---

## Dependencies

Key packages added to `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.6.0                    # HTTP client
  camera: ^0.12.0+1               # Camera access
  geolocator: ^14.0.2             # GPS location
  permission_handler: ^12.0.1     # Permission requests
  pin_code_fields: ^8.0.1         # OTP input widget
  uuid: ^4.0.0                    # Generate UUIDs
  cupertino_icons: ^1.0.8         # iOS-style icons
```

Install dependencies:

```bash
cd packages/frontend_flutter
flutter pub get
```

---

## Configuration

### 1. Backend URL

Edit [lib/services/trust_client.dart](../frontend_flutter/lib/services/trust_client.dart#L13):

```dart
static const String baseUrl = 
  'https://securerise-gen-lang-client-XXXX-uc.a.run.app';
```

Replace `XXXX` with your Cloud Run service name.

### 2. Android Configuration

#### Manifest Permissions

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  
  <!-- Network access -->
  <uses-permission android:name="android.permission.INTERNET" />
  
  <!-- Camera -->
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-feature android:name="android.hardware.camera" android:required="false" />
  
  <!-- Location -->
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  
  <!-- Storage (if saving photos locally) -->
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
  
  <application
    android:label="Securerise"
    android:icon="@mipmap/ic_launcher">
    <!-- ... rest of config ... -->
  </application>
  
</manifest>
```

#### Gradle Build Configuration

Edit `android/app/build.gradle.kts`:

```kotlin
android {
    compileSdk = 34

    defaultConfig {
        targetSdk = 34
        minSdk = 21
        
        // Enable desugaring for Java 8+ features
        multiDexEnabled = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}
```

#### Runtime Permissions Handling

The Flutter app requests permissions at runtime. Users will see permission dialogs:

```dart
// lib/services/location_service.dart
LocationPermission permission = await Geolocator.requestPermission();
```

### 3. iOS Configuration

#### Info.plist Strings

Add to `ios/Runner/Info.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ...>
<plist version="1.0">
<dict>
  
  <!-- Camera usage description -->
  <key>NSCameraUsageDescription</key>
  <string>Camera access is required to capture proof-of-delivery photos for transaction verification.</string>
  
  <!-- Location usage descriptions -->
  <key>NSLocationWhenInUseUsageDescription</key>
  <string>Your location is required for safety net verification. We capture GPS coordinates to bind proof-of-delivery to your transaction.</string>
  
  <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
  <string>Location access required for transaction verification.</string>
  
  <!-- Microphone (not needed for camera, but good to have) -->
  <key>NSMicrophoneUsageDescription</key>
  <string>Microphone access is not required but may improve photo capture quality.</string>
  
  <!-- Photo library (for gallery picker in future) -->
  <key>NSPhotoLibraryUsageDescription</key>
  <string>Photo library access is required if you want to select an existing photo for proof upload.</string>
  
  <!-- ... other config ... -->
  
</dict>
</plist>
```

#### Build Settings

Edit `ios/Podfile` if needed:

```ruby
platform :ios, '14.0'  # Minimum iOS version

target 'Runner' do
  flutter_root = File.expand_path(File.join(packages_path, 'Flutter'))
  load File.join(flutter_root, 'Flutter', 'podhelper.rb')
  
  flutter_ios_podfile_setup
end
```

---

## Running the App

### Android Emulator

```bash
# List available emulators
flutter emulators

# Run on emulator
flutter run -d emulator-5554

# Or with verbose output
flutter run -d emulator-5554 -v
```

### iOS Simulator

```bash
# Run on iOS simulator
flutter run -d sim

# Or specify device
open -a Simulator
flutter run
```

### Physical Device

#### Android
```bash
# Enable USB debugging on device
# Connect device via USB

# Check connection
flutter devices

# Run
flutter run -d <device_id>
```

#### iOS
```bash
# Connect device via USB
# Unlock device and trust computer

flutter run -d <device_id>
```

### Web (For Testing)

```bash
# Run on web (great for quick testing)
flutter run -d web

# Chrome will open automatically
```

---

## Hot Reload & Hot Restart

During development, use hot reload to apply changes without full restart:

```bash
# While app is running, in terminal:
r              # Hot reload (preserves app state)
R              # Hot restart (full app restart)
q              # Quit
```

---

## Debugging

### Enable Debug Mode

```bash
# Build and run with debug symbols
flutter run --debug
```

### View Logs

```bash
# Flutter logs
flutter logs

# Filter by package
flutter logs --grep "trust_client"
```

### DevTools

```bash
# Launch DevTools
dart devtools

# Or use in VS Code:
# - Open Run menu → Open DevTools
```

---

## Building for Release

### Android Release APK

```bash
cd packages/frontend_flutter

# Create release APK
flutter build apk --release

# Output: build/app/outputs/flutter-app.apk

# Or for multiple architectures
flutter build apk --split-per-abi
```

### Android App Bundle (Google Play)

```bash
# Build AAB for Google Play Store
flutter build appbundle --release

# Output: build/app/outputs/bundle/release/app-release.aab
```

### iOS Release Build

```bash
# Build for iOS
flutter build ios --release

# Creates xcodebuild archive for TestFlight/App Store
flutter build ipa --release
```

### Web Build

```bash
# Build for web deployment
flutter build web --release

# Output: build/web/
# Deploy to Firebase Hosting, Netlify, etc.
```

---

## Testing

### Unit Tests

```bash
# Run all unit tests
flutter test

# Run specific test file
flutter test test/services/trust_client_test.dart
```

### Widget Tests

Tests for UI components:

```bash
# Run widget tests
flutter test --tags=widget

# Run integration tests
flutter test integration_test/
```

---

## Environment Variables

For sensitive config (API keys, backend URLs):

### Using .env File (with flutter_dotenv)

```bash
# Add to pubspec.yaml
dependencies:
  flutter_dotenv: ^5.1.0
```

Create `.env` file:

```
BACKEND_URL=https://securerise-gen-lang-client-XXXX-uc.a.run.app
API_TOKEN=your_token_here
```

Load in app:

```dart
import 'package:flutter_dotenv/flutter_dotenv.dart';

void main() async {
  await dotenv.load();
  runApp(const MyApp());
}

// Access:
String backendUrl = dotenv.env['BACKEND_URL'] ?? 'default_url';
```

### Secure Storage (for auth tokens)

```bash
# Add to pubspec.yaml
dependencies:
  flutter_secure_storage: ^9.0.0
```

Usage:

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const storage = FlutterSecureStorage();

// Save token
await storage.write(key: 'auth_token', value: token);

// Read token
String? token = await storage.read(key: 'auth_token');

// Delete token (logout)
await storage.delete(key: 'auth_token');
```

---

## Troubleshooting

### Camera Permission Denied

**Problem**: Camera initialization fails on Android

**Solution**:
```bash
# Clear app data
flutter clean

# Uninstall app from device
adb uninstall com.example.frontend_flutter

# Rebuild and run
flutter run
```

### GPS Not Working

**Problem**: Geolocator returns null

**Solution**:
1. Ensure location services are enabled on device
2. Grant location permission when prompted
3. For Android emulator, set location in emulator settings
4. For iOS simulator, Xcode → Features → Location Simulation

### Build Cache Issues

```bash
# Clean build artifacts
flutter clean

# Get dependencies again
flutter pub get

# Rebuild
flutter run
```

### Gradle Sync Error (Android)

```bash
# Update Gradle
flutter doctor -v

# Force sync
cd android
./gradlew sync

# Or in Android Studio:
# - File → Sync Now
# - File → Invalidate Caches / Restart
```

---

## Performance Tips

1. **Use const constructors** to avoid rebuilds
2. **Lazy load** images: `CachedNetworkImage` instead of `Image.network`
3. **Minimize app size**: Use `flutter build apk --split-per-abi`
4. **Profile performance**: Use DevTools → Performance tab
5. **Reduce build time**: Use `--no-pub` during development

---

## Next Steps

1. Configure backend URL for your Google Cloud Run service
2. Set up Firebase or similar for authentication (tokens)
3. Add error logging service (Sentry, Firebase Crashlytics)
4. Set up CI/CD pipeline (GitHub Actions, Codemagic)
5. Deploy to App Stores (Google Play, Apple App Store)

See [../docs/API_REFERENCE.md](../docs/API_REFERENCE.md) for backend API documentation.

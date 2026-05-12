import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

/// LocationService handles GPS location acquisition with permission management
///
/// Features:
/// - Request and check location permissions
/// - Get current position with timeout
/// - Handle location service availability
/// - Graceful error handling
class LocationService {
  /// Check if location services are enabled on device
  static Future<bool> isLocationServiceEnabled() async {
    return await Geolocator.isLocationServiceEnabled();
  }

  /// Request location permission from user
  ///
  /// Returns:
  /// - LocationPermission.granted: Permission approved
  /// - LocationPermission.denied: Permission denied
  /// - LocationPermission.deniedForever: Permission denied permanently
  static Future<LocationPermission> requestLocationPermission() async {
    final status = await Permission.location.request();

    // Convert PermissionStatus to LocationPermission
    if (status.isDenied) {
      return LocationPermission.denied;
    } else if (status.isPermanentlyDenied) {
      return LocationPermission.deniedForever;
    } else if (status.isGranted) {
      return LocationPermission.whileInUse;
    }
    return LocationPermission.denied;
  }

  /// Check current location permission status
  static Future<LocationPermission> checkLocationPermission() async {
    return await Geolocator.checkPermission();
  }

  /// Get current GPS position with permission handling
  ///
  /// Automatically requests permission if not granted
  ///
  /// Returns:
  /// - Position: Current GPS coordinates and metadata
  /// - null: If permission denied or service unavailable
  ///
  /// Throws: PlatformException on platform-specific errors
  static Future<Position?> getCurrentPosition() async {
    try {
      // Check if location service is enabled
      final serviceEnabled = await isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw LocationServiceDisabledException(
          'Location service is disabled. Please enable it in settings.',
        );
      }

      // Check current permission status
      LocationPermission permission = await checkLocationPermission();

      // Request permission if denied
      if (permission == LocationPermission.denied) {
        permission = await requestLocationPermission();
      }

      // Handle permission denial
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw LocationPermissionException(
          'Location permission denied. Cannot retrieve GPS coordinates.',
        );
      }

      // Get current position with timeout
      final position = await Geolocator.getCurrentPosition(
        timeLimit: const Duration(seconds: 10),
        forceAndroidLocationManager: true,
      );

      return position;
    } catch (e) {
      rethrow;
    }
  }

  /// Get current position with custom accuracy settings
  ///
  /// Parameters:
  /// - desiredAccuracy: GeolocationAccuracy level (default: high)
  /// - timeoutSeconds: Maximum time to wait for position (default: 10s)
  ///
  /// Returns: Position with latitude, longitude, and metadata
  static Future<Position> getCurrentPositionWithSettings({
    LocationAccuracy desiredAccuracy = LocationAccuracy.high,
    int timeoutSeconds = 10,
  }) async {
    try {
      final serviceEnabled = await isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw LocationServiceDisabledException('Location service is disabled.');
      }

      final permission = await checkLocationPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw LocationPermissionException('Location permission not granted.');
      }

      return await Geolocator.getCurrentPosition(
        timeLimit: Duration(seconds: timeoutSeconds),
        forceAndroidLocationManager: true,
      );
    } catch (e) {
      rethrow;
    }
  }

  /// Calculate distance between two coordinates in meters
  static double calculateDistance({
    required double startLatitude,
    required double startLongitude,
    required double endLatitude,
    required double endLongitude,
  }) {
    return Geolocator.distanceBetween(
      startLatitude,
      startLongitude,
      endLatitude,
      endLongitude,
    );
  }

  /// Open device location settings
  static Future<void> openLocationSettings() async {
    await Geolocator.openLocationSettings();
  }

  /// Open device location app settings
  static Future<void> openAppSettingsPage() async {
    await openAppSettings();
  }
}

/// Custom exception for location service being disabled
class LocationServiceDisabledException implements Exception {
  final String message;
  LocationServiceDisabledException(this.message);

  @override
  String toString() => 'LocationServiceDisabledException: $message';
}

/// Custom exception for location permission denial
class LocationPermissionException implements Exception {
  final String message;
  LocationPermissionException(this.message);

  @override
  String toString() => 'LocationPermissionException: $message';
}

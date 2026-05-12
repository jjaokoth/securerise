import 'dart:async';

class EnvConfig {
  static late Map<String, dynamic> _config;
  static bool _initialized = false;

  static Future<void> initialize(Map<String, dynamic> config) async {
    _config = config;
    _initialized = true;
  }

  static bool get isInitialized => _initialized;

  static String? getString(String key) {
    if (!_initialized) throw StateError('EnvConfig not initialized');
    return _config[key] as String?;
  }

  static int? getInt(String key) {
    if (!_initialized) throw StateError('EnvConfig not initialized');
    final value = _config[key];
    if (value is int) return value;
    if (value is String) return int.tryParse(value);
    return null;
  }

  static double? getDouble(String key) {
    if (!_initialized) throw StateError('EnvConfig not initialized');
    final value = _config[key];
    if (value is double) return value;
    if (value is String) return double.tryParse(value);
    return null;
  }

  static bool getBool(String key, {bool defaultValue = false}) {
    if (!_initialized) throw StateError('EnvConfig not initialized');
    final value = _config[key];
    if (value is bool) return value;
    if (value is String) return value.toLowerCase() == 'true';
    return defaultValue;
  }

  static Map<String, dynamic> getAll() {
    if (!_initialized) throw StateError('EnvConfig not initialized');
    return Map.unmodifiable(_config);
  }
}

import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:io';
import 'package:uuid/uuid.dart';

/// TrustClient handles all communication with the Securerise Universal Trust Layer backend.
///
/// This service:
/// - Connects to Google Cloud Run backend
/// - Manages OTP verification
/// - Submits Safety Net proof-of-delivery data
/// - Handles amounts as strings for BigInt compatibility
/// - Includes security headers (Authorization, X-Idempotency-Key)
class TrustClient {
  /// Google Cloud Run backend base URL
  /// Update this to your deployed endpoint
  static const String baseUrl =
      'https://securerise-gen-lang-client-0791519677-uc.a.run.app';

  /// Bearer token for API authentication
  /// In production, retrieve from secure storage (e.g., Flutter Secure Storage)
  String? _authToken;

  /// HTTP client instance
  final http.Client _httpClient = http.Client();

  /// Constructor accepts optional auth token
  TrustClient({String? authToken}) : _authToken = authToken;

  /// Set authentication token
  /// Call this after user login/authentication
  void setAuthToken(String token) {
    _authToken = token;
  }

  /// Generate a unique idempotency key
  /// Prevents duplicate requests in case of network retries
  String _generateIdempotencyKey() {
    return const Uuid().v4();
  }

  /// Build common headers for all API requests
  /// Includes:
  /// - Content-Type: application/json
  /// - Authorization: Bearer token (if available)
  /// - X-Idempotency-Key: UUID for idempotency
  Map<String, String> _buildHeaders({String? customIdempotencyKey}) {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Idempotency-Key': customIdempotencyKey ?? _generateIdempotencyKey(),
    };

    if (_authToken != null && _authToken!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_authToken';
    }

    return headers;
  }

  /// Create a new handshake (locked state)
  ///
  /// Returns: Map with handshakeId, status, and otpExpiry
  /// Throws: HttpException on network/server errors
  Future<Map<String, dynamic>> createHandshake({
    required String tenantId,
    required String amountInCents, // Amount as string for BigInt compatibility
    required String currency,
    required String recipientId,
    String? idempotencyKey,
  }) async {
    try {
      final body = jsonEncode({
        'tenantId': tenantId,
        'amountInCents': amountInCents, // String to preserve precision
        'currency': currency,
        'recipientId': recipientId,
      });

      final response = await _httpClient.post(
        Uri.parse('$baseUrl/api/v1/handshake/create'),
        headers: _buildHeaders(customIdempotencyKey: idempotencyKey),
        body: body,
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw HttpException(
          'Failed to create handshake: ${response.statusCode} ${response.body}',
        );
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Verify OTP and bind Safety Net proof-of-delivery
  ///
  /// Parameters:
  /// - handshakeId: The locked handshake ID
  /// - otp: 6-digit OTP entered by user
  /// - safetyNetImageUrl: URL of uploaded proof photo
  /// - latitude: GPS latitude
  /// - longitude: GPS longitude
  /// - idempotencyKey: Optional custom idempotency key
  ///
  /// Returns: Map with verification status, handshakeId, and releaseTxn
  /// Throws: HttpException on network/server errors
  Future<Map<String, dynamic>> verifyHandshake({
    required String handshakeId,
    required String otp,
    required String safetyNetImageUrl,
    required double latitude,
    required double longitude,
    String? idempotencyKey,
  }) async {
    try {
      final body = jsonEncode({
        'otp': otp,
        'safetyNetImageUrl': safetyNetImageUrl,
        'location': {
          'latitude': latitude,
          'longitude': longitude,
          'timestamp': DateTime.now().toIso8601String(),
        },
      });

      final response = await _httpClient.post(
        Uri.parse('$baseUrl/api/v1/handshake/$handshakeId/verify'),
        headers: _buildHeaders(customIdempotencyKey: idempotencyKey),
        body: body,
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw HttpException(
          'Verification failed: ${response.statusCode} ${response.body}',
        );
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Get current handshake status
  ///
  /// Returns: Map with handshakeId, status, amount, and metadata
  /// Throws: HttpException on network/server errors
  Future<Map<String, dynamic>> getHandshakeStatus(String handshakeId) async {
    try {
      final response = await _httpClient.get(
        Uri.parse('$baseUrl/api/v1/handshake/$handshakeId'),
        headers: _buildHeaders(),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw HttpException(
          'Failed to get handshake: ${response.statusCode} ${response.body}',
        );
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Release payout (idempotent)
  ///
  /// Note: Only callable when handshake is in RELEASED or verified state
  ///
  /// Returns: Map with releaseStatus, txnId, and timestamp
  /// Throws: HttpException on network/server errors
  Future<Map<String, dynamic>> releaseHandshake({
    required String handshakeId,
    String? idempotencyKey,
  }) async {
    try {
      final response = await _httpClient.post(
        Uri.parse('$baseUrl/api/v1/handshake/$handshakeId/release'),
        headers: _buildHeaders(customIdempotencyKey: idempotencyKey),
        body: jsonEncode({}),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw HttpException(
          'Failed to release handshake: ${response.statusCode} ${response.body}',
        );
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Upload proof-of-delivery image to backend
  ///
  /// Returns: Map with imageUrl and uploadId
  /// Throws: HttpException on network/server errors
  Future<Map<String, dynamic>> uploadProofImage({
    required String filePath,
    required String handshakeId,
  }) async {
    try {
      final file = File(filePath);
      final bytes = await file.readAsBytes();
      final fileName = file.path.split('/').last;

      var request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/api/v1/handshake/$handshakeId/upload-proof'),
      );

      request.headers.addAll(_buildHeaders());
      request.files.add(
        http.MultipartFile.fromBytes('file', bytes, filename: fileName),
      );

      final streamedResponse = await _httpClient.send(request);
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw HttpException(
          'Upload failed: ${response.statusCode} ${response.body}',
        );
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Clear authentication token
  void clearAuthToken() {
    _authToken = null;
  }

  /// Dispose HTTP client resources
  void dispose() {
    _httpClient.close();
  }
}

import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

/// TrustClient communicates with the Securerise Universal Trust Layer backend.
///
/// Backend contract used by this client:
/// - POST $baseUrl/api/v1/handshake/create
/// - POST $baseUrl/api/v1/handshake/verify
///
/// This client also provides rail-specific transfer methods (M-Pesa, Airtel,
/// Bank). The rail-specific methods create a handshake with the correct
/// route metadata and return the created handshake.
class TrustClient {
  static const String baseUrl =
      'https://securerise-gen-lang-client-0791519677-uc.a.run.app';

  final http.Client _httpClient;
  final Uuid _uuid;

  String? _authToken;

  TrustClient({String? authToken, http.Client? httpClient})
      : _httpClient = httpClient ?? http.Client(),
        _uuid = const Uuid(),
        _authToken = authToken;

  void setAuthToken(String token) => _authToken = token;

  String _newTransactionId() => _uuid.v4();

  String _newIdempotencyKey() => _uuid.v4();

  Map<String, String> _buildHeaders({String? idempotencyKey}) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Idempotency-Key': idempotencyKey ?? _newIdempotencyKey(),
    };

    if (_authToken != null && _authToken!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_authToken';
    }

    return headers;
  }

  Map<String, dynamic> _decodeJsonResponse(http.Response response) {
    final decoded = jsonDecode(response.body);
    if (decoded is Map<String, dynamic>) return decoded;
    return <String, dynamic>{'data': decoded};
  }

  Future<Map<String, dynamic>> _postJson({
    required String path,
    required Map<String, dynamic> body,
    String? idempotencyKey,
  }) async {
    final response = await _httpClient.post(
      Uri.parse('$baseUrl$path'),
      headers: _buildHeaders(idempotencyKey: idempotencyKey),
      body: jsonEncode(body),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return _decodeJsonResponse(response);
    }

    throw HttpException(
      'Request failed: ${response.statusCode} ${response.body}',
    );
  }

  /// Creates a universal payout handshake.
  ///
  /// Uses the backend expected payload fields:
  /// - tenantId
  /// - amountInCents
  /// - currency
  /// - recipientId
  ///
  /// The caller may optionally pass an idempotencyKey.
  Future<Map<String, dynamic>> createHandshake({
    required String tenantId,
    required String amountInCents,
    required String currency,
    required String recipientId,
    String? idempotencyKey,
  }) {
    return _postJson(
      path: '/api/v1/handshake/create',
      idempotencyKey: idempotencyKey,
      body: {
        'tenantId': tenantId,
        'amountInCents': amountInCents,
        'currency': currency,
        'recipientId': recipientId,
      },
    );
  }

  /// Verifies an existing handshake using OTP + GPS + proof of delivery.
  ///
  /// Provide exactly one of:
  /// - [safetyNetImageUrl]
  /// - [photoBase64]
  Future<Map<String, dynamic>> verifyHandshake({
    required String handshakeId,
    required String otp,
    required double latitude,
    required double longitude,
    String? safetyNetImageUrl,
    String? photoBase64,
    String? idempotencyKey,
  }) async {
    final hasUrl = (safetyNetImageUrl ?? '').trim().isNotEmpty;
    final hasBase64 = (photoBase64 ?? '').trim().isNotEmpty;

    if (!hasUrl && !hasBase64) {
      throw ArgumentError('Provide either safetyNetImageUrl or photoBase64');
    }

    return _postJson(
      path: '/api/v1/handshake/verify',
      idempotencyKey: idempotencyKey,
      body: {
        'handshakeId': handshakeId,
        'otpCode': otp,
        'safetyNetImageUrl': hasUrl ? safetyNetImageUrl : '',
        'photoBase64': hasBase64 ? photoBase64 : '',
        'gpsCoords': {
          'lat': latitude,
          'lng': longitude,
        },
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Rail-specific transfer methods (create handshake + return handshake data)
  // ---------------------------------------------------------------------------

  /// Initiate an M-Pesa transfer (STK/B2C style).
  ///
  /// This method creates a handshake using M-Pesa as the recipient rail.
  Future<Map<String, dynamic>> initiateMpesaTransfer({
    required String tenantId,
    required String amountInCents,
    required String currency,
    required String mpesaPhoneNumber,
    String? idempotencyKey,
  }) async {
    final txId = _newTransactionId();

    return createHandshake(
      tenantId: tenantId,
      amountInCents: amountInCents,
      currency: currency,
      recipientId: mpesaPhoneNumber,
      idempotencyKey: idempotencyKey ?? 'tx:$txId',
    );
  }

  /// Initiate an Airtel transfer.
  ///
  /// Backend currently routes by recipientId in the create handshake payload.
  /// This client still provides a dedicated API for Airtel so you can extend
  /// payloads once backend endpoints are stabilized.
  Future<Map<String, dynamic>> initiateAirtelTransfer({
    required String tenantId,
    required String amountInCents,
    required String currency,
    required String airtelPhoneNumber,
    String? idempotencyKey,
  }) async {
    final txId = _newTransactionId();

    return createHandshake(
      tenantId: tenantId,
      amountInCents: amountInCents,
      currency: currency,
      recipientId: airtelPhoneNumber,
      idempotencyKey: idempotencyKey ?? 'tx:$txId',
    );
  }

  /// Initiate a Bank transfer.
  Future<Map<String, dynamic>> initiateBankTransfer({
    required String tenantId,
    required String amountInCents,
    required String currency,
    required String bankAccountOrRef,
    String? idempotencyKey,
  }) async {
    final txId = _newTransactionId();

    return createHandshake(
      tenantId: tenantId,
      amountInCents: amountInCents,
      currency: currency,
      recipientId: bankAccountOrRef,
      idempotencyKey: idempotencyKey ?? 'tx:$txId',
    );
  }

  void clearAuthToken() => _authToken = null;

  void dispose() => _httpClient.close();
}

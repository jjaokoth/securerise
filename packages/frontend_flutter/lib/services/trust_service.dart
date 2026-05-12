import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_dotenv/flutter_dotenv.dart';

class TrustService {
  final String baseUrl =
      dotenv.env['API_BASE_URL'] ?? 'https://your-cloud-run-url.a.run.app';

  Future<Map<String, dynamic>> createHandshake({
    required String amount, // String to maintain precision
    required String merchantId,
    required String description,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/handshake/create'),
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': dotenv.env['API_KEY'] ?? '',
      },
      body: jsonEncode({
        'amount': amount,
        'merchantId': merchantId,
        'description': description,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to create handshake: ${response.body}');
    }
  }

  Future<Map<String, dynamic>> verifyHandshake({
    required String handshakeId,
    required String otp,
    required String photoBase64,
    required double latitude,
    required double longitude,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/handshake/verify'),
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': dotenv.env['API_KEY'] ?? '',
      },
      body: jsonEncode({
        'handshakeId': handshakeId,
        'otp': otp,
        'photo': photoBase64,
        'latitude': latitude.toString(),
        'longitude': longitude.toString(),
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to verify handshake: ${response.body}');
    }
  }
}

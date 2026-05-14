import 'package:url_launcher/url_launcher.dart';

class UssdService {
  /// Supports offline payments via USSD.
  ///
  /// Examples:
  /// - ussdTemplate: "*334#" (M-Pesa offline pattern; txId appended)
  /// - ussdTemplate: "*{merchant}*{txId}#" (template placeholders)
  ///
  /// `merchantShortcode` and `transactionId` are used to pre-format the
  /// resulting USSD string.
  Future<void> dialUssd({
    required String ussdTemplate,
    required String merchantShortcode,
    required String transactionId,
  }) async {
    final formatted = formatUssd(
      ussdTemplate: ussdTemplate,
      merchantShortcode: merchantShortcode,
      transactionId: transactionId,
    );

    final uri = Uri(scheme: 'tel', path: formatted);
    if (!await canLaunchUrl(uri)) {
      throw Exception('Cannot launch USSD dialer');
    }

    await launchUrl(uri);
  }

  /// Formats a USSD string.
  ///
  /// Strategy:
  /// - If template contains placeholders like `{merchant}`/`{txId}`, it will be replaced.
  /// - Else, if template ends with '#', it appends `*{merchantShortcode}*{transactionId}` before '#'.
  /// - Else, it appends `*{merchantShortcode}*{transactionId}` to the end.
  String formatUssd({
    required String ussdTemplate,
    required String merchantShortcode,
    required String transactionId,
  }) {
    String out = ussdTemplate;

    out = out.replaceAll('{merchant}', merchantShortcode);
    out = out.replaceAll('{shortcode}', merchantShortcode);
    out = out.replaceAll('{txId}', transactionId);
    out = out.replaceAll('{transactionId}', transactionId);

    final hasPlaceholders = ussdTemplate.contains('{merchant}') ||
        ussdTemplate.contains('{shortcode}') ||
        ussdTemplate.contains('{txId}') ||
        ussdTemplate.contains('{transactionId}');

    if (hasPlaceholders) {
      return out;
    }

    final hashIndex = out.indexOf('#');
    if (hashIndex != -1) {
      final prefix = out.substring(0, hashIndex);
      return '$prefix*$merchantShortcode*$transactionId#';
    }

    return '$out*$merchantShortcode*$transactionId';
  }
}

import '../config/env_config.dart';

enum PaymentProviderType {
  mpesa,
  stripe,
  bankTransfer,
}

class PaymentAdapterUI {
  final PaymentProviderType type;
  final String displayName;
  final String? icon;
  final double minAmount;
  final double maxAmount;
  final List<String> supportedCurrencies;
  final bool supportsRecurring;
  final Map<String, dynamic> config;

  PaymentAdapterUI({
    required this.type,
    required this.displayName,
    this.icon,
    required this.minAmount,
    required this.maxAmount,
    required this.supportedCurrencies,
    required this.supportsRecurring,
    required this.config,
  });
}

class AdapterFactory {
  /// Detect region from device locale and return appropriate payment adapter.
  static PaymentAdapterUI getProviderForRegion({required String locale}) {
    // Extract country code from locale (e.g., 'en_KE' -> 'KE')
    final countryCode =
        locale.contains('_') ? locale.split('_').last.toUpperCase() : 'US';

    switch (countryCode) {
      case 'KE':
        return _getMpesaAdapter();
      case 'UG':
        return _getAirtelAdapter();
      case 'TZ':
      case 'ZA':
        return _getStripeAdapter();
      default:
        return _getStripeAdapter();
    }
  }

  /// Get M-Pesa adapter configured for Kenya.
  static PaymentAdapterUI _getMpesaAdapter() {
    return PaymentAdapterUI(
      type: PaymentProviderType.mpesa,
      displayName: 'M-Pesa',
      icon: '📱',
      minAmount: EnvConfig.getDouble('MPESA_MIN_AMOUNT') ?? 1.0,
      maxAmount: EnvConfig.getDouble('MPESA_MAX_AMOUNT') ?? 150000.0,
      supportedCurrencies: ['KES'],
      supportsRecurring: true,
      config: {
        'businessShortCode': EnvConfig.getString('MPESA_SHORTCODE'),
        'callbackUrl': EnvConfig.getString('MPESA_CALLBACK_URL'),
      },
    );
  }

  /// Get Stripe adapter for global payments.
  static PaymentAdapterUI _getStripeAdapter() {
    return PaymentAdapterUI(
      type: PaymentProviderType.stripe,
      displayName: 'Stripe',
      icon: '💳',
      minAmount: EnvConfig.getDouble('STRIPE_MIN_AMOUNT') ?? 0.5,
      maxAmount: EnvConfig.getDouble('STRIPE_MAX_AMOUNT') ?? 999999.0,
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'KES'],
      supportsRecurring: true,
      config: {
        'publishableKey': EnvConfig.getString('STRIPE_PUBLISHABLE_KEY'),
        'supportedCurrencies':
            EnvConfig.getString('STRIPE_CURRENCIES')?.split(',') ?? [],
      },
    );
  }

  /// Get Bank Transfer adapter.
  static PaymentAdapterUI _getBankTransferAdapter() {
    return PaymentAdapterUI(
      type: PaymentProviderType.bankTransfer,
      displayName: 'Bank Transfer',
      icon: '🏦',
      minAmount: EnvConfig.getDouble('BANK_MIN_AMOUNT') ?? 100.0,
      maxAmount: EnvConfig.getDouble('BANK_MAX_AMOUNT') ?? 5000000.0,
      supportedCurrencies: ['KES', 'USD', 'EUR'],
      supportsRecurring: false,
      config: {
        'bankName': EnvConfig.getString('BANK_NAME'),
        'accountName': EnvConfig.getString('BANK_ACCOUNT_NAME'),
        'accountNumber': EnvConfig.getString('BANK_ACCOUNT_NUMBER'),
        'swiftCode': EnvConfig.getString('BANK_SWIFT_CODE'),
      },
    );
  }

  /// Get Airtel adapter (placeholder).
  static PaymentAdapterUI _getAirtelAdapter() {
    return PaymentAdapterUI(
      type: PaymentProviderType.bankTransfer, // Fallback
      displayName: 'Airtel Money',
      icon: '📡',
      minAmount: 1.0,
      maxAmount: 100000.0,
      supportedCurrencies: ['UGX'],
      supportsRecurring: true,
      config: {},
    );
  }

  /// Get all available adapters for a currency.
  static List<PaymentAdapterUI> getAdaptersForCurrency(String currency) {
    final adapters = <PaymentAdapterUI>[];

    if (currency == 'KES') {
      adapters.add(_getMpesaAdapter());
    }

    adapters.add(_getStripeAdapter());
    adapters.add(_getBankTransferAdapter());

    return adapters
        .where((a) => a.supportedCurrencies.contains(currency))
        .toList();
  }

  /// Validate if amount is within provider limits.
  static bool isAmountValid(PaymentAdapterUI adapter, double amount) {
    return amount >= adapter.minAmount && amount <= adapter.maxAmount;
  }

  /// Format amount for display with provider constraints.
  static String formatAmount(PaymentAdapterUI adapter, double amount) {
    final currency = adapter.supportedCurrencies.isNotEmpty
        ? adapter.supportedCurrencies.first
        : 'USD';

    // Format based on currency
    if (currency == 'KES') {
      return 'KES ${amount.toStringAsFixed(2)}';
    } else if (currency == 'USD') {
      return '\$${amount.toStringAsFixed(2)}';
    }

    return '$currency ${amount.toStringAsFixed(2)}';
  }
}

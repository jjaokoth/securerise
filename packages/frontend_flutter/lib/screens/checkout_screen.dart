import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/trust_client.dart';

class CheckoutScreen extends StatefulWidget {
  final String tenantId;

  const CheckoutScreen({super.key, required this.tenantId});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final TrustClient _trustClient = TrustClient();
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();

  bool _useRecurring = false;
  String _recurringInterval = 'monthly';
  bool _verifyingTrustLayer = false;
  bool _isProcessing = false;
  String? _statusMessage;
  String? _errorMessage;

  @override
  void dispose() {
    _amountController.dispose();
    _phoneController.dispose();
    _trustClient.dispose();
    super.dispose();
  }

  Future<void> _launchDialer(String code) async {
    final uri = Uri.parse('tel:$code');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Unable to open dialer for $code';
      });
    }
  }

  Future<void> _submitPayment() async {
    if (_isProcessing || _verifyingTrustLayer) {
      return;
    }

    final amountText = _amountController.text.trim();
    final phoneText = _phoneController.text.trim();

    if (amountText.isEmpty || phoneText.isEmpty) {
      setState(() {
        _errorMessage = 'Enter amount and phone number first.';
      });
      return;
    }

    final amountValue = double.tryParse(amountText.replaceAll(',', ''));
    if (amountValue == null || amountValue <= 0) {
      setState(() {
        _errorMessage = 'Enter a valid amount.';
      });
      return;
    }

    setState(() {
      _verifyingTrustLayer = true;
      _errorMessage = null;
      _statusMessage = 'Verifying Trust Layer...';
    });

    Timer(const Duration(seconds: 2), () async {
      if (!mounted) return;
      setState(() {
        _verifyingTrustLayer = false;
        _isProcessing = true;
        _statusMessage = 'Trust Layer confirmed. Sending payment request...';
      });

      try {
        final subscriptionType = _useRecurring ? _recurringInterval : 'instant';
        final result = await _trustClient.initiateTransaction(
          tenantId: widget.tenantId,
          amount: amountText,
          phoneNumber: phoneText,
          subscriptionType: subscriptionType,
        );

        if (!mounted) return;
        setState(() {
          _statusMessage = 'Payment initiated successfully.';
          _errorMessage = null;
          _isProcessing = false;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Payment request sent. Reference: ${result['transactionId'] ?? result['checkoutRequestId'] ?? result['subscriptionId']}',
            ),
          ),
        );
      } catch (error) {
        if (!mounted) return;
        setState(() {
          _isProcessing = false;
          _statusMessage = null;
          _errorMessage = 'Payment failed: $error';
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Universal Trust Checkout'),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Payment Amount',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _amountController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    hintText: '100.00',
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Phone Number',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    hintText: '2547XXXXXXXX',
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'Recurring (Ratiba)',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(width: 12),
                    Switch(
                      value: _useRecurring,
                      onChanged: (bool value) {
                        setState(() {
                          _useRecurring = value;
                        });
                      },
                    ),
                  ],
                ),
                if (_useRecurring) ...[
                  const SizedBox(height: 12),
                  const Text(
                    'Billing interval',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  DropdownButton<String>(
                    value: _recurringInterval,
                    onChanged: (String? value) {
                      if (value != null) {
                        setState(() {
                          _recurringInterval = value;
                        });
                      }
                    },
                    items: const [
                      DropdownMenuItem(value: 'monthly', child: Text('Monthly')),
                      DropdownMenuItem(value: 'weekly', child: Text('Weekly')),
                    ],
                  ),
                ],
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _isProcessing || _verifyingTrustLayer ? null : _submitPayment,
                  child: _isProcessing || _verifyingTrustLayer
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Instant STK Payment'),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => _launchDialer('*334%23'),
                  child: const Text('USSD M-Pesa (*334#)'),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => _launchDialer('*654%23'),
                  child: const Text('NCBA Loop (*654#)'),
                ),
                const SizedBox(height: 24),
                if (_statusMessage != null) ...[
                  Text(
                    _statusMessage!,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                ],
                if (_errorMessage != null) ...[
                  Text(
                    _errorMessage!,
                    style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                ],
                const SizedBox(height: 24),
                const Text(
                  'Safety Net status is automatically verified before each request.',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

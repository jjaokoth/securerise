// Copyright (c) 2023 jjaokoth. All rights reserved.
// This software is proprietary and confidential. Unauthorized copying, modification, or distribution is strictly prohibited.

import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

import 'config/env_config.dart';
import 'cache/local_transaction_cache.dart';
import 'screens/checkout_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment configuration
  await dotenv.load(fileName: '.env');
  final envMap = dotenv.env;
  await EnvConfig.initialize(envMap);

  // Initialize local transaction cache
  await LocalTransactionCache
      .getPendingTransactions(); // Triggers DB initialization

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Securerise Univer-Escrow',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6D28D9),
          // (Defaults are fine for tests; explicit Color usage avoids shorthand.)
        ),
      ),
      home: const CheckoutScreen(
        tenantId: 'global-trust-tenant',
      ),
    );
  }
}

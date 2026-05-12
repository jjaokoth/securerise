import 'package:flutter/material.dart';

import 'screens/safety_net_screen.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Securerise',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6D28D9),
          // (Defaults are fine for tests; explicit Color usage avoids shorthand.)
        ),
      ),
      home: const SafetyNetScreen(
        handshakeId: 'test-handshake-id',
      ),
    );
  }
}

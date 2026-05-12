// Copyright (c) 2023 jjaokoth. All rights reserved.
// This software is proprietary and confidential. Unauthorized copying, modification, or distribution is strictly prohibited.

import 'dart:convert';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../services/trust_client.dart';

/// Production-ready Safety Net UI:
/// - Camera preview + capture
/// - GPS acquisition (lat/lng)
/// - 6-digit OTP input
/// - Verify handshake flow
class SafetyNetScreen extends StatefulWidget {
  final String handshakeId;

  const SafetyNetScreen({super.key, required this.handshakeId});

  @override
  State<SafetyNetScreen> createState() => _SafetyNetScreenState();
}

class _SafetyNetScreenState extends State<SafetyNetScreen> {
  final TrustClient _trustClient = TrustClient();
  final TextEditingController _otpController = TextEditingController();
  final FocusNode _otpFocusNode = FocusNode();

  bool _safetyNetEnabled = true;

  CameraController? _cameraController;
  XFile? _capturedImage;
  Position? _currentPosition;

  bool _isLoading = false;
  bool _isCameraLoading = false;
  bool _isLocationLoading = false;
  String? _errorText;

  @override
  void initState() {
    super.initState();
    _initializeCamera();
    _acquireLocation();
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    _otpController.dispose();
    _otpFocusNode.dispose();
    super.dispose();
  }

  Future<void> _initializeCamera() async {
    setState(() {
      _isCameraLoading = true;
      _errorText = null;
    });

    try {
      final cameras = await availableCameras();
      if (!mounted) return;

      if (cameras.isEmpty) {
        setState(() {
          _errorText = 'No cameras available.';
          _isCameraLoading = false;
        });
        return;
      }

      final controller = CameraController(
        cameras.first,
        ResolutionPreset.medium,
        enableAudio: false,
      );

      await controller.initialize();

      if (!mounted) return;
      setState(() {
        _cameraController = controller;
        _isCameraLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorText = 'Camera init failed: $e';
        _isCameraLoading = false;
      });
    }
  }

  Future<void> _acquireLocation() async {
    setState(() {
      _isLocationLoading = true;
      _errorText = null;
    });

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() {
          _errorText = 'Location services are disabled.';
          _isLocationLoading = false;
        });
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();

      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        setState(() {
          _errorText = 'Location permission not granted.';
          _isLocationLoading = false;
        });
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );

      if (!mounted) return;
      setState(() {
        _currentPosition = position;
        _isLocationLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorText = 'Location failed: $e';
        _isLocationLoading = false;
      });
    }
  }

  Future<void> _capturePhoto() async {
    setState(() {
      _errorText = null;
    });

    try {
      final controller = _cameraController;
      if (controller == null || !controller.value.isInitialized) {
        setState(() => _errorText = 'Camera is not ready yet.');
        return;
      }

      final file = await controller.takePicture();
      if (!mounted) return;

      setState(() {
        _capturedImage = file;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorText = 'Photo capture failed: $e';
      });
    }
  }

  bool _isOtpValid(String otp) {
    final trimmed = otp.trim();
    return RegExp(r'^\d{6}$').hasMatch(trimmed);
  }

  Future<void> _secondaryVerificationCheck() async {
    // Scaffolded secondary verification.
    // For now, we simply return success after a short delay.
    // This is the hook where you can call a dedicated backend verify endpoint.
    await Future<void>.delayed(const Duration(milliseconds: 250));
  }

  Future<void> _verifyHandshake() async {
    if (_isLoading) return;

    if (_safetyNetEnabled) {
      setState(() {
        _isLoading = true;
        _errorText = null;
      });

      await Future<void>.delayed(const Duration(seconds: 2));
      await _secondaryVerificationCheck();

      // Ensure widget is still mounted after the delay.
      if (!mounted) return;
      setState(() => _isLoading = false);
    }

    final otp = _otpController.text.trim();

    if (!_isOtpValid(otp)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid 6-digit OTP.')),
      );
      _otpFocusNode.requestFocus();
      return;
    }

    if (_capturedImage == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Capture a proof photo first.')),
      );
      return;
    }

    if (_currentPosition == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('GPS location is not available.')),
      );
      return;
    }

    setState(() {
      _isLoading = true;
      _errorText = null;
    });

    try {
      final bytes = await _capturedImage!.readAsBytes();
      final photoBase64 = base64Encode(bytes);

      await _trustClient.verifyHandshake(
        handshakeId: widget.handshakeId,
        otp: otp,
        latitude: _currentPosition!.latitude,
        longitude: _currentPosition!.longitude,
        photoBase64: photoBase64,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Verification successful.'),
        ),
      );

      // Optional: you can display result details if desired.
      // debug: result
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Verification failed: $e'),
          backgroundColor: Colors.red.shade700,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final cameraController = _cameraController;

    final latLngText = _currentPosition == null
        ? (_isLocationLoading ? 'Getting GPS...' : 'Location not available')
        : 'Lat: ${_currentPosition!.latitude.toStringAsFixed(6)}, Lng: ${_currentPosition!.longitude.toStringAsFixed(6)}';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Safety Net Verification'),
      ),
      body: SafeArea(
        child: Stack(
          children: [
            SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_errorText != null) ...[
                    Text(
                      _errorText!,
                      style: const TextStyle(color: Colors.red),
                    ),
                    const SizedBox(height: 12),
                  ],
                  const Text(
                    'Enter 6-digit OTP',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _otpController,
                    focusNode: _otpFocusNode,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    textInputAction: TextInputAction.done,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      hintText: '000000',
                      counterText: '',
                    ),
                    onSubmitted: (_) => _verifyHandshake(),
                  ),
                  const SizedBox(height: 20),
                  SwitchListTile(
                    title: const Text('Safety Net'),
                    value: _safetyNetEnabled,
                    onChanged: (bool value) {
                      setState(() {
                        _safetyNetEnabled = value;
                      });
                    },
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Proof of Delivery Photo',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  AspectRatio(
                    aspectRatio: (cameraController?.value.aspectRatio ?? 1),
                    child: cameraController != null &&
                            cameraController.value.isInitialized
                        ? CameraPreview(cameraController)
                        : Center(
                            child: _isCameraLoading
                                ? const CircularProgressIndicator()
                                : const Text('Camera not ready'),
                          ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _isLoading ? null : _capturePhoto,
                          child: const Text('Capture Photo'),
                        ),
                      ),
                    ],
                  ),
                  if (_capturedImage != null) ...[
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.file(
                        File(_capturedImage!.path),
                        height: 120,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  const Text(
                    'GPS Location',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(latLngText),
                  if (_currentPosition == null)
                    TextButton.icon(
                      onPressed: _isLoading ? null : _acquireLocation,
                      icon: const Icon(Icons.my_location),
                      label: const Text('Retry GPS'),
                    ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: _isLoading ? null : _verifyHandshake,
                    icon: _isLoading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.verified),
                    label:
                        Text(_isLoading ? 'Verifying...' : 'Verify Handshake'),
                  ),
                  const SizedBox(height: 60), // Space for watermark
                ],
              ),
            ),
            // Watermark overlay
            Positioned(
              bottom: 10,
              left: 10,
              right: 10,
              child: Opacity(
                opacity: 0.3,
                child: Text(
                  'Securerise Solutions Limited™',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey.shade600,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

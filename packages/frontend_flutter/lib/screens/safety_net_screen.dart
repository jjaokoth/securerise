import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
import '../services/trust_service.dart';

class SafetyNetScreen extends StatefulWidget {
  final String handshakeId;

  const SafetyNetScreen({super.key, required this.handshakeId});

  @override
  _SafetyNetScreenState createState() => _SafetyNetScreenState();
}

class _SafetyNetScreenState extends State<SafetyNetScreen> {
  final TrustService _trustService = TrustService();
  final TextEditingController _otpController = TextEditingController();
  CameraController? _cameraController;
  XFile? _imageFile;
  Position? _currentPosition;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _initializeCamera();
    _getCurrentLocation();
  }

  Future<void> _initializeCamera() async {
    final cameras = await availableCameras();
    if (cameras.isNotEmpty) {
      _cameraController =
          CameraController(cameras.first, ResolutionPreset.medium);
      await _cameraController!.initialize();
      setState(() {});
    }
  }

  Future<void> _getCurrentLocation() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      // Handle location services disabled
      return;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        // Handle permission denied
        return;
      }
    }

    _currentPosition = await Geolocator.getCurrentPosition();
    setState(() {});
  }

  Future<void> _takePicture() async {
    if (_cameraController != null && _cameraController!.value.isInitialized) {
      _imageFile = await _cameraController!.takePicture();
      setState(() {});
    }
  }

  Future<void> _verifyHandshake() async {
    if (_otpController.text.length != 6 ||
        _imageFile == null ||
        _currentPosition == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please complete all fields')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final bytes = await _imageFile!.readAsBytes();
      final base64Image = base64Encode(bytes);

      final result = await _trustService.verifyHandshake(
        handshakeId: widget.handshakeId,
        otp: _otpController.text,
        photoBase64: base64Image,
        latitude: _currentPosition!.latitude,
        longitude: _currentPosition!.longitude,
      );

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Verification successful: ${result['status']}')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Verification failed: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    _otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Safety Net Verification'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Enter 6-digit OTP',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _otpController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: '000000',
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Proof of Delivery Photo',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            if (_cameraController != null &&
                _cameraController!.value.isInitialized)
              AspectRatio(
                aspectRatio: _cameraController!.value.aspectRatio,
                child: CameraPreview(_cameraController!),
              )
            else
              const CircularProgressIndicator(),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: _takePicture,
              child: const Text('Take Photo'),
            ),
            if (_imageFile != null)
              Padding(
                padding: const EdgeInsets.only(top: 8.0),
                child: Image.file(File(_imageFile!.path), height: 100),
              ),
            const SizedBox(height: 20),
            const Text(
              'GPS Location',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              _currentPosition != null
                  ? 'Lat: ${_currentPosition!.latitude}, Lng: ${_currentPosition!.longitude}'
                  : 'Location not available',
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _isLoading ? null : _verifyHandshake,
              child: _isLoading
                  ? const CircularProgressIndicator()
                  : const Text('Verify Handshake'),
            ),
          ],
        ),
      ),
    );
  }
}

import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
import '../services/trust_client.dart';
import '../services/location_service.dart';

/// SafetyNetScreen provides the Field Agent verification UI
///
/// Features:
/// - 6-digit OTP input
/// - Camera preview with photo capture
/// - GPS coordinate acquisition
/// - Real-time loading state
/// - Error handling and retry logic
class SafetyNetScreen extends StatefulWidget {
  final String handshakeId;
  final String merchantId;

  const SafetyNetScreen({
    super.key,
    required this.handshakeId,
    required this.merchantId,
  });

  @override
  State<SafetyNetScreen> createState() => _SafetyNetScreenState();
}

class _SafetyNetScreenState extends State<SafetyNetScreen> {
  final TrustClient _trustClient = TrustClient();
  final TextEditingController _otpController = TextEditingController();

  CameraController? _cameraController;
  XFile? _capturedImage;
  Position? _currentPosition;
  bool _isLoading = false;
  bool _isCameraInitialized = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _initializeCamera();
    _getLocation();
  }

  /// Initialize camera with first available device
  Future<void> _initializeCamera() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        setState(() => _errorMessage = 'No camera available on this device');
        return;
      }

      _cameraController = CameraController(
        cameras.first,
        ResolutionPreset.high,
        enableAudio: false,
      );

      await _cameraController!.initialize();

      if (mounted) {
        setState(() => _isCameraInitialized = true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _errorMessage = 'Camera initialization failed: $e');
      }
    }
  }

  /// Request permissions and get current GPS location
  Future<void> _getLocation() async {
    try {
      final position = await LocationService.getCurrentPosition();
      if (mounted) {
        setState(() => _currentPosition = position);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _errorMessage = 'Location error: $e');
      }
    }
  }

  /// Capture photo from camera
  Future<void> _takePicture() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      return;
    }

    try {
      setState(() => _isLoading = true);

      final image = await _cameraController!.takePicture();

      if (mounted) {
        setState(() {
          _capturedImage = image;
          _isLoading = false;
        });
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Photo captured successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to capture photo: $e')));
      }
    }
  }

  /// Retake photo - clear the captured image
  void _retakePicture() {
    setState(() => _capturedImage = null);
  }

  /// Validate all inputs before submission
  bool _validateInputs() {
    if (_otpController.text.length != 6) {
      _showError('Please enter a valid 6-digit OTP');
      return false;
    }

    if (_capturedImage == null) {
      _showError('Please capture a proof photo');
      return false;
    }

    if (_currentPosition == null) {
      _showError('Unable to get your location. Please try again.');
      return false;
    }

    return true;
  }

  /// Display error message in SnackBar
  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  /// Main verification flow
  Future<void> _verifyHandshake() async {
    if (!_validateInputs()) return;

    setState(() => _isLoading = true);

    try {
      // Show loading state
      if (mounted) {
        _showLoadingDialog('Securing Transaction...');
      }

      // Read image as base64
      final imageBytes = await _capturedImage!.readAsBytes();
      final base64Image = base64Encode(imageBytes);

      // Call backend verification endpoint
      final result = await _trustClient.verifyHandshake(
        handshakeId: widget.handshakeId,
        otp: _otpController.text,
        safetyNetImageUrl: base64Image,
        latitude: _currentPosition!.latitude,
        longitude: _currentPosition!.longitude,
        idempotencyKey: DateTime.now().microsecondsSinceEpoch.toString(),
      );

      if (mounted) {
        Navigator.of(context).pop(); // Close loading dialog

        // Show success
        _showSuccessDialog(result);
      }
    } catch (e) {
      if (mounted) {
        Navigator.of(context).pop(); // Close loading dialog

        setState(() => _isLoading = false);
        _showError('Verification failed: ${e.toString()}');
      }
    }
  }

  /// Show loading dialog with "Securing Transaction..." message
  void _showLoadingDialog(String message) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return Dialog(
          backgroundColor: Colors.transparent,
          elevation: 0,
          child: Center(
            child: Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.blue),
                    strokeWidth: 3,
                  ),
                  const SizedBox(height: 20),
                  Text(
                    message,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  /// Show success dialog with verification result
  void _showSuccessDialog(Map<String, dynamic> result) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Verification Successful'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Status: ${result['status'] ?? 'Success'}'),
              if (result['releaseTxn'] != null)
                Text('Transaction ID: ${result['releaseTxn']}'),
              const SizedBox(height: 12),
              const Text(
                'The handshake has been verified and secured.',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop(); // Close dialog
                Navigator.of(context).pop(); // Go back to previous screen
              },
              child: const Text('Done'),
            ),
          ],
        );
      },
    );
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    _otpController.dispose();
    _trustClient.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Safety Net Verification'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Error message display
              if (_errorMessage != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _errorMessage!,
                    style: TextStyle(color: Colors.red.shade900),
                  ),
                ),
              if (_errorMessage != null) const SizedBox(height: 16),

              // Step 1: OTP Input
              const Text(
                'Step 1: Enter 6-Digit OTP',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _otpController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(6),
                ],
                decoration: InputDecoration(
                  counterText: '',
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 18,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: Colors.grey.shade400),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: Colors.blue.shade600),
                  ),
                  filled: true,
                  fillColor: Colors.grey.shade100,
                  hintText: 'Enter OTP',
                ),
                style: const TextStyle(
                  fontSize: 20,
                  letterSpacing: 16,
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
                onChanged: (String value) {
                  setState(() {});
                },
              ),
              const SizedBox(height: 28),

              // Step 2: Camera Capture
              const Text(
                'Step 2: Capture Proof Photo',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              if (_isCameraInitialized && _cameraController != null)
                Column(
                  children: [
                    if (_capturedImage == null)
                      Container(
                        height: 300,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade300),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: CameraPreview(_cameraController!),
                        ),
                      )
                    else
                      Container(
                        height: 300,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade300),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.file(
                            File(_capturedImage!.path),
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    const SizedBox(height: 12),
                    if (_capturedImage == null)
                      ElevatedButton.icon(
                        onPressed: _isLoading ? null : _takePicture,
                        icon: const Icon(Icons.camera_alt),
                        label: const Text('Capture Photo'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 28,
                            vertical: 12,
                          ),
                        ),
                      )
                    else
                      ElevatedButton.icon(
                        onPressed: _isLoading ? null : _retakePicture,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Retake Photo'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.orange,
                          foregroundColor: Colors.white,
                        ),
                      ),
                  ],
                )
              else
                Container(
                  height: 300,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    color: Colors.grey.shade200,
                  ),
                  child: const Center(child: CircularProgressIndicator()),
                ),
              const SizedBox(height: 28),

              // Step 3: Location Status
              const Text(
                'Step 3: Location Verification',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _currentPosition != null
                      ? Colors.green.shade50
                      : Colors.yellow.shade50,
                  border: Border.all(
                    color: _currentPosition != null
                        ? Colors.green.shade300
                        : Colors.yellow.shade300,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      _currentPosition != null
                          ? Icons.check_circle
                          : Icons.info,
                      color: _currentPosition != null
                          ? Colors.green
                          : Colors.orange,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _currentPosition != null
                                ? 'Location Acquired'
                                : 'Acquiring Location...',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          if (_currentPosition != null)
                            Text(
                              'Lat: ${_currentPosition!.latitude.toStringAsFixed(4)}, Lon: ${_currentPosition!.longitude.toStringAsFixed(4)}',
                              style: const TextStyle(fontSize: 12),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              // Verify Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed:
                      _isLoading ||
                          _otpController.text.length != 6 ||
                          _capturedImage == null ||
                          _currentPosition == null
                      ? null
                      : _verifyHandshake,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    disabledBackgroundColor: Colors.grey.shade300,
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Colors.white,
                            ),
                          ),
                        )
                      : const Text(
                          'Verify & Secure Transaction',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 16),

              // Help text
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'This verification binds your location and photo proof to secure the transaction. Both the OTP and Safety Net proof are required for release.',
                  style: TextStyle(fontSize: 12, color: Colors.blue),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

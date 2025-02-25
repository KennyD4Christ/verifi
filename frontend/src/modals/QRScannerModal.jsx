import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Modal, message, Spin, Button } from 'antd';

const QRScannerModal = ({ open, onClose, onScan, products, isLoading }) => {
  const scannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);

  const getCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Camera permission error:', error);
      return false;
    }
  };

  const initializeScanner = async () => {
    try {
      // Check camera permission first
      const hasPermission = await getCameraPermission();
      if (!hasPermission) {
        throw new Error('NotAllowedError');
      }

      // Get available cameras
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        throw new Error('NoCameraError');
      }
      setCameras(devices);

      // Use the first available camera by default
      const defaultCamera = devices[0];
      setSelectedCamera(defaultCamera.id);

      // Initialize scanner
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader', {
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        });
      }

      await startScanning(defaultCamera.id);
    } catch (error) {
      handleInitializationError(error);
    }
  };

  const startScanning = async (cameraId) => {
    if (!scannerRef.current) return;

    try {
      await scannerRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          videoConstraints: {
            facingMode: "environment",
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 }
          }
        },
        handleScanSuccess,
        handleScanError
      );
      setIsScanning(true);
      setCameraError(false);
      setErrorMessage('');
    } catch (error) {
      console.error('Error starting camera:', error);
      handleInitializationError(error);
    }
  };

  const handleInitializationError = (error) => {
    let userMessage = 'Camera access error. ';
    
    if (error.message.includes('NotAllowedError') || error.name === 'NotAllowedError') {
      userMessage += 'Please grant camera permissions in your browser settings and try again.';
    } else if (error.message === 'NoCameraError') {
      userMessage += 'No cameras detected on your device.';
    } else if (error.message.includes('NotReadableError')) {
      userMessage += 'Your camera may be in use by another application.';
    } else if (error.message.includes('NotFoundError')) {
      userMessage += 'No compatible camera found.';
    } else {
      userMessage += 'Please check your camera connection and refresh the page.';
    }

    setErrorMessage(userMessage);
    setCameraError(true);
    message.error(userMessage);
  };

  const handleScanSuccess = (decodedText) => {
    try {
      let productId;
      let quantity = 1;

      try {
        const scannedData = JSON.parse(decodedText);
        productId = scannedData.productId;
        quantity = scannedData.quantity || 1;
      } catch {
        productId = decodedText;
      }

      const product = products.find(p => p.id === productId);
      if (!product) {
        throw new Error('Product not found in the system');
      }

      onScan({
        product_id: productId,
        quantity: quantity,
        unit_price: product.price,
        status: 'pending'
      });

      handleClose();
    } catch (error) {
      console.error('QR code processing error:', error);
      message.error(error.message || 'Failed to process QR code');
    }
  };

  const handleScanError = (errorMessage) => {
    // Ignore NotFoundException as it's expected during scanning
    if (!errorMessage?.includes('NotFoundException')) {
      console.error('Scan error:', errorMessage);
    }
  };

  const handleCameraSwitch = async (cameraId) => {
    if (!scannerRef.current || !isScanning) return;

    try {
      await scannerRef.current.stop();
      await startScanning(cameraId);
      setSelectedCamera(cameraId);
    } catch (error) {
      console.error('Error switching camera:', error);
      message.error('Failed to switch camera');
    }
  };

  const cleanupScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
        scannerRef.current = null;
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    }
    setIsScanning(false);
    setCameraError(false);
    setErrorMessage('');
  };

  const handleClose = async () => {
    await cleanupScanner();
    onClose();
  };

  const handleRetry = async () => {
    await cleanupScanner();
    await initializeScanner();
  };

  useEffect(() => {
    if (open && !isScanning && !isLoading && products.length > 0) {
      initializeScanner();
    }
    return () => {
      cleanupScanner();
    };
  }, [open, products, isLoading]);

  return (
    <Modal
      title="Scan Product QR Code"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={400}
      destroyOnClose={true}
    >
      <div className="flex flex-col items-center">
        {isLoading ? (
          <div className="py-8 text-center">
            <Spin />
            <p className="mt-4 text-gray-600">Loading products...</p>
          </div>
        ) : cameraError ? (
          <div className="py-8 text-center">
            <p className="text-red-600 mb-4">{errorMessage}</p>
            <Button 
              type="primary"
              onClick={handleRetry}
              className="w-full max-w-xs"
            >
              Retry Camera Access
            </Button>
          </div>
        ) : (
          <div className="w-full">
            <div
              id="qr-reader"
              className="w-full max-w-md mx-auto"
              style={{ minHeight: '300px' }}
            />
            {cameras.length > 1 && (
              <div className="mt-4">
                <select
                  className="w-full p-2 border rounded"
                  value={selectedCamera}
                  onChange={(e) => handleCameraSwitch(e.target.value)}
                >
                  {cameras.map((camera) => (
                    <option key={camera.id} value={camera.id}>
                      {camera.label || `Camera ${camera.id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!isScanning && !cameraError && (
              <p className="text-gray-600 mt-4 text-center">
                Initializing camera... Please wait.
              </p>
            )}
            {isScanning && (
              <p className="text-gray-600 mt-4 text-center">
                Position the QR code within the frame
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default QRScannerModal;

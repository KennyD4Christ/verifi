import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import styled from 'styled-components';
import { Modal, Button, Alert, Spinner } from 'react-bootstrap';

const QRContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
`;

const ScannerContainer = styled.div`
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
`;

const QRDisplay = ({ transactionData }) => {
  const qrData = JSON.stringify({
    transactionId: transactionData.id,
    amount: transactionData.amount,
    date: transactionData.date,
    type: transactionData.transaction_type
  });

  return (
    <QRContainer>
      <QRCodeSVG value={qrData} size={128} level="H" />
    </QRContainer>
  );
};

const QRScanner = ({ onScanSuccess, onScanError }) => {
  const [html5QrCode, setHtml5QrCode] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const qrCodeId = 'qr-reader';
    
    // Only initialize if not already initialized
    if (!isInitialized) {
      const html5QrCode = new Html5Qrcode(qrCodeId);
      setHtml5QrCode(html5QrCode);
      setIsInitialized(true);

      const config = {
        fps: 10,
        qrbox: {
          width: 250,
          height: 250
        },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: true
      };

      html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          // Successful scan
          html5QrCode.stop().then(() => {
            onScanSuccess(decodedText);
          }).catch(error => {
            console.error("Failed to stop scanner after successful scan:", error);
          });
        },
        (errorMessage) => {
          // Only trigger error for actual scanning issues
          if (!errorMessage.includes('QR code parse error')) {
            onScanError(errorMessage);
          }
        }
      ).catch((err) => {
        // Handle camera initialization errors
        if (err.includes('NotFoundError')) {
          onScanError('Camera not found. Please ensure camera permissions are granted.');
        } else if (err.includes('NotAllowedError')) {
          onScanError('Camera access denied. Please grant camera permissions.');
        } else {
          onScanError(`Camera initialization failed: ${err}`);
        }
      });
    }

    // Cleanup function
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          html5QrCode.clear();
          setIsInitialized(false);
        }).catch((err) => {
          console.error("Failed to clean up scanner:", err);
          setIsInitialized(false);
        });
      }
    };
  }, [isInitialized, onScanSuccess, onScanError]);

  return <ScannerContainer id="qr-reader" />;
};

const QRScannerModal = ({ show, handleClose, onScanComplete }) => {
  const [scanError, setScanError] = useState(null);
  const [scanning, setScanning] = useState(false);

  const handleModalClose = useCallback(() => {
    setScanError(null);
    setScanning(false);
    handleClose();
  }, [handleClose]);

  const handleScanSuccess = useCallback(async (result) => {
    try {
      setScanning(true);
      const scannedData = JSON.parse(result);

      const response = await fetch(`/api/transactions/verify/${scannedData.transactionId}`);
      
      if (!response.ok) {
        throw new Error('Invalid QR code');
      }

      const verifiedData = await response.json();
      onScanComplete(verifiedData);
      handleModalClose();
    } catch (error) {
      setScanError('Invalid or expired QR code. Please try again.');
    } finally {
      setScanning(false);
    }
  }, [onScanComplete, handleModalClose]);

  const handleScanError = useCallback((error) => {
    // Only set error state for actual errors, not normal scanning operations
    if (typeof error === 'string' && !error.includes('QR code parse error')) {
      setScanError(error);
      setScanning(false);
    }
  }, []);

  // Reset error state when modal is opened
  useEffect(() => {
    if (show) {
      setScanError(null);
      setScanning(false);
    }
  }, [show]);

  return (
    <Modal show={show} onHide={handleModalClose}>
      <Modal.Header closeButton>
        <Modal.Title>Scan QR Code</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {scanError && (
          <Alert variant="danger" className="mb-3">
            {scanError}
          </Alert>
        )}
        {scanning ? (
          <div className="text-center">
            <Spinner animation="border" role="status" />
            <p>Verifying QR Code...</p>
          </div>
        ) : (
          show && <QRScanner
            onScanSuccess={handleScanSuccess}
            onScanError={handleScanError}
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleModalClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export { QRDisplay, QRScanner, QRScannerModal };

import React from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import styled from 'styled-components';
import { Download } from 'lucide-react';

const QRCodeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
`;

const QRCodeWrapper = styled.div`
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const DownloadButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #4a6cf7;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #3a5ce4;
  }
`;

/**
 * Renders a QR code for receipt data
 * @param {Object} receipt - The receipt object to encode in the QR code
 * @param {string} size - The size of the QR code (default: "128px")
 * @param {boolean} showDownload - Whether to show the download button (default: true)
 * @param {function} onDownload - Optional callback for download button click
 */
export const ReceiptQRCode = ({ receipt, size = "128px", showDownload = true, onDownload }) => {
  if (!receipt) return null;
  
  // Create a simplified version of the receipt data for the QR code
  const qrData = {
    id: receipt.id,
    number: receipt.receipt_number,
    date: receipt.payment_date,
    amount: receipt.amount,
    currency: receipt.currency,
    payer: receipt.payer_name,
    payee: receipt.payee_name,
    description: receipt.description,
    payment_method: receipt.payment_method
  };
  
  const qrString = JSON.stringify(qrData);
  
  const handleDownload = () => {
    const canvas = document.getElementById(`receipt-qr-${receipt.id}`);
    if (canvas) {
      const pngUrl = canvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream");
      
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `receipt-${receipt.receipt_number || receipt.id}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      if (onDownload) onDownload();
    }
  };
  
  return (
    <QRCodeContainer>
      <QRCodeWrapper>
        <QRCode 
          id={`receipt-qr-${receipt.id}`}
          value={qrString}
          size={parseInt(size) || 128}
          level="H"
          includeMargin={true}
          renderAs="canvas"
        />
      </QRCodeWrapper>
      
      {showDownload && (
        <DownloadButton onClick={handleDownload}>
          <Download size={16} />
          Download QR Code
        </DownloadButton>
      )}
    </QRCodeContainer>
  );
};

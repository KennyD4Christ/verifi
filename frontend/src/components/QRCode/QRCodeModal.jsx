import React, { useState } from 'react';
import styled from 'styled-components';
import { QrCode, Scan } from 'lucide-react';

const QRCodeModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const QRCodeModalContent = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 90%;
  width: 400px;
`;

const QRCodeModal = ({ isOpen, onClose, invoiceData }) => {
  if (!isOpen) return null;

  return (
    <QRCodeModalOverlay onClick={onClose}>
      <QRCodeModalContent onClick={e => e.stopPropagation()}>
        <h3>Invoice QR Code</h3>
        <InvoiceQRCode invoice={invoiceData} size="200px" />
      </QRCodeModalContent>
    </QRCodeModalOverlay>
  );
};

export default QRCodeModal;

import React from 'react';
import styled from 'styled-components';
import { QrCode, X } from 'lucide-react';
import { ReceiptQRCode } from './ReceiptQRCode';

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
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
`;

const QRCodeHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const QRCodeTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  
  &:hover {
    background: #f5f5f5;
    color: #333;
  }
`;

const QRCodeWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const ReceiptInfo = styled.div`
  margin-top: 1.5rem;
  text-align: center;
`;

const ReceiptNumber = styled.p`
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

const ReceiptAmount = styled.p`
  font-size: 1.25rem;
  font-weight: 700;
  color: #3b82f6;
`;

/**
 * Modal component for displaying QR codes for receipts
 * @param {boolean} isOpen - Whether the modal is currently open
 * @param {function} onClose - Function to call when closing the modal
 * @param {object} receiptData - Receipt data to display
 */
const ReceiptQRCodeModal = ({ isOpen, onClose, receiptData }) => {
  if (!isOpen) return null;

  return (
    <QRCodeModalOverlay onClick={onClose}>
      <QRCodeModalContent onClick={e => e.stopPropagation()}>
        <QRCodeHeader>
          <QRCodeTitle>Receipt QR Code</QRCodeTitle>
          <CloseButton onClick={onClose}>
            <X size={18} />
          </CloseButton>
        </QRCodeHeader>
        
        <QRCodeWrapper>
          <ReceiptQRCode receipt={receiptData} size="200px" />
          
          {receiptData && (
            <ReceiptInfo>
              <ReceiptNumber>
                Receipt #{receiptData.receipt_number || receiptData.id}
              </ReceiptNumber>
              <ReceiptAmount>
                {(receiptData.currency || '$')}{parseFloat(receiptData.amount).toFixed(2)}
              </ReceiptAmount>
            </ReceiptInfo>
          )}
        </QRCodeWrapper>
      </QRCodeModalContent>
    </QRCodeModalOverlay>
  );
};

export default ReceiptQRCodeModal;

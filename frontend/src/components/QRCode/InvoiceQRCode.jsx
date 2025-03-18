import React, { useState } from 'react';
import styled from 'styled-components';
import { QrCode, Scan } from 'lucide-react';

const QRCodeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  transition: all 0.2s ease-in-out;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const QRCodeSVG = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${props => props.size || '100px'};
  height: ${props => props.size || '100px'};
  border: 1px dashed #e0e0e0;
  border-radius: 4px;
  padding: 0.5rem;
`;

const QRCodeLabel = styled.span`
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #666666;
  text-align: center;
`;

const AnimatedIcon = styled.div`
  transition: transform 0.3s ease;
  &:hover {
    transform: scale(1.1);
  }
`;

const InvoiceQRCode = ({ invoice, size, onScan }) => {
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = () => {
    setIsScanning(true);
    const qrData = JSON.stringify({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      total_amount: invoice.total_amount,
      customer_id: invoice.customer?.id,
      status: invoice.status,
      issue_date: invoice.issue_date
    });

    onScan(qrData);
    setTimeout(() => setIsScanning(false), 1000);
  };

  return (
    <QRCodeContainer>
      <QRCodeSVG size={size} onClick={handleScan}>
        <AnimatedIcon>
          {isScanning ? (
            <Scan size={24} color="#2196f3" className="animate-pulse" />
          ) : (
            <QrCode size={24} color="#666666" />
          )}
        </AnimatedIcon>
      </QRCodeSVG>
      <QRCodeLabel>
        Invoice #{invoice.invoice_number}
      </QRCodeLabel>
    </QRCodeContainer>
  );
};

export default InvoiceQRCode;

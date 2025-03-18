import React from 'react';
import Modal from 'react-modal';
import styled from 'styled-components';

const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    maxWidth: '600px',
    width: '100%',
  },
};

const ModalContent = styled.div`
  padding: 20px;
`;

const Title = styled.h2`
  margin-bottom: 20px;
`;

const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
`;

const DetailLabel = styled.span`
  font-weight: bold;
`;

const DetailValue = styled.span``;

const ActionButton = styled.button`
  padding: 10px 20px;
  margin: 10px 10px 0 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  ${({ primary }) => primary ? 'background-color: #007bff; color: white;' : 'background-color: #6c757d; color: white;'}
  &:hover {
    opacity: 0.8;
  }
`;

const InvoiceDetailsModal = ({ isOpen, onClose, invoice, onGeneratePDF, onMarkAsPaid }) => {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      style={customStyles}
      contentLabel="Invoice Details"
    >
      <ModalContent>
        <Title>Invoice Details</Title>
        <DetailRow>
          <DetailLabel>Invoice ID:</DetailLabel>
          <DetailValue>{invoice.id}</DetailValue>
        </DetailRow>
        <DetailRow>
          <DetailLabel>Customer ID:</DetailLabel>
          <DetailValue>{invoice.customer_Id}</DetailValue>
        </DetailRow>
        <DetailRow>
          <DetailLabel>Date:</DetailLabel>
          <DetailValue>{invoice.date}</DetailValue>
        </DetailRow>
        <DetailRow>
          <DetailLabel>Description:</DetailLabel>
          <DetailValue>{invoice.description}</DetailValue>
        </DetailRow>
        <DetailRow>
          <DetailLabel>Amount:</DetailLabel>
          <DetailValue>{invoice.amount}</DetailValue>
        </DetailRow>
        <DetailRow>
          <DetailLabel>Status:</DetailLabel>
          <DetailValue>{invoice.status}</DetailValue>
        </DetailRow>
        <ActionButton primary onClick={() => onGeneratePDF(invoice.id)}>
          Generate PDF
        </ActionButton>
        {invoice.status !== 'PAID' && (
          <ActionButton onClick={() => onMarkAsPaid(invoice.id)}>
            Mark as Paid
          </ActionButton>
        )}
        <ActionButton onClick={onClose}>Close</ActionButton>
      </ModalContent>
    </Modal>
  );
};

export default InvoiceDetailsModal;

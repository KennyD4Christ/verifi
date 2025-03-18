import React from 'react';
import styled from 'styled-components';
import AddProductModal from '../modals/AddProductModal';

const PageWrapper = styled.div`
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const CloseButton = styled.button`
  align-self: flex-end;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
`;

const AddProductPage = ({ handleClose, refreshProducts }) => {
  return (
    <PageWrapper>
      <CloseButton onClick={handleClose}>&times;</CloseButton>
      <AddProductModal
        show={true}
        handleClose={handleClose}
        refreshProducts={refreshProducts}
      />
    </PageWrapper>
  );
};

export default AddProductPage;

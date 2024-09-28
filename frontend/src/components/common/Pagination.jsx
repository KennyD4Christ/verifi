import React from 'react';
import styled from 'styled-components';
import PropTypes from 'prop-types';

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 20px;
`;

const PaginationButton = styled.button`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin: 0 5px;
  cursor: pointer;
  background-color: #f8f9fa;

  &:hover {
    background-color: #e2e6ea;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const handleFirstPage = () => {
    onPageChange(1);
  };

  const handlePreviousPage = () => {
    onPageChange(currentPage - 1);
  };

  const handleNextPage = () => {
    onPageChange(currentPage + 1);
  };

  const handleLastPage = () => {
    onPageChange(totalPages);
  };

  return (
    <PaginationContainer>
      <PaginationButton
	onClick={handleFirstPage}
	disabled={currentPage === 1}
      >
	First
      </PaginationButton>
      <PaginationButton
	onClick={handlePreviousPage}
	disabled={currentPage === 1}
      >
	Previous
      </PaginationButton>
      {Array.from({ length: totalPages }, (_, index) => (
	<PaginationButton
	  key={index + 1}
	  onClick={() => onPageChange(index + 1)}
	  disabled={currentPage === index + 1}
	>
	  {index + 1}
	</PaginationButton>
      ))}
      <PaginationButton
	onClick={handleNextPage}
	disabled={currentPage === totalPages}
      >
	Next
      </PaginationButton>
      <PaginationButton
        onClick={handleLastPage}
	disabled={currentPage === totalPages}
      >
	Last
      </PaginationButton>
    </PaginationContainer>
  );
};

Pagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
};

export default Pagination;

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import styled from 'styled-components';
import { fetchStockAdjustments, updateStockAdjustment, deleteStockAdjustment, bulkDeleteStockAdjustments, exportStockAdjustmentsCsv, exportStockAdjustmentsPdf } from '../services/api';
import AddAdjustmentModal from '../modals/AddAdjustmentModal';
import EditAdjustmentModal from '../modals/EditAdjustmentModal';
import { Alert, Table, Button, Form, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { ThemeProvider } from "styled-components";


const getThemeValue = (path, fallback) => props => {
  const value = path.split('.').reduce((acc, part) => {
    if (acc && acc[part] !== undefined) return acc[part];
    return undefined;
  }, props.theme);

  return value !== undefined ? value : fallback;
};

const StockLevelsContainer = styled.div`
  padding: clamp(10px, 3vw, 20px);
  min-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  width: 100%;
  background-color: ${getThemeValue('colors.background', '#ffffff')};
  color: ${getThemeValue('colors.text.primary', '#2d3748')};
  
  @media (max-width: 768px) {
    padding: 10px;
  }
`;

const ContentWrapper = styled.div`
  padding: clamp(10px, 3vw, 20px);
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  
  @media (max-width: 768px) {
    padding: 10px;
  }
`;

const Heading = styled.h1`
  color: ${getThemeValue('colors.text.primary', '#2d3748')};
  margin-bottom: 2.5rem;
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  border-bottom: 2px solid ${getThemeValue('colors.border', '#e2e8f0')};
  padding-bottom: 1rem;
`;

const Filters = styled.div`
  margin-bottom: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  align-items: center;
  background-color: ${getThemeValue('colors.surface', '#1a365d')};
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
`;


const StyledTable = styled(Table)`
  margin-bottom: 20px;
  min-width: 800px; // Ensures table doesn't collapse too much

  @media (max-width: 768px) {
    font-size: 14px;

    ${Td}, ${Th} {
      padding: 8px 4px;
    }
  }
`;

const StyledFormControl = styled(Form.Control)`
  height: 2.5rem;
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};
  border-radius: 3px;
  width: 100%;
  color: ${getThemeValue('colors.text.primary', '#2d3748')};
  background-color: ${getThemeValue('colors.background', '#ffffff')};

  &::placeholder {
    color: ${getThemeValue('colors.text.secondary', '#4a5568')};
  }

  &:focus {
    border-color: ${getThemeValue('colors.accent', '#2b6cb0')};
    box-shadow: 0 0 0 3px rgba(43, 108, 176, 0.1);
  }
`;

const Th = styled.th`
  background-color: #f5f5f5;
  padding: clamp(8px, 2vw, 10px);
  border: 3px solid ${getThemeValue('colors.border', '#e2e8f0')};
  cursor: pointer;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;
  min-width: 100px;
  
  &:hover {
    background-color: #e9ecef;
  }

  @media (max-width: 768px) {
    padding: 8px;
    font-size: 13px;
  }
`;

const Td = styled.td`
  padding: clamp(8px, 2vw, 10px);
  border: 1px solid #ddd;
  white-space: nowrap;
  
  @media (max-width: 768px) {
    padding: 8px;
    font-size: 13px;
  }
`;

const TableContainer = styled.div`
  width: 100%;
  margin: 0 auto;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;

  @media (max-width: 768px) {
    margin: 0;
    border-radius: 0;
    box-shadow: none;
  }
`;

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin-bottom: 1.5rem;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  background-color: ${getThemeValue('colors.surface', '#f7fafc')};
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};

  @media (max-width: 768px) {
    margin: 0 -1.5rem;
    width: calc(100% + 3rem);
    border-radius: 0;
  }

  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: ${getThemeValue('colors.surface', '#f7fafc')};
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${getThemeValue('colors.border', '#e2e8f0')};
    border-radius: 4px;

    &:hover {
      background: ${getThemeValue('colors.text.secondary', '#4a5568')};
    }
  }
`;

const ActionButtonContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: clamp(0.5rem, 2vw, 1rem);
  margin-bottom: 20px;
  width: 100%;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
`;

const ActionButton = styled(Button)`
  background-color: ${getThemeValue('colors.primary', '#1a365d')};
  color: white;
  border: none;
  padding: 10px;
  font-weight: bold;
  transition: all 0.3s ease;
  width: 100%;
  white-space: nowrap;
  font-size: clamp(0.875rem, 2vw, 1rem);
  border-radius: 12px;

  &:hover {
    background-color: #04296a;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  &:disabled {
    opacity: 0.5;
    transform: none;
    box-shadow: none;
  }
`;

const AnimatedTableRow = styled.tr`
  transition: all 0.3s ease;

  &:hover {
    background-color: #f0f8ff;
    transform: scale(1.01);
  }
`;

const PaginationContainer = styled.div`
  width: 100%;
  margin-top: auto;
  padding: 1rem;
  background-color: ${getThemeValue('colors.surface', '#f7fafc')};
  border-radius: 4px;
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};

  @media (max-width: 768px) {
    border-radius: 0;
    margin: 0 -1.5rem;
    width: calc(100% + 3rem);
  }
`;

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: clamp(3px, 1vw, 5px);
  padding: 10px 0;
  
  @media (max-width: 768px) {
    gap: 3px;
  }
`;

const PaginationButton = styled.button`
  padding: clamp(6px, 2vw, 10px);
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: ${props => props.disabled ? '#f0f0f0' : '#fff'};
  color: ${props => props.disabled ? '#888' : '#0645AD'};
  transition: all 0.3s ease;
  font-size: clamp(12px, 2vw, 14px);
  min-width: 40px;
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:hover:not(:disabled) {
    background-color: #0645AD;
    color: white;
  }

  @media (max-width: 768px) {
    padding: 6px;
    min-width: 36px;
  }
`;

const StockLevelsPage = () => {
  const { isAuthenticated } = useAuth();
  const [stockAdjustments, setStockAdjustments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [adjustmentsPerPage] = useState(10);

  // Filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [maxQuantity, setMaxQuantity] = useState('');
  const [adjustmentTypeFilter, setAdjustmentTypeFilter] = useState('');

  // Sorting state
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAdjustmentId, setEditingAdjustmentId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState(null);

  // Selected adjustments state
  const [selectedAdjustments, setSelectedAdjustments] = useState([]);

  const fetchStockAdjustmentsData = useCallback(async () => {
    if (isAuthenticated()) {
      setLoading(true);
      try {
        const params = {
          page: currentPage,
          page_size: adjustmentsPerPage,
          search: searchTerm,
          product: productFilter,
          min_quantity: minQuantity,
          max_quantity: maxQuantity,
          adjustment_type: adjustmentTypeFilter,
          ordering: `${sortDirection === 'desc' ? '-' : ''}${sortField}`
        };
        
        Object.keys(params).forEach(key => 
          (params[key] === undefined || params[key] === '') && delete params[key]
        );

        const adjustmentsData = await fetchStockAdjustments(params);
        setStockAdjustments(adjustmentsData.results || []);
        setTotalPages(Math.ceil(adjustmentsData.count / adjustmentsPerPage));
      } catch (error) {
        setError('Error fetching stock adjustments. Please try again.');
        console.error('Error fetching stock adjustments:', error);
	setStockAdjustments([]);
      } finally {
        setLoading(false);
      }
    }
  }, [isAuthenticated, currentPage, adjustmentsPerPage, searchTerm, productFilter, minQuantity, maxQuantity, adjustmentTypeFilter, sortField, sortDirection]);

  useEffect(() => {
    fetchStockAdjustmentsData();
  }, [fetchStockAdjustmentsData]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const handleProductFilterChange = (event) => {
    setProductFilter(event.target.value);
    setCurrentPage(1);
  };

  const handleMinQuantityChange = (event) => {
    setMinQuantity(event.target.value);
    setCurrentPage(1);
  };

  const handleMaxQuantityChange = (event) => {
    setMaxQuantity(event.target.value);
    setCurrentPage(1);
  };

  const handleAdjustmentTypeFilterChange = (event) => {
    setAdjustmentTypeFilter(event.target.value);
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    setSortDirection(sortField === field && sortDirection === 'asc' ? 'desc' : 'asc');
    setSortField(field);
    setCurrentPage(1);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedAdjustments(stockAdjustments.map(a => a.id));
    } else {
      setSelectedAdjustments([]);
    }
  };

  const handleSelectAdjustment = (id) => {
    setSelectedAdjustments(prevSelected => 
      prevSelected.includes(id) 
        ? prevSelected.filter(a => a !== id)
        : [...prevSelected, id]
    );
  };

  const handleUpdateAdjustment = async (updatedAdjustment) => {
    try {
      await updateStockAdjustment(updatedAdjustment.id, updatedAdjustment);
      setSuccess('Stock adjustment updated successfully.');
      setShowEditModal(false);
      fetchStockAdjustmentsData();
    } catch (error) {
      console.error('Error updating stock adjustment:', error);
      setError('Error updating stock adjustment. Please try again.');
    }
  };

  const handleDeleteAdjustment = async (adjustmentId) => {
    if (window.confirm('Are you sure you want to delete this stock adjustment?')) {
      try {
        await deleteStockAdjustment(adjustmentId);
        setSuccess('Stock adjustment deleted successfully.');
        fetchStockAdjustmentsData();
      } catch (error) {
        setError('Error deleting stock adjustment. Please try again.');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedAdjustments.length} stock adjustments?`)) {
      try {
        await bulkDeleteStockAdjustments(selectedAdjustments);
        setSuccess(`${selectedAdjustments.length} stock adjustments deleted successfully.`);
        setSelectedAdjustments([]);
        fetchStockAdjustmentsData();
      } catch (error) {
        setError('Error deleting stock adjustments. Please try again.');
      }
    }
  };

  const handleExportCsv = async () => {
    try {
      await exportStockAdjustmentsCsv();
      setSuccess('Stock adjustments exported to CSV successfully.');
    } catch (error) {
      setError('Error exporting stock adjustments to CSV. Please try again.');
    }
  };

  const handleExportPdf = async () => {
    try {
      setLoading(true);
      await exportStockAdjustmentsPdf();
      setSuccess('Stock adjustments exported to PDF successfully.');
    } catch (error) {
      console.error('Error exporting stock adjustments to PDF:', error);
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        setError(`Error exporting stock adjustments to PDF: ${error.response.status} ${error.response.statusText}`);
      } else if (error.request) {
        // The request was made but no response was received
        setError('Error exporting stock adjustments to PDF: No response received from server');
      } else {
        // Something happened in setting up the request that triggered an Error
        setError(`Error exporting stock adjustments to PDF: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditAdjustment = (adjustment) => {
    console.log('Edit button clicked for adjustment:', adjustment);
    setEditingAdjustment(adjustment);
    setShowEditModal(true);
  };

  const handleAddAdjustment = () => {
    try {
      setShowAddModal(true);
    } catch (error) {
      console.error('Error opening Add Stock Adjustment modal:', error);
      setError('Failed to open Add Stock Adjustment modal. Please try again.');
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  if (!isAuthenticated()) {
    return <Alert variant="warning">Please log in to view stock adjustments.</Alert>;
  }

  return (
    <StockLevelsContainer>
      <ContentWrapper>
      <Heading>Stock Adjustments</Heading>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}

      <Filters>
        <StyledFormControl
          type="text"
          placeholder="Search adjustments..."
          value={searchTerm}
          onChange={handleSearchChange}
        />
        <StyledFormControl
          type="text"
          placeholder="Filter by product"
          value={productFilter}
          onChange={handleProductFilterChange}
        />
        <StyledFormControl
          type="number"
          placeholder="Min Quantity"
          value={minQuantity}
          onChange={handleMinQuantityChange}
        />
        <StyledFormControl
          type="number"
          placeholder="Max Quantity"
          value={maxQuantity}
          onChange={handleMaxQuantityChange}
        />
        <StyledFormControl
          as="select"
          value={adjustmentTypeFilter}
          onChange={handleAdjustmentTypeFilterChange}
        >
          <option value="">All Types</option>
          <option value="ADD">Add</option>
          <option value="REMOVE">Remove</option>
          <option value="RETURN">Return</option>
          <option value="DAMAGE">Damage</option>
        </StyledFormControl>
      </Filters>

      <ActionButtonContainer>
        <ActionButton onClick={handleAddAdjustment}>Add Stock Adjustment</ActionButton>
        <ActionButton onClick={handleBulkDelete} disabled={selectedAdjustments.length === 0}>Delete Selected</ActionButton>
        <ActionButton onClick={handleExportCsv}>Export CSV</ActionButton>
        <ActionButton onClick={handleExportPdf}>Export PDF</ActionButton>
      </ActionButtonContainer>

      <TableContainer>
      {loading ? (
        <Spinner animation="border" role="status" className="d-block mx-auto" />
      ) : (
        <>
	  <TableWrapper>
          <StyledTable striped bordered hover>
            <thead>
              <tr>
                <Th><Form.Check type="checkbox" onChange={handleSelectAll} /></Th>
            	<Th onClick={() => handleSort('adjustment_date')}>Date {sortField === 'adjustment_date' && (sortDirection === 'asc' ? '▲' : '▼')}</Th>
            	<Th onClick={() => handleSort('product__name')}>Product {sortField === 'product__name' && (sortDirection === 'asc' ? '▲' : '▼')}</Th>
            	<Th onClick={() => handleSort('quantity')}>Adjustment Quantity {sortField === 'quantity' && (sortDirection === 'asc' ? '▲' : '▼')}</Th>
            	<Th onClick={() => handleSort('adjustment_type')}>Type {sortField === 'adjustment_type' && (sortDirection === 'asc' ? '▲' : '▼')}</Th>
                <Th>Current Stock</Th>
	        <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {stockAdjustments && stockAdjustments.length > 0 ? (
		stockAdjustments.map((adjustment) => (
                  <AnimatedTableRow key={adjustment.id}>
                    <Td><Form.Check type="checkbox" checked={selectedAdjustments.includes(adjustment.id)} onChange={() => handleSelectAdjustment(adjustment.id)} /></Td>
                    <Td>{adjustment.adjustment_date}</Td>
                    <Td>
                      {adjustment.product && adjustment.product.id ? (
                        <Link to={`/products/${adjustment.product.id}`}>{adjustment.product.name}</Link>
                      ) : (
                        'N/A'
                      )}
                    </Td>
                    <Td>{adjustment.quantity}</Td>
                    <Td>{adjustment.adjustment_type}</Td>
		    <Td>{adjustment.product ? adjustment.product.stock : 'N/A'}</Td>
                    <Td>
                      <Button variant="warning" size="sm" onClick={() => handleEditAdjustment(adjustment)}>Edit</Button>
                      <Button variant="danger" size="sm" onClick={() => handleDeleteAdjustment(adjustment.id)}>Delete</Button>
                    </Td>
                  </AnimatedTableRow>
                ))
              ) : (
                <tr>
                  <Td colSpan="6">No stock adjustments found.</Td>
                </tr>
              )}
            </tbody>
          </StyledTable>
	  </TableWrapper>

          {totalPages > 1 && (
	    <PaginationContainer>
            <Pagination>
              <PaginationButton
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              >
                First
              </PaginationButton>

              <PaginationButton
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </PaginationButton>

              {[...Array(totalPages).keys()]
                .filter(number => {
                  const page = number + 1;
                  return (
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  );
                })
                .map(number => {
                  const page = number + 1;
                  return (
                    <React.Fragment key={page}>
                      {page > 1 &&
                       Math.abs(page - [...Array(totalPages).keys()]
                         .filter(n => {
                           const p = n + 1;
                           return (
                             p === 1 ||
                             p === totalPages ||
                             Math.abs(p - currentPage) <= 1
                           );
                         })[number - 1] - 1) > 1 && (
                        <span>...</span>
                      )}
                      <PaginationButton
                        onClick={() => handlePageChange(page)}
                        disabled={currentPage === page}
                      >
                        {page}
                      </PaginationButton>
                    </React.Fragment>
                  );
                })}

              <PaginationButton
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </PaginationButton>

              <PaginationButton
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
              >
                Last
              </PaginationButton>
            </Pagination>
	    </PaginationContainer>
          )}
        </>
       )}

      <AddAdjustmentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={(newAdjustment) => {
          fetchStockAdjustmentsData();
          setSuccess('Stock adjustment added successfully.');
        }}
      />

        <EditAdjustmentModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          adjustment={editingAdjustment}
          onUpdate={handleUpdateAdjustment}
          setSuccess={setSuccess}
          setError={setError}
        />
        </TableContainer>	
      </ContentWrapper>
    </StockLevelsContainer>
  );
};

export default StockLevelsPage;

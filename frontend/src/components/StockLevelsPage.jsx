import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import styled from 'styled-components';
import { fetchStockAdjustments, updateStockAdjustment, deleteStockAdjustment, bulkDeleteStockAdjustments, exportStockAdjustmentsCsv, exportStockAdjustmentsPdf } from '../services/api';
import AddAdjustmentModal from '../modals/AddAdjustmentModal';
import EditAdjustmentModal from '../modals/EditAdjustmentModal';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const StockLevelsContainer = styled.div`
  padding: 20px;
`;

const Heading = styled.h1`
  font-size: 2em;
  margin-bottom: 20px;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
`;

const Filters = styled.div`
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
`;

const ActionButtonContainer = styled.div`
  margin-bottom: 20px;
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

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (!isAuthenticated()) {
    return <Alert variant="warning">Please log in to view stock adjustments.</Alert>;
  }

  return (
    <StockLevelsContainer>
      <Heading>Stock Adjustments</Heading>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}

      <Filters>
        <Form.Control
          type="text"
          placeholder="Search adjustments..."
          value={searchTerm}
          onChange={handleSearchChange}
        />
        <Form.Control
          type="text"
          placeholder="Filter by product"
          value={productFilter}
          onChange={handleProductFilterChange}
        />
        <Form.Control
          type="number"
          placeholder="Min Quantity"
          value={minQuantity}
          onChange={handleMinQuantityChange}
        />
        <Form.Control
          type="number"
          placeholder="Max Quantity"
          value={maxQuantity}
          onChange={handleMaxQuantityChange}
        />
        <Form.Control
          as="select"
          value={adjustmentTypeFilter}
          onChange={handleAdjustmentTypeFilterChange}
        >
          <option value="">All Types</option>
          <option value="ADD">Add</option>
          <option value="REMOVE">Remove</option>
          <option value="RETURN">Return</option>
          <option value="DAMAGE">Damage</option>
        </Form.Control>
      </Filters>

      <ActionButtonContainer>
        <Button onClick={handleAddAdjustment}>Add Stock Adjustment</Button>
        <Button onClick={handleBulkDelete} disabled={selectedAdjustments.length === 0}>Delete Selected</Button>
        <Button onClick={handleExportCsv}>Export CSV</Button>
        <Button onClick={handleExportPdf}>Export PDF</Button>
      </ActionButtonContainer>

      {loading ? (
        <Spinner animation="border" role="status" className="d-block mx-auto" />
      ) : (
        <>
          <StyledTable striped bordered hover>
            <thead>
              <tr>
                <th><Form.Check type="checkbox" onChange={handleSelectAll} /></th>
            	<th onClick={() => handleSort('adjustment_date')}>Date {sortField === 'adjustment_date' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
            	<th onClick={() => handleSort('product__name')}>Product {sortField === 'product__name' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
            	<th onClick={() => handleSort('quantity')}>Adjustment Quantity {sortField === 'quantity' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
            	<th onClick={() => handleSort('adjustment_type')}>Type {sortField === 'adjustment_type' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
                <th>Current Stock</th>
	        <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stockAdjustments && stockAdjustments.length > 0 ? (
		stockAdjustments.map((adjustment) => (
                  <tr key={adjustment.id}>
                    <td><Form.Check type="checkbox" checked={selectedAdjustments.includes(adjustment.id)} onChange={() => handleSelectAdjustment(adjustment.id)} /></td>
                    <td>{adjustment.adjustment_date}</td>
                    <td>
                      {adjustment.product && adjustment.product.id ? (
                        <Link to={`/products/${adjustment.product.id}`}>{adjustment.product.name}</Link>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td>{adjustment.quantity}</td>
                    <td>{adjustment.adjustment_type}</td>
		    <td>{adjustment.product ? adjustment.product.stock : 'N/A'}</td>
                    <td>
                      <Button variant="warning" size="sm" onClick={() => handleEditAdjustment(adjustment)}>Edit</Button>
                      <Button variant="danger" size="sm" onClick={() => handleDeleteAdjustment(adjustment.id)}>Delete</Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">No stock adjustments found.</td>
                </tr>
              )}
            </tbody>
          </StyledTable>

          <div>
            {Array.from({ length: totalPages }, (_, index) => (
              <Button key={index + 1} onClick={() => paginate(index + 1)} disabled={currentPage === index + 1}>
                {index + 1}
              </Button>
            ))}
          </div>
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
    </StockLevelsContainer>
  );
};

export default StockLevelsPage;

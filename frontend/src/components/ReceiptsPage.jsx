import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useReceipts } from '../context/ReceiptContext';
import styled from 'styled-components';
import { FaPlus, FaFileExport } from "react-icons/fa";
import { formatCurrency } from '../utils/dataTransformations';
import CreateReceiptModal from '../modals/CreateReceiptModal';
import { 
  generateReceiptPDF,
  fetchReceipt,
  fetchReceipts, 
  exportReceiptsPdf, 
  createReceipt, 
  updateReceipt, 
  deleteReceipt, 
  bulkDeleteReceipts 
} from '../services/api';
import { 
  Button, 
  Badge, 
  Table, 
  Form, 
  Container, 
  Row, 
  Col, 
  Spinner, 
  Alert, 
  Modal, 
  ButtonGroup 
} from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { ReceiptQRCode, ReceiptQRCodeModal } from './QRCode';
import EditReceiptModal from '../modals/EditReceiptModal';

const getThemeValue = (path, fallback) => props => {
  const value = path.split('.').reduce((acc, part) => {
    if (acc && acc[part] !== undefined) return acc[part];
    return undefined;
  }, props.theme);

  return value !== undefined ? value : fallback;
};

const ReceiptsContainer = styled.div`
  padding: 2rem;
  height: 100%;
  min-height: calc(100vh - var(--header-height, 64px));
  background-color: ${getThemeValue('colors.background', '#ffffff')};
  color: ${getThemeValue('colors.text.primary', '#2d3748')};

  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`;

const ContentWrapper = styled.div`
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  background-color: ${getThemeValue('colors.background', '#ffffff')};
`;

const Heading = styled.h1`
  color: ${getThemeValue('colors.text.primary', '#2d3748')};
  margin-bottom: 2.5rem;
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  border-bottom: 2px solid ${getThemeValue('colors.border', '#e2e8f0')};
  padding-bottom: 1rem;

  @media (max-width: 768px) {
    text-align: center;
  }
`;

const ActionBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const FilterSection = styled.div`
  margin-bottom: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  background-color: ${getThemeValue('colors.surface', '#1a365d')};
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.75rem;
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

const StyledTable = styled(Table)`
  margin-bottom: 0;
  
  th {
    background-color: ${getThemeValue('colors.table.header', '#f7fafc')};
    color: ${getThemeValue('colors.text.secondary', '#4a5568')};
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
  }

  td {
    vertical-align: middle;
    color: ${getThemeValue('colors.text.primary', '#2d3748')};
  }

  tr:hover {
    background-color: ${getThemeValue('colors.table.hover', '#f7fafc')};
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

const Pagination = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
`;

const PaginationInfo = styled.div`
  color: ${getThemeValue('colors.text.secondary', '#4a5568')};
  font-size: 0.875rem;
`;

const PaginationControls = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button`
  background-color: ${props => {
    switch (props.variant) {
      case 'danger':
        return getThemeValue('colors.danger', '#e53e3e');
      case 'info':
        return getThemeValue('colors.info', '#3182ce');
      case 'warning':
        return getThemeValue('colors.warning', '#dd6b20');
      default:
        return getThemeValue('colors.primary', '#1a365d');
    }
  }};
  color: white;
  border: none;
  border-radius: ${props => (props.size === 'sm' ? '8px' : '12px')};
  padding: ${props =>
    props.size === 'sm' ? '0.5rem 1rem' : '0.75rem 1.5rem'};
  font-weight: 500;
  cursor: pointer;
  transition: ${getThemeValue('transitions.standard', 'all 0.2s ease-in-out')};
  font-size: ${props => (props.size === 'sm' ? '0.75rem' : '0.875rem')};
  letter-spacing: 0.025em;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &:hover:not(:disabled) {
    background-color: ${props => {
      switch (props.variant) {
        case 'danger':
          return getThemeValue('colors.dangerHover', '#c53030');
        case 'info':
          return getThemeValue('colors.infoHover', '#3182ce');
        case 'warning':
          return getThemeValue('colors.warningHover', '#c05621');
        default:
          return getThemeValue('colors.secondary', '#87CEFA');
      }
    }};
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    transform: none;
    box-shadow: none;
  }
`;

const StatusBadge = styled.span`
  padding: 0.5rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  display: inline-block;
  text-align: center;
  min-width: 80px;

  ${({ status }) => {
    switch (status) {
      case 'PAID':
        return `
          background-color: ${getThemeValue('colors.success.light', '#d4edda')};
          color: ${getThemeValue('colors.success.dark', '#155724')};
          border: 1px solid ${getThemeValue('colors.success.border', '#c3e6cb')};
        `;
      case 'PENDING':
        return `
          background-color: ${getThemeValue('colors.warning.light', '#fff3cd')};
          color: ${getThemeValue('colors.warning.dark', '#856404')};
          border: 1px solid ${getThemeValue('colors.warning.border', '#ffeeba')};
        `;
      case 'OVERDUE':
        return `
          background-color: ${getThemeValue('colors.error.light', '#f8d7da')};
          color: ${getThemeValue('colors.error.dark', '#721c24')};
          border: 1px solid ${getThemeValue('colors.error.border', '#f5c6cb')};
        `;
      default:
        return `
          background-color: ${getThemeValue('colors.neutral.light', '#e2e3e5')};
          color: ${getThemeValue('colors.neutral.dark', '#383d41')};
          border: 1px solid ${getThemeValue('colors.neutral.border', '#d6d8db')};
        `;
    }
  }}
`;

const ReceiptsPage = () => {
  const { isAuthenticated } = useAuth();
  const { receipts, setReceipts, addReceipt, fetchReceipts: contextFetchReceipts } = useReceipts();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    receiptsPerPage: 10
  });

  // Filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // Sorting state
  const [sortField, setSortField] = useState('payment_date');
  const [sortDirection, setSortDirection] = useState('desc');

  // Modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Selected receipts state
  const [selectedReceipts, setSelectedReceipts] = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);
  const [exportFormat, setExportFormat] = useState('detailed');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrReceiptData, setQRReceiptData] = useState(null);

  // Export format options
  const exportFormatOptions = [
    { value: 'detailed', label: 'Detailed Export' },
    { value: 'summary', label: 'Summary Export' }
  ];

  const paymentMethodOptions = ['cash', 'credit_card', 'bank_transfer', 'cheque', 'online', 'other'];

  const fetchReceiptsData = useCallback(async () => {
    if (isAuthenticated) {
      setLoading(true);
      setError(null);
      setDebugInfo(null);
      try {
        const params = {
          page: pagination.currentPage,
          page_size: pagination.receiptsPerPage,
          search: searchTerm,
          payment_date: dateFilter,
          payment_method: paymentMethodFilter,
          min_amount: minAmount,
          max_amount: maxAmount,
          ordering: `${sortDirection === 'desc' ? '-' : ''}${sortField}`
        };

        Object.keys(params).forEach(key =>
          (params[key] === undefined || params[key] === '') && delete params[key]
        );

        console.log('Calling fetchReceipts with params:', params);
        const response = await fetchReceipts(params);
        console.log('Raw response from fetchReceipts:', response);

        // Check if response is an array
  	if (Array.isArray(response)) {
    	  console.log('Receipts received:', response.length);
    	  setReceipts(response);
    	  setPagination((prevState) => ({
      	    ...prevState,
            totalPages: Math.ceil(response.length / prevState.receiptsPerPage),
          }));
        }
        // Keep existing checks for paginated response structure
        else if (response && response.count !== undefined) {
          console.log('Total count:', response.count);
          setPagination((prevState) => ({
            ...prevState,
            totalPages: Math.ceil(response.count / prevState.receiptsPerPage),
          }));
    
          if (response.results) {
            console.log('Receipts received:', response.results.length);
            setReceipts(response.results);
          } else {
            console.log('No results in response');
            setReceipts([]);
          }
        } else {
          console.log('Unexpected response format');
          setReceipts([]);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error in fetchReceiptsData:', error);
        setError('Failed to fetch receipts. Please try again.');
        setDebugInfo(JSON.stringify(error, null, 2));
        setLoading(false);
      }
    }
  }, [isAuthenticated, pagination.currentPage, pagination.receiptsPerPage, searchTerm, dateFilter, paymentMethodFilter, minAmount, maxAmount, sortField, sortDirection]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchReceiptsData();
    }
  }, [isAuthenticated, fetchReceiptsData]);

  const handleSort = (field) => {
    setSortDirection(prevDirection => 
      sortField === field 
        ? (prevDirection === 'asc' ? 'desc' : 'asc') 
        : 'desc'
    );
    setSortField(field);
  };

  const handlePageChange = (page) => {
    setPagination((prevState) => ({
      ...prevState,
      currentPage: page,
    }));
  };

  const handleCreateReceipt = () => {
    // Create a blank/default receipt to edit
    const newReceipt = {
      id: null,
      receipt_number: 'New Receipt',
      invoice: null,
      invoice_number: '',
      customer_name: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'online',
      payment_reference: '',
      amount_paid: 0,
      notes: ''
    };
  
    setSelectedReceipt(newReceipt);
    setShowCreateModal(true);
  };

  const handleViewDetails = async (receipt) => {
    try {
      setLoading(true);
      // Fetch the complete receipt with items
      const detailedReceipt = await fetchReceipt(receipt.id);
      console.log('Detailed receipt data:', detailedReceipt);
      setSelectedReceipt(detailedReceipt);
      setShowDetailsModal(true);
    } catch (error) {
      setError('Failed to load receipt details. Please try again.');
      console.error('Error loading receipt details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async (receiptId) => {
    try {
      setLoading(true);
      await generateReceiptPDF(receiptId);
      setSuccess('Receipt PDF generated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError('Failed to generate PDF. Please try again.');
      console.error('PDF generation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (selectedReceipts.length === 0) {
      setError('Please select at least one receipt to export');
      return;
    }
  
    try {
      setLoading(true);
      await exportReceiptsPdf('receipts', selectedReceipts, exportFormat);
      setSuccess('Receipts exported successfully');
      setShowExportModal(false);
    } catch (error) {
      setError('Failed to export receipts. Please try again.');
      console.error('Export error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditReceipt = (receipt) => {
    setSelectedReceipt(receipt);
    setShowEditModal(true);
  };

  const handleDeleteReceipt = async (receiptId) => {
    if (window.confirm('Are you sure you want to delete this receipt? This action cannot be undone.')) {
      try {
        setLoading(true);
        await deleteReceipt(receiptId);
        setReceipts(receipts.filter(receipt => receipt.id !== receiptId));
        setSuccess('Receipt deleted successfully');
        setTimeout(() => setSuccess(null), 3000);
      } catch (error) {
        setError('Failed to delete receipt. Please try again.');
        console.error('Delete error:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedReceipts.length) {
      setError('Please select at least one receipt to delete');
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${selectedReceipts.length} receipt(s)? This action cannot be undone.`)) {
      try {
        setLoading(true);
        await bulkDeleteReceipts(selectedReceipts);
        setReceipts(receipts.filter(receipt => !selectedReceipts.includes(receipt.id)));
        setSelectedReceipts([]);
        setSuccess(`${selectedReceipts.length} receipt(s) deleted successfully`);
        setTimeout(() => setSuccess(null), 3000);
      } catch (error) {
        setError('Failed to delete receipts. Please try again.');
        console.error('Bulk delete error:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSelectReceipt = (receiptId) => {
    setSelectedReceipts(prevSelected => 
      prevSelected.includes(receiptId)
        ? prevSelected.filter(id => id !== receiptId)
        : [...prevSelected, receiptId]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedReceipts(receipts.map(receipt => receipt.id));
    } else {
      setSelectedReceipts([]);
    }
  };

  const handleShowQRCode = (receipt) => {
    setQRReceiptData(receipt);
    setShowQRModal(true);
  };

  const formatPaymentMethod = (method) => {
    return method.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getPaymentMethodBadgeVariant = (method) => {
    const variants = {
      'cash': 'success',
      'credit_card': 'primary',
      'bank_transfer': 'info',
      'cheque': 'warning',
      'online': 'secondary',
      'other': 'dark'
    };
    return variants[method] || 'secondary';
  };

  const renderCreateModal = () => (
    <CreateReceiptModal
      show={showCreateModal}
      onHide={() => setShowCreateModal(false)}
      onSave={(newReceipt) => {
        addReceipt(newReceipt);
        setSuccess('Receipt created successfully');
        setTimeout(() => setSuccess(null), 3000);
        fetchReceiptsData(); // Refresh the list
      }}
    />
  );

  const renderFilterOptions = () => (
    <FilterSection>
      <Form.Group as={Col} md="3">
        <StyledFormControl
          type="text"
          placeholder="Search receipts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Form.Group>
      <Form.Group as={Col} md="2">
        <StyledFormControl
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          placeholder="Filter by date"
        />
      </Form.Group>
      <Form.Group as={Col} md="2">
        <Form.Select
          value={paymentMethodFilter}
          onChange={(e) => setPaymentMethodFilter(e.target.value)}
        >
          <option value="">All Payment Methods</option>
          {paymentMethodOptions.map(method => (
            <option key={method} value={method}>
              {formatPaymentMethod(method)}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
      <Form.Group as={Col} md="2">
        <StyledFormControl
          type="number"
          placeholder="Min Amount"
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
        />
      </Form.Group>
      <Form.Group as={Col} md="2">
        <StyledFormControl
          type="number"
          placeholder="Max Amount"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
        />
      </Form.Group>
      <ActionButton
        variant="secondary"
        onClick={() => {
          setSearchTerm('');
          setDateFilter('');
          setPaymentMethodFilter('');
          setMinAmount('');
          setMaxAmount('');
        }}
      >
        Clear Filters
      </ActionButton>
    </FilterSection>
  );

  const renderActionBar = () => (
    <ActionBar>
      <div>
        <ActionButton
          variant="primary"
          onClick={handleCreateReceipt}
          className="me-2"
        >
          <FaPlus /> Create Receipt
        </ActionButton>

        <ButtonGroup className="me-2">
          <ActionButton
            variant="danger"
            disabled={!selectedReceipts.length}
            onClick={handleBulkDelete}
          >
            Delete Selected
          </ActionButton>
        </ButtonGroup>
      </div>

      <div>
        <Form.Control
          type="text"
          placeholder="Quick search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="d-inline-block"
          style={{ width: 'auto' }}
        />
      </div>
    </ActionBar>
  );

  const renderReceiptsTable = () => (
    <TableContainer>
      <TableWrapper>
      <StyledTable striped hover responsive>
        <thead>
          <tr>
            <Th>
              <Form.Check
                type="checkbox"
                onChange={handleSelectAll}
                checked={selectedReceipts.length === receipts.length && receipts.length > 0}
              />
            </Th>
            <Th onClick={() => handleSort('receipt_number')} style={{ cursor: 'pointer' }}>
              Receipt # {sortField === 'receipt_number' && (sortDirection === 'asc' ? '↑' : '↓')}
            </Th>
            <Th onClick={() => handleSort('invoice__invoice_number')} style={{ cursor: 'pointer' }}>
              Invoice # {sortField === 'invoice__invoice_number' && (sortDirection === 'asc' ? '↑' : '↓')}
            </Th>
            <Th onClick={() => handleSort('payment_date')} style={{ cursor: 'pointer' }}>
              Date {sortField === 'payment_date' && (sortDirection === 'asc' ? '↑' : '↓')}
            </Th>
            <Th onClick={() => handleSort('payment_method')} style={{ cursor: 'pointer' }}>
              Payment Method {sortField === 'payment_method' && (sortDirection === 'asc' ? '↑' : '↓')}
            </Th>
            <Th onClick={() => handleSort('amount_paid')} style={{ cursor: 'pointer' }}>
              Amount {sortField === 'amount_paid' && (sortDirection === 'asc' ? '↑' : '↓')}
            </Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {receipts.length === 0 ? (
            <tr>
              <Td colSpan="7" className="text-center">No receipts found</Td>
            </tr>
          ) : (
            receipts.map(receipt => (
              <tr key={receipt.id}>
                <Td>
                  <Form.Check
                    type="checkbox"
                    checked={selectedReceipts.includes(receipt.id)}
                    onChange={() => handleSelectReceipt(receipt.id)}
                  />
                </Td>
                <Td>{receipt.receipt_number}</Td>
                <Td>{receipt.invoice_number}</Td>
                <Td>{new Date(receipt.payment_date).toLocaleDateString()}</Td>
                <Td>
                  <StatusBadge bg={getPaymentMethodBadgeVariant(receipt.payment_method)}>
                    {formatPaymentMethod(receipt.payment_method)}
                  </StatusBadge>
                </Td>
                <Td>{formatCurrency(receipt.amount_paid)}</Td>
                <Td>
                  <ButtonGroup size="sm">
                    <Button variant="outline-secondary" onClick={() => handleViewDetails(receipt)}>
                      View
                    </Button>
                    <Button variant="outline-primary" onClick={() => handleEditReceipt(receipt)}>
                      Edit
                    </Button>
                    <Button variant="outline-danger" onClick={() => handleDeleteReceipt(receipt.id)}>
                      Delete
                    </Button>
                    <Button variant="outline-success" onClick={() => handleGeneratePDF(receipt.id)}>
                      PDF
                    </Button>
                    <Button variant="outline-info" onClick={() => handleShowQRCode(receipt)}>
                      QR
                    </Button>
                  </ButtonGroup>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </StyledTable>
      </TableWrapper>
    </TableContainer>
  );

  const renderPagination = () => (
    <Pagination>
      <PaginationInfo>
        Showing {((pagination.currentPage - 1) * pagination.receiptsPerPage) + 1} to {Math.min(pagination.currentPage * pagination.receiptsPerPage, receipts.length)} of {receipts.length} receipts
      </PaginationInfo>
      <PaginationControls>
        <Button
          variant="outline-secondary"
          size="sm"
          disabled={pagination.currentPage === 1}
          onClick={() => handlePageChange(pagination.currentPage - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline-secondary"
          size="sm"
          disabled={pagination.currentPage === pagination.totalPages}
          onClick={() => handlePageChange(pagination.currentPage + 1)}
        >
          Next
        </Button>
      </PaginationControls>
    </Pagination>
  );

  const renderDetailsModal = () => (
    <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="lg">
      <Modal.Header closeButton className="bg-light">
        <Modal.Title>
          <i className="fas fa-receipt me-2"></i>
          Receipt #{selectedReceipt?.receipt_number}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {selectedReceipt && (
          <Container>
            {/* Business Info */}
            <Row className="mb-4 border-bottom pb-3">
              <Col md={6}>
                <h5 className="text-primary">Your Company Name</h5>
                <p className="mb-0">123 Business Street</p>
                <p className="mb-0">City, State 12345</p>
                <p className="mb-0">Phone: (123) 456-7890</p>
                <p className="mb-0">Email: info@yourcompany.com</p>
              </Col>
              <Col md={6} className="text-md-end">
                <h5 className="mb-3">RECEIPT</h5>
                <p className="mb-0"><strong>Date:</strong> {new Date(selectedReceipt.payment_date).toLocaleDateString()}</p>
                <p className="mb-0"><strong>Receipt #:</strong> {selectedReceipt.receipt_number}</p>
                <p className="mb-0"><strong>Invoice #:</strong> {selectedReceipt.invoice_number}</p>
              </Col>
            </Row>
          
            {/* Customer Info */}
            <Row className="mb-4 border-bottom pb-3">
              <Col md={12}>
                <h6 className="text-secondary mb-2">BILL TO:</h6>
                <p className="mb-0"><strong>{selectedReceipt.customer_name}</strong></p>
                {selectedReceipt.invoice?.customer_email && (
                  <p className="mb-0">Email: {selectedReceipt.invoice.customer_email}</p>
                )}
                {selectedReceipt.invoice?.customer_address && (
                  <p className="mb-0">Address: {selectedReceipt.invoice.customer_address}</p>
                )}
              </Col>
            </Row>
          
            {/* Payment Details */}
            <Row className="mb-4 border-bottom pb-3">
              <Col md={6}>
                <h6 className="text-secondary mb-2">PAYMENT DETAILS:</h6>
                <p className="mb-0"><strong>Method:</strong> {formatPaymentMethod(selectedReceipt.payment_method)}</p>
                {selectedReceipt.payment_reference && (
                  <p className="mb-0"><strong>Reference:</strong> {selectedReceipt.payment_reference}</p>
                )}
              </Col>
              <Col md={6} className="text-md-end">
                <h5 className="text-success mb-2">PAID</h5>
                <h4>{formatCurrency(selectedReceipt.amount_paid)}</h4>
              </Col>
            </Row>
          
            {/* Purchased Items */}
            <Row className="mb-4">
              <Col md={12}>
                <h6 className="text-secondary mb-3">PURCHASED ITEMS:</h6>
                <Table striped bordered responsive>
                  <thead className="bg-light">
                    <tr>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Unit Price</th>
                      <th className="text-end">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                      selectedReceipt.items.map((item, index) => (
                        <tr key={index}>
                          <td>{item.product_name || item.description}</td>
                          <td>{item.quantity}</td>
                          <td>{formatCurrency(item.unit_price)}</td>
                          <td className="text-end">{formatCurrency(item.total_price || (item.quantity * item.unit_price))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="text-center">No items available</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-light">
                    <tr>
                      <td colSpan="3" className="text-end"><strong>Subtotal:</strong></td>
                      <td className="text-end">{formatCurrency(selectedReceipt.amount_paid)}</td>
                    </tr>
                    {selectedReceipt.tax > 0 && (
                      <tr>
                        <td colSpan="3" className="text-end"><strong>Tax:</strong></td>
                        <td className="text-end">{formatCurrency(selectedReceipt.tax)}</td>
                      </tr>
                    )}
                    {selectedReceipt.discount > 0 && (
                      <tr>
                        <td colSpan="3" className="text-end"><strong>Discount:</strong></td>
                        <td className="text-end">-{formatCurrency(selectedReceipt.discount)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan="3" className="text-end"><strong>Total:</strong></td>
                      <td className="text-end"><strong>{formatCurrency(selectedReceipt.amount_paid)}</strong></td>
                    </tr>
                  </tfoot>
                </Table>
              </Col>
            </Row> 
            {/* Notes */}
            {selectedReceipt.notes && (
              <Row className="mb-3">
                <Col md={12}>
                  <h6 className="text-secondary mb-2">NOTES:</h6>
                  <p className="bg-light p-2 rounded">{selectedReceipt.notes}</p>
                </Col>
              </Row>
            )}
          
            {/* QR Code */}
            {selectedReceipt.qr_code && (
              <Row className="mb-3">
                <Col md={12} className="text-center">
                  <img src={selectedReceipt.qr_code} alt="Receipt QR Code" style={{ maxWidth: '150px' }} />
                </Col>
              </Row>
            )}
          
            {/* Thank You Message */}
            <Row className="mt-4">
              <Col md={12} className="text-center">
                <p className="text-muted">Thank you for your business!</p>
              </Col>
            </Row>
          </Container>
        )}
      </Modal.Body>
      <Modal.Footer className="bg-light">
        <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
          Close
        </Button>
        <Button variant="primary" onClick={() => handleGeneratePDF(selectedReceipt.id)}>
          <i className="fas fa-file-pdf me-1"></i> Download PDF
        </Button>
      </Modal.Footer>
    </Modal>
  );

  const renderExportModal = () => (
    <Modal show={showExportModal} onHide={() => setShowExportModal(false)}>
      <Modal.Header closeButton>
        <Modal.Title>Export Receipts</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Export Format</Form.Label>
          <Form.Select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
          >
            {exportFormatOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <p>
          {selectedReceipts.length > 0 
            ? `${selectedReceipts.length} receipt(s) selected for export`
            : 'All receipts will be exported'}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => setShowExportModal(false)}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleExport}>
          Export
        </Button>
      </Modal.Footer>
    </Modal>
  );

  const renderQRModal = () => (
    <ReceiptQRCodeModal
      show={showQRModal}
      onHide={() => setShowQRModal(false)}
      data={qrReceiptData}
      title="Receipt QR Code"
    />
  );

  return (
    <ReceiptsContainer>
      <ContentWrapper>
        <Heading>Receipts</Heading>
        
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}
        {debugInfo && <pre>{debugInfo}</pre>}
        
        {renderFilterOptions()}
        {renderActionBar()}
        
        {loading ? (
          <div className="text-center my-5">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        ) : (
          <>
            {renderReceiptsTable()}
            {renderPagination()}
          </>
        )}
        
        {selectedReceipt && (
          <EditReceiptModal
            show={showEditModal}
            onHide={() => setShowEditModal(false)}
            receipt={selectedReceipt}
            onSave={(updatedReceipt) => {
              setReceipts(receipts.map(r => r.id === updatedReceipt.id ? updatedReceipt : r));
              setShowEditModal(false);
              setSuccess('Receipt updated successfully');
              setTimeout(() => setSuccess(null), 3000);
            }}
          />
        )}
        
        {renderDetailsModal()}
        {renderExportModal()}
	{renderCreateModal()}
        {renderQRModal()}
      </ContentWrapper>
    </ReceiptsContainer>
  );
};

export default ReceiptsPage;

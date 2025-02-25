import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { useInvoices } from '../context/InvoiceContext';
import styled from 'styled-components';
import { ThemeProvider } from "styled-components";
import EditInvoiceModal from '../modals/EditInvoiceModal';
import { formatCurrency } from '../utils/dataTransformations';
import { generateInvoicePDF, markInvoiceAsPaid, fetchInvoices, exportPdf, createInvoice, updateInvoice, deleteInvoice, bulkDeleteInvoices } from '../services/api';
import { Button, Badge, Table, Form, Container, Row, Col, Spinner, Alert, Modal, ButtonGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { InvoiceQRCode, QRCodeModal } from './QRCode';


const getThemeValue = (path, fallback) => props => {
  const value = path.split('.').reduce((acc, part) => {
    if (acc && acc[part] !== undefined) return acc[part];
    return undefined;
  }, props.theme);

  return value !== undefined ? value : fallback;
};

const InvoicesContainer = styled.div`
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

const StyledTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 800px;
  background-color: ${getThemeValue('colors.background', '#ffffff')};
  
  @media (max-width: 1024px) {
    font-size: 0.875rem;
  }
`;

const Th = styled.th`
  background-color: ${getThemeValue('colors.surface', '#f7fafc')};
  color: ${getThemeValue('colors.text.secondary', '#4a5568')};
  padding: 1rem;
  font-weight: 600;
  text-align: left;
  border-bottom: 2px solid ${getThemeValue('colors.border', '#e2e8f0')};
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  position: sticky;
  top: 0;
  z-index: 1;

  &:hover {
    background-color: ${getThemeValue('colors.surface', '#f1f5f9')};
  }
`;

const Td = styled.td`
  padding: 10px;
  border: 1px solid #ddd;
  white-space: nowrap;
`;

const Filters = styled.div`
  margin-bottom: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  align-items: center;
  background-color: ${getThemeValue('colors.surface', '#f7fafc')};
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
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

const ActionButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  align-items: center;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
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
  gap: 0.25rem;
`;

const PaginationButton = styled.button`
  padding: 0.5rem 0.75rem;
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};
  border-radius: 3px;
  font-weight: 500;
  min-width: 40px;
  background-color: ${props => props.disabled ? 
    getThemeValue('colors.surface', '#f7fafc') : 
    getThemeValue('colors.background', '#ffffff')};
  color: ${props => props.disabled ? 
    getThemeValue('colors.text.secondary', '#4a5568') : 
    getThemeValue('colors.primary', '#1a365d')};
  transition: ${getThemeValue('transitions.standard', 'all 0.2s ease-in-out')};

  &:disabled {
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background-color: ${getThemeValue('colors.primary', '#1a365d')};
    color: white;
    border-color: ${getThemeValue('colors.primary', '#1a365d')};
  }
`;

const PaginationInfo = styled.div`
  margin: 0 0.75rem;
  font-size: 0.875rem;
  color: ${getThemeValue('colors.text.secondary', '#4a5568')};
`;

const AnimatedTableRow = styled.tr`
  transition: ${getThemeValue('transitions.standard', 'all 0.2s ease-in-out')};

  &:hover {
    background-color: ${getThemeValue('colors.surface', '#f7fafc')};
    transform: scale(1.002);
  }

  @media (max-width: 768px) {
    &:hover {
      transform: none;
    }
  }
`;

const InvoicesPage = () => {
  const { isAuthenticated } = useAuth();
  const { invoices, setInvoices, addInvoice, fetchInvoices } = useInvoices();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [invoicesPerPage] = useState(10);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    invoicesPerPage: 10
  });

  // Filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // Sorting state
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  // Modal state
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Selected invoices state
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);
  const [exportFormat, setExportFormat] = useState('detailed');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrInvoiceData, setQRInvoiceData] = useState(null);

  // Export format options
  const exportFormatOptions = [
    { value: 'detailed', label: 'Detailed Export' },
    { value: 'summary', label: 'Summary Export' }
  ];

  const statusOptions = ['draft', 'sent', 'paid'];

  const fetchInvoicesData = useCallback(async () => {
    if (isAuthenticated) {
      setLoading(true);
      setError(null);
      setDebugInfo(null);
      try {
        const params = {
          page: pagination.currentPage,
          page_size: pagination.invoicesPerPage,
          search: searchTerm,
          issue_date: dateFilter,
          status: statusFilter,
          min_amount: minAmount,
          max_amount: maxAmount,
          ordering: `${sortDirection === 'desc' ? '-' : ''}${sortField}`
        };

        Object.keys(params).forEach(key =>
          (params[key] === undefined || params[key] === '') && delete params[key]
        );

        console.log('Calling fetchInvoices with params:', params);
        const response = await fetchInvoices(params);
        console.log('Raw response from fetchInvoices:', response);

        if (response && response.count !== undefined) {
          console.log('Total count:', response.count);
          setPagination((prevState) => ({
            ...prevState,
            totalPages: Math.ceil(response.count / prevState.invoicesPerPage),
          }));
        } else {
          console.log('Response does not contain count');
        }

        if (response && response.results) {
          console.log('Invoices received:', response.results.length);
          setInvoices(response.results);
        } else {
          console.log('No results in response');
          setInvoices([]);
        }

	setLoading(false);
      } catch (error) {
        console.error('Error in fetchInvoicesData:', error);
        setError('Failed to fetch invoices. Please try again.');
        setDebugInfo(JSON.stringify(error, null, 2));
        setLoading(false);
      }
    }
  }, [isAuthenticated, pagination.currentPage, pagination.invoicesPerPage, searchTerm, dateFilter, statusFilter, minAmount, maxAmount, sortField, sortDirection, fetchInvoices]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchInvoicesData();
    }
  }, [isAuthenticated, fetchInvoicesData]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const handleDateFilterChange = (event) => {
    setDateFilter(event.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (event) => {
    setStatusFilter(event.target.value.toLowerCase());
    setCurrentPage(1);
  };

  const handleMinAmountChange = (event) => {
    setMinAmount(event.target.value);
    setCurrentPage(1);
  };

  const handleMaxAmountChange = (event) => {
    setMaxAmount(event.target.value);
    setCurrentPage(1);
  };

  const handleQRCodeScan = (qrData) => {
    try {
      const invoiceData = JSON.parse(qrData);
  
      setSelectedInvoice(invoiceData);
      setShowDetailsModal(true);
    } catch (error) {
      setError('Error processing QR code');
    }
  };

  const formatInvoiceNumber = (uuid) => {
    if (!uuid) return '';
    // Extract the first 4 characters of the UUID and add a prefix
    return `INV-${uuid.substr(0, 4).toUpperCase()}`;
  };

  const handleSort = (field) => {
    // Add this mapping object
    const backendFieldMap = {
      'customer_Id': 'customer__id',
      'total_amount': 'total_amount',
      'status': 'status',
      'issue_date': 'issue_date',
      'due_date': 'due_date',
    };

    // Use this line to get the correct field name
    const backendField = backendFieldMap[field] || field;

    setSortDirection(sortField === field && sortDirection === 'asc' ? 'desc' : 'asc');
    setSortField(backendField);  // Use sortField instead of field
    setCurrentPage(1);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedInvoices(invoices.map(i => i.id));
    } else {
      setSelectedInvoices([]);
    }
  };

  const handleSelectInvoice = (id) => {
    setSelectedInvoices(prevSelected =>
      prevSelected.includes(id)
        ? prevSelected.filter(i => i !== id)
        : [...prevSelected, id]
    );
  };

   const handleOpenEditModal = (invoice = null) => {
    setSelectedInvoice(invoice);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setSelectedInvoice(null);
    setShowEditModal(false);
  };

  const handleEditInvoice = async (updatedInvoice) => {
    try {
      await handleCreateOrUpdateInvoice(updatedInvoice);
      setSuccess('Invoice updated successfully.');
      setShowEditModal(false);
      fetchInvoicesData();
    } catch (error) {
      console.error('Error updating invoice:', error);
      setError('Failed to update invoice. Please try again.');
      setDebugInfo(JSON.stringify(error.response?.data || error.message, null, 2));
    }
  };

  const handleCreateOrUpdateInvoice = async (invoice) => {
    try {
      if (invoice.id) {
        await updateInvoice(invoice.id, invoice);
        setSuccess('Invoice updated successfully.');
      } else {
        await handleCreateInvoice(invoice);
      }
      setShowEditModal(false);
      fetchInvoicesData();
    } catch (error) {
      console.error('Error creating/updating invoice:', error);
      setError('Failed to create/update invoice. Please try again.');
      setDebugInfo(JSON.stringify(error.response?.data || error.message, null, 2));
    }
  };

  const handleCreateInvoice = useCallback(async (newInvoice) => {
    try {
      // Ensure all required fields are present
      const invoiceData = {
        ...newInvoice,
        user: newInvoice.user || undefined, // Remove if undefined
        customer: newInvoice.customer || undefined, // Remove if undefined
        invoice_number: newInvoice.invoice_number || undefined, // Remove if undefined
        issue_date: newInvoice.issue_date || new Date().toISOString().split('T')[0],
        due_date: newInvoice.due_date || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
        status: newInvoice.status || 'draft',
        items: newInvoice.items || []
      };

      console.log('Sending invoice data:', JSON.stringify(invoiceData, null, 2));
      const createdInvoice = await createInvoice(invoiceData);
      console.log('Created invoice:', JSON.stringify(createdInvoice, null, 2));
      setSuccess('Invoice created successfully.');
      setShowEditModal(false);
      await fetchInvoicesData(); // Make sure to await this
    } catch (error) {
      console.error('Error creating invoice:', error);
      setError('Failed to create invoice. Please try again.');
      setDebugInfo(JSON.stringify(error.response?.data || error.message, null, 2));
    }
  }, [createInvoice, fetchInvoicesData]);

  const handleDeleteInvoice = async (invoiceId) => {
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      try {
        await deleteInvoice(invoiceId);
        setSuccess('Invoice deleted successfully.');
        
        // Remove the deleted invoice from the local state
        setInvoices(prevInvoices => prevInvoices.filter(invoice => invoice.id !== invoiceId));
        
        // If the current page is now empty, go to the previous page
        if (invoices.length === 1 && currentPage > 1) {
          setCurrentPage(prev => prev - 1);
        } else {
          fetchInvoicesData();
        }
      } catch (error) {
        console.error('Error deleting invoice:', error);
        setError('Error deleting invoice. Please try again.');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedInvoices.length} invoices?`)) {
      try {
        await bulkDeleteInvoices(selectedInvoices);
        setSuccess(`${selectedInvoices.length} invoices deleted successfully.`);
        setSelectedInvoices([]);
        fetchInvoicesData();
      } catch (error) {
        setError('Error deleting invoices. Please try again.');
      }
    }
  };

  const handleGeneratePDF = async (invoiceId) => {
    try {
      console.log('Generating PDF for invoice:', invoiceId);
      const response = await generateInvoicePDF(invoiceId);
      console.log('API response:', response);
      
      if (!(response instanceof Blob)) {
        console.error('Response is not a Blob:', response);
        throw new Error('Invalid response type. Expected a Blob.');
      }
      
      const url = URL.createObjectURL(response);
      console.log('Blob URL created:', url);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice_${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      setSuccess('PDF generated successfully.');
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError(error.message || 'Failed to generate PDF. Please try again.');
      setDebugInfo(JSON.stringify(error, null, 2));
    }
  };

  const handleExportPdf = async () => {
    try {
      if (!selectedInvoices.length) {
        setError('Please select at least one invoice to export');
        return;
      }

      console.log('Selected invoices:', selectedInvoices);
    
      setLoading(true);
      setError(null);

      // Prepare export parameters based on current filters
      const exportParams = {
        invoice_ids: selectedInvoices, // Use IDs directly, no mapping needed
        format: exportFormat,
        search: searchTerm,
        issue_date: dateFilter,
        status: statusFilter,
        min_amount: minAmount,
        max_amount: maxAmount,
      };

      // Remove undefined or empty parameters
      Object.keys(exportParams).forEach(key =>
        (exportParams[key] === undefined || exportParams[key] === '') && delete exportParams[key]
      );

      console.log('Export params:', exportParams);

      // Call export PDF method from api.js
      await exportPdf(exportParams);

      setSuccess('Invoices exported successfully');
      setShowExportModal(false); // Close modal after successful export
    } catch (error) {
      console.error('Export PDF error:', error);
      setError('Failed to export invoices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Export Modal Component
  const ExportModal = () => (
    <Modal show={showExportModal} onHide={() => setShowExportModal(false)}>
      <Modal.Header closeButton>
        <Modal.Title>Export Invoices</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group controlId="exportFormatSelect">
            <Form.Label>Export Format</Form.Label>
            <Form.Control 
              as="select"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
            >
              {exportFormatOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Control>
            <Form.Text className="text-muted">
              {exportFormat === 'detailed' 
                ? 'Includes additional details like contact information and full invoice breakdown.' 
                : 'Provides a concise overview of key invoice information.'}
            </Form.Text>
          </Form.Group>

          <Form.Group className="mt-3">
            <Form.Label>Selected Invoices</Form.Label>
            <div>
              {selectedInvoices.length > 0 ? (
                <Badge bg="primary">{selectedInvoices.length} invoice(s) selected</Badge>
              ) : (
                <Badge bg="warning">No invoices selected</Badge>
              )}
            </div>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button 
          variant="secondary" 
          onClick={() => setShowExportModal(false)}
        >
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleExportPdf}
          disabled={selectedInvoices.length === 0}
        >
          Export PDF
        </Button>
      </Modal.Footer>
    </Modal>
  );

  const handleMarkAsPaid = async (invoiceId) => {
    try {
      await markInvoiceAsPaid(invoiceId);
      setSuccess('Invoice marked as paid successfully.');
      fetchInvoicesData();
    } catch (error) {
      setError('Failed to mark invoice as paid. Please try again.');
    }
  };

  const handlePageChange = (page) => {
    setPagination(prev => ({
      ...prev,
      currentPage: page
    }));
  };

  if (!isAuthenticated) {
    return <Alert variant="warning">Please log in to view invoices.</Alert>;
  }

  return (
  <InvoicesContainer>
    <ContentWrapper>
    <Heading>Invoices</Heading>

    {error && (
      <Alert variant="danger" onClose={() => setError(null)} dismissible>
        {error}
      </Alert>
    )}
    {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}

    <Filters>
      <StyledFormControl
        type="text"
        placeholder="Search invoices..."
        value={searchTerm}
        onChange={handleSearchChange}
      />
      <StyledFormControl
        type="date"
        value={dateFilter}
        onChange={handleDateFilterChange}
      />
      <StyledFormControl
        as="select"
        value={statusFilter}
        onChange={handleStatusFilterChange}
      >
        <option value="">All Statuses</option>
        {statusOptions.map(status => (
          <option key={status} value={status}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </option>
        ))}
      </StyledFormControl>
      <StyledFormControl
        type="number"
        placeholder="Min Amount"
        value={minAmount}
        onChange={handleMinAmountChange}
      />
      <StyledFormControl
        type="number"
        placeholder="Max Amount"
        value={maxAmount}
        onChange={handleMaxAmountChange}
      />
    </Filters>


    <ActionButtonContainer>
      {/* Default or primary button */}
      <ActionButton onClick={() => handleOpenEditModal()}>
        Add Invoice
      </ActionButton>
  
      {/* Delete button with "delete" variant */}
      <ActionButton
        variant="delete"
        onClick={handleBulkDelete}
        disabled={selectedInvoices.length === 0}
      >
        Delete Selected
      </ActionButton>
  
      {/* Default style for export PDF */}
      <ActionButton
	onClick={() => setShowExportModal(true)}
        disabled={selectedInvoices.length === 0}
      >
        Export PDF
      </ActionButton>
    </ActionButtonContainer>

    {loading ? (
      <Spinner animation="border" role="status" className="d-block mx-auto" />
    ) : invoices && invoices.length > 0 ? (
      <>
	<TableWrapper>
        <StyledTable responsive>
          <thead>
            <tr>
              <Th className="text-center"><Form.Check type="checkbox" onChange={handleSelectAll} /></Th>
	      <Th className="text-center">QR Code</Th>
              <Th className="text-center" onClick={() => handleSort('issue_date')}>Date {sortField === 'issue_date' && (sortDirection === 'asc' ? '▲' : '▼')}</Th>
              <Th className="text-center" onClick={() => handleSort('customer__id')}>Customer ID {sortField === 'customer__id' && (sortDirection === 'asc' ? '▲' : '▼')}</Th>
              <Th className="text-center" onClick={() => handleSort('invoice_number')}>Invoice Number {sortField === 'invoice_number' && (sortDirection === 'asc' ? '▲' : '▼')}</Th>
              <Th className="text-right" onClick={() => handleSort('total_amount')}>Amount {sortField === 'total_amount' && (sortDirection === 'asc' ? '▲' : '▼')}</Th>
              <Th className="text-center" onClick={() => handleSort('status')}>Status {sortField === 'status' && (sortDirection === 'asc' ? '▲' : '▼')}</Th>
              <Th className="text-center">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <AnimatedTableRow key={invoice.id}>
                <Td className="text-center">
                  <Form.Check
                    type="checkbox"
                    checked={selectedInvoices.includes(invoice.id)}
                    onChange={() => handleSelectInvoice(invoice.id)}
                  />
                </Td>
		<Td className="text-center">
                  <InvoiceQRCode
                    invoice={invoice}
                    size="60px"
                    onScan={handleQRCodeScan}
                  />
                </Td>
                <Td className="text-center">{invoice.issue_date || 'N/A'}</Td>
                <Td className="text-center">{invoice.customer?.id || 'N/A'}</Td>
                <Td className="text-center">{formatInvoiceNumber(invoice.invoice_number) || 'N/A'}</Td>
                <Td className="text-right">{formatCurrency(invoice.total_amount)}</Td>
                <Td className="text-center">
                  <StatusBadge status={invoice.status}>{invoice.status}</StatusBadge>
                </Td>
		<Td className="text-center">
                  {/* PDF Button - Default Style */}
                  <ActionButton onClick={() => handleGeneratePDF(invoice.id)}>
                    PDF
                  </ActionButton>

                  {/* Mark Paid Button - Default Style */}
                  {invoice.status !== 'PAID' && (
                    <ActionButton onClick={() => handleMarkAsPaid(invoice.id)}>
                      Mark Paid
                    </ActionButton>
                  )}

                    <ActionButton
                    variant="info"
                    size="sm"
                    className="me-2"
                    onClick={() => handleOpenEditModal(invoice)}
                  >
                    Edit
                  </ActionButton>
                  <ActionButton
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteInvoice(invoice.id)}
                  >
                    Delete
                  </ActionButton>
                </Td>
              </AnimatedTableRow>
            ))}
          </tbody>
        </StyledTable>
	</TableWrapper>

	<QRCodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          invoiceData={qrInvoiceData}
        />

        {pagination.totalPages > 0 && (
          <PaginationContainer>
          <Pagination>
            <PaginationButton
              onClick={() => handlePageChange(1)}
              disabled={pagination.currentPage === 1}
            >
              First
            </PaginationButton>

            <PaginationButton
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
            >
              Previous
            </PaginationButton>

            {[...Array(pagination.totalPages).keys()]
              .filter(number => {
                const page = number + 1;
                return (
                  page === 1 ||
                  page === pagination.totalPages ||
                  Math.abs(page - pagination.currentPage) <= 1
                );
              })
              .map(number => {
                const page = number + 1;
                return (
                  <React.Fragment key={page}>
                    {page > 1 &&
                     Math.abs(page - [...Array(pagination.totalPages).keys()]
                       .filter(n => {
                         const p = n + 1;
                         return (
                           p === 1 ||
                           p === pagination.totalPages ||
                           Math.abs(p - pagination.currentPage) <= 1
                         );
                       })[number - 1] - 1) > 1 && (
                      <span>...</span>
                    )}
                    <PaginationButton
                      onClick={() => handlePageChange(page)}
                      disabled={pagination.currentPage === page}
                    >
                      {page}
                    </PaginationButton>
                  </React.Fragment>
                );
              })}

            <PaginationButton
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
            >
              Next
            </PaginationButton>

            <PaginationButton
              onClick={() => handlePageChange(pagination.totalPages)}
              disabled={pagination.currentPage === pagination.totalPages}
            >
              Last
            </PaginationButton>
          </Pagination>
	  </PaginationContainer>
	)}
      </>
    ) : (
      <p>No invoices found.</p>
    )}

    <EditInvoiceModal
      isOpen={showEditModal}
      onClose={handleCloseEditModal}
      invoice={selectedInvoice}
      onSave={handleCreateOrUpdateInvoice}
    />
  </ContentWrapper>
  <ExportModal />
  </InvoicesContainer>
  );
};

export default InvoicesPage;

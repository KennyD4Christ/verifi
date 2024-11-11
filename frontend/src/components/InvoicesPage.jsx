import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { useInvoices } from '../context/InvoiceContext';
import styled from 'styled-components';
import EditInvoiceModal from '../modals/EditInvoiceModal';
import { generateInvoicePDF, markInvoiceAsPaid, fetchInvoices, createInvoice, updateInvoice, deleteInvoice, bulkDeleteInvoices } from '../services/api';
import { Button, Table, Form, Container, Row, Col, Spinner, Alert, Modal, ButtonGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const InvoicesContainer = styled(Container)`
  padding: 20px;
  height: 100%;
  min-height: calc(100vh - 60px);
  overflow-x: auto;
  overflow-y: visible;
  display: flex;
  flex-direction: column;
`;

const ContentWrapper = styled.div`
  padding: 20px;
  min-width: min(100%, 1200px); // Ensures minimum width while allowing expansion
  max-width: 100%;
`;

const Heading = styled.h1`
  font-size: 2em;
  margin-bottom: 20px;
  white-space: nowrap;
`;

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin-bottom: 20px;

  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;

    &:hover {
      background: #555;
    }
  }
`;

const StyledTable = styled.table`
  width: 100%;
  min-width: 800px;
  border-collapse: collapse;
  margin-bottom: 20px;
  background-color: #ffffff;
`;

const Th = styled.th`
  background-color: #f5f5f5;
  padding: 10px;
  border: 1px solid #ddd;
  cursor: pointer;
  white-space: nowrap;
  min-width: 100px;

  &:hover {
    background-color: #e9ecef;
  }
`;

const Td = styled.td`
  padding: 10px;
  border: 1px solid #ddd;
  white-space: nowrap;
`;

const Filters = styled.div`
  margin-bottom: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  align-items: center;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const StyledFormControl = styled(Form.Control)`
  height: 38px;
  &::placeholder {
    color: #6c757d;
  }
`;

const Pagination = styled.div`
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

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    background-color: ${props => (props.disabled ? '#f0f0f0' : '#4CAF50')};
    color: ${props => (props.disabled ? '#888' : 'white')};
    transition: all 0.3s ease;
  }

  &:hover:not(:disabled) {
    background-color: #0645AD;
  }
`;

const PaginationInfo = styled.div`
  margin: 0 15px;
  font-size: 14px;
  color: #555;
`;

const PaginationContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  padding-bottom: 10px;

  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;
  }
`;

const AddInvoiceButton = styled.button`
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 20px;

  &:hover {
    background-color: #0056b3;
  }
`;

const StatusBadge = styled.span`
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 0.8em;
  font-weight: bold;
  ${({ status }) => {
    switch (status) {
      case 'PAID':
        return 'background-color: #28a745; color: white;';
      case 'PENDING':
        return 'background-color: #ffc107; color: black;';
      case 'OVERDUE':
        return 'background-color: #dc3545; color: white;';
      default:
        return 'background-color: #6c757d; color: white;';
    }
  }}
`;

const ActionButtonContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const ActionButton = styled(Button)`
  background-color: #0645AD;
  color: white;
  border: none;
  padding: 10px 20px;
  font-weight: bold;
  transition: all 0.3s ease;

  &:hover {
    background-color: #f5f5f5;
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
      <ActionButton onClick={() => handleOpenEditModal()}>Add Invoice</ActionButton>
      <ActionButton onClick={handleBulkDelete} disabled={selectedInvoices.length === 0}>Delete Selected</ActionButton>
      <ActionButton as={Link} to="/invoices/export/pdf">Export PDF</ActionButton>
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
                <Td className="text-center">{invoice.issue_date || 'N/A'}</Td>
                <Td className="text-center">{invoice.customer?.id || 'N/A'}</Td>
                <Td className="text-center">{formatInvoiceNumber(invoice.invoice_number) || 'N/A'}</Td>
                <Td className="text-right">${invoice.total_amount ? parseFloat(invoice.total_amount).toFixed(2) : '0.00'}</Td>
                <Td className="text-center">
                  <StatusBadge status={invoice.status}>{invoice.status}</StatusBadge>
                </Td>
                <Td className="text-center">
                  <ActionButton primary onClick={() => handleGeneratePDF(invoice.id)}>
                    PDF
                  </ActionButton>
                  {invoice.status !== 'PAID' && (
                    <ActionButton onClick={() => handleMarkAsPaid(invoice.id)}>
                      Mark Paid
                    </ActionButton>
                  )}
                  <ActionButton onClick={() => handleOpenEditModal(invoice)}>
                    Edit
                  </ActionButton>
                  <ActionButton onClick={() => handleDeleteInvoice(invoice.id)}>
                    Delete
                  </ActionButton>
                </Td>
              </AnimatedTableRow>
            ))}
          </tbody>
        </StyledTable>
	</TableWrapper>

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
  </InvoicesContainer>
  );
};

export default InvoicesPage;

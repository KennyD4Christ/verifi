import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { useInvoices } from '../context/InvoiceContext';
import styled from 'styled-components';
import EditInvoiceModal from '../modals/EditInvoiceModal';
import { generateInvoicePDF, markInvoiceAsPaid, fetchInvoices, createInvoice, updateInvoice, deleteInvoice, bulkDeleteInvoices } from '../services/api';
import { Button, Form, Alert, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const InvoicesContainer = styled.div`
  padding: 20px;
`;

const Heading = styled.h1`
  font-size: 2em;
  margin-bottom: 20px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
`;

const Th = styled.th`
  background-color: #f5f5f5;
  padding: 10px;
  border: 1px solid #ddd;
`;

const Td = styled.td`
  padding: 10px;
  border: 1px solid #ddd;
`;

const Filters = styled.div`
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
`;

const FilterInput = styled.input`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 20px;
`;

const PaginationButton = styled.button`
  background-color: #ffffff;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin: 0 5px;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
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

const ActionButton = styled.button`
  padding: 5px 10px;
  margin: 0 5px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8em;
  ${({ primary }) => primary ? 'background-color: #007bff; color: white;' : 'background-color: #6c757d; color: white;'}
  &:hover {
    opacity: 0.8;
  }
`;

const ActionButtonContainer = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
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
          page: currentPage,
          page_size: invoicesPerPage,
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
          setTotalPages(Math.ceil(response.count / invoicesPerPage));
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
  }, [isAuthenticated, currentPage, invoicesPerPage, searchTerm, dateFilter, statusFilter, minAmount, maxAmount, sortField, sortDirection, fetchInvoices]);

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

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (!isAuthenticated) {
    return <Alert variant="warning">Please log in to view invoices.</Alert>;
  }

  return (
  <InvoicesContainer>
    <Heading>Invoices</Heading>

    {error && (
      <Alert variant="danger" onClose={() => setError(null)} dismissible>
        {error}
        {debugInfo && (
          <details>
            <summary>Debug Information</summary>
            <pre>{debugInfo}</pre>
          </details>
        )}
      </Alert>
    )}
    {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}

    <Filters>
      <Form.Control
        type="text"
        placeholder="Search invoices..."
        value={searchTerm}
        onChange={handleSearchChange}
      />
      <Form.Control
        type="date"
        value={dateFilter}
        onChange={handleDateFilterChange}
      />
      <Form.Control
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
      </Form.Control>
      <Form.Control
        type="number"
        placeholder="Min Amount"
        value={minAmount}
        onChange={handleMinAmountChange}
      />
      <Form.Control
        type="number"
        placeholder="Max Amount"
        value={maxAmount}
        onChange={handleMaxAmountChange}
      />
    </Filters>

    <ActionButtonContainer>
      <Button onClick={() => handleOpenEditModal()}>Add Invoice</Button>
      <Button onClick={handleBulkDelete} disabled={selectedInvoices.length === 0}>Delete Selected</Button>
      <Button as={Link} to="/invoices/export/pdf">Export PDF</Button>
    </ActionButtonContainer>

    {loading ? (
      <Spinner animation="border" role="status" className="d-block mx-auto" />
    ) : invoices && invoices.length > 0 ? (
      <>
        <Table responsive>
          <thead>
            <tr>
              <th className="text-center"><Form.Check type="checkbox" onChange={handleSelectAll} /></th>
              <th className="text-center" onClick={() => handleSort('issue_date')}>Date {sortField === 'issue_date' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
              <th className="text-center" onClick={() => handleSort('customer__id')}>Customer ID {sortField === 'customer__id' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
              <th className="text-center" onClick={() => handleSort('invoice_number')}>Invoice Number {sortField === 'invoice_number' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
              <th className="text-right" onClick={() => handleSort('total_amount')}>Amount {sortField === 'total_amount' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
              <th className="text-center" onClick={() => handleSort('status')}>Status {sortField === 'status' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="text-center">
                  <Form.Check
                    type="checkbox"
                    checked={selectedInvoices.includes(invoice.id)}
                    onChange={() => handleSelectInvoice(invoice.id)}
                  />
                </td>
                <td className="text-center">{invoice.issue_date || 'N/A'}</td>
                <td className="text-center">{invoice.customer?.id || 'N/A'}</td>
                <td className="text-center">{formatInvoiceNumber(invoice.invoice_number) || 'N/A'}</td>
                <td className="text-right">${invoice.total_amount ? parseFloat(invoice.total_amount).toFixed(2) : '0.00'}</td>
                <td className="text-center">
                  <StatusBadge status={invoice.status}>{invoice.status}</StatusBadge>
                </td>
                <td className="text-center">
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
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        <Pagination>
          {Array.from({ length: totalPages }, (_, index) => (
            <PaginationButton
              key={index + 1}
              onClick={() => paginate(index + 1)}
              disabled={currentPage === index + 1}
            >
              {index + 1}
            </PaginationButton>
          ))}
        </Pagination>
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

  </InvoicesContainer>
  );
};

export default InvoicesPage;

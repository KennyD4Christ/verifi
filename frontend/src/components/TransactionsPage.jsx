import React, { useState, useEffect, useContext, useCallback } from 'react';
import styled from 'styled-components';
import { Button, Table, Form, Container, Row, Col, Spinner, Alert, Modal, ButtonGroup } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { TransactionContext } from '../context/TransactionContext';
import { CSVLink } from 'react-csv';
import { debounce } from 'lodash';
import AddTransactionModal from '../modals/AddTransactionModal';
import EditTransactionModal from '../modals/EditTransactionModal';
import { deleteTransaction } from '../services/api';


const TransactionsContainer = styled(Container)`
  padding: 20px;
  height: 100%;
  min-height: calc(100vh - 60px);
  overflow-y: visible;
  display: flex;
  flex-direction: column;
`;

const TransactionsContent = styled.div`
  flex-grow: 1;
  overflow-x: auto;
`;

const Heading = styled.h1`
  font-size: 2em;
  margin-bottom: 20px;
`;

const StyledTable = styled.table`
  width: max-content;
  border-collapse: collapse;
  margin-bottom: 20px;
  background-color: #ffffff;
`;

const Filters = styled(Form)`
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

const Th = styled.th`
  background-color: #f5f5f5;
  padding: 10px;
  border: 1px solid #ddd;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 10px;
  border: 1px solid #ddd;
  white-space: nowrap;
`;

const FilterInput = styled.input`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-right: 10px;
`;

const FilterSelect = styled.select`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-right: 10px;
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

const ExportButton = styled.button`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 10px;
  background-color: #f0f0f0;
`;

const BulkUpdateButton = styled.button`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 10px;
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

const TransactionsPage = () => {
  const { fetchTransactions, bulkDelete, addTransaction, exportCsv,
  exportPdf } = useContext(TransactionContext);
  const { isAuthenticated, isInitialized, authChecked, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [transactionsPerPage] = useState(10);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState(null);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    count: 0,
    totalPages: 0,
    currentPage: 1,
  });

  const debouncedFetch = useCallback(
    debounce((filters) => {
      fetchTransactionsData(1, transactionsPerPage, '-date,-id', filters);
    }, 300),
    []
  );

  const handleEditTransaction = (transaction) => {
    setCurrentTransaction(transaction);
    setShowEditModal(true);
  };

  const handleDeleteTransaction = async (id) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await deleteTransaction(id);
        await fetchTransactions();
        setSelectedTransactions([]);
      } catch (error) {
        console.error('Error deleting transaction:', error);
      }
    }
  };

  const fetchTransactionsData = useCallback(async (
    page = 1,
    pageSize = transactionsPerPage,
    ordering = '-date,-id',
    filters = {}
  ) => {
    if (!authChecked || !isInitialized || !isAuthenticated()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Construct filter parameters
      const params = {
        page,
        page_size: pageSize,
        ordering,
        ...filters
      };

      // Only add filters if they have values
      if (filters.search?.trim()) params.search = filters.search.trim();
      if (filters.status) params.status = filters.status;
      if (filters.transaction_type) params.transaction_type = filters.transaction_type;
      if (filters.date) params.date = filters.date;
      if (filters.category) params.category = filters.category;

      const response = await fetchTransactions(params);

      if (response?.results) {
        setTransactions(response.results);
        setFilteredTransactions(response.results);
        setPagination({
          count: response.count,
          totalPages: Math.ceil(response.count / pageSize),
          currentPage: page,
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('An error occurred while fetching transactions.');
      setTransactions([]);
      setFilteredTransactions([]);
      setPagination({ count: 0, totalPages: 0, currentPage: 1 });
    } finally {
      setLoading(false);
    }
  }, [authChecked, isInitialized, isAuthenticated, transactionsPerPage]);

  const handleTableChange = (newPagination, filters, sorter) => {
    const sortField = sorter.field || 'date';
    const sortOrder = sorter.order ? (sorter.order === 'ascend' ? '' : '-') : '-';
    const ordering = `${sortOrder}${sortField}`;

    // Collect current filters
    const currentFilters = {
      search: searchTerm,
      status: statusFilter,
      transaction_type: transactionTypeFilter,
      date: dateFilter,
      category: categoryFilter,
    };

    fetchTransactionsData(
      newPagination.current,
      newPagination.pageSize,
      ordering,
      currentFilters
    );
  };

  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirstTransaction, indexOfLastTransaction);

  if (!authChecked || !isInitialized) {
    return <div>Initializing...</div>;
  }

  if (!isAuthenticated()) {
    return <div>Please log in to view transactions.</div>;
  }

  // Filter change handlers
  const handleFilterChange = (filterType, value) => {
    // Update the corresponding filter state
    switch (filterType) {
      case 'search':
        setSearchTerm(value);
        break;
      case 'status':
        setStatusFilter(value);
        break;
      case 'transaction_type':
        setTransactionTypeFilter(value);
        break;
      case 'date':
        setDateFilter(value);
        break;
      case 'category':
        setCategoryFilter(value);
        break;
      default:
        break;
    }

    // Collect all current filter values
    const filters = {
      search: filterType === 'search' ? value : searchTerm,
      status: filterType === 'status' ? value : statusFilter,
      transaction_type: filterType === 'transaction_type' ? value : transactionTypeFilter,
      date: filterType === 'date' ? value : dateFilter,
      category: filterType === 'category' ? value : categoryFilter,
    };

    // Reset to first page when filters change
    fetchTransactionsData(1, transactionsPerPage, '-date,-id', filters);
  };

  // Component mounting effect
  useEffect(() => {
    const initialFilters = {
      search: searchTerm,
      status: statusFilter,
      transaction_type: transactionTypeFilter,
      date: dateFilter,
      category: categoryFilter,
    };
    fetchTransactionsData(1, transactionsPerPage, '-date,-id', initialFilters);
  }, []);

  const handlePageChange = (newPage) => {
    // Collect current filters
    const currentFilters = {
      search: searchTerm,
      status: statusFilter,
      transaction_type: transactionTypeFilter,
      date: dateFilter,
      category: categoryFilter,
    };

    // Fetch data with new page number but maintain current filters
    fetchTransactionsData(newPage, transactionsPerPage, '-date,-id', currentFilters);
  };

  const handleCheckboxChange = (transactionId) => {
    setSelectedTransactions(prevState => {
      const newState = prevState.includes(transactionId)
        ? prevState.filter(id => id !== transactionId)
        : [...prevState, transactionId];
      return newState;
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      // Select all transactions
      const allTransactionIds = filteredTransactions.map((transaction) => transaction.id);
      setSelectedTransactions(allTransactionIds);
    } else {
      // Deselect all transactions
      setSelectedTransactions([]);
    }
  };

  const determineNewStatus = (currentStatus) => {
    return currentStatus === 'pending' ? 'completed' : 'pending';
  };

  const handleBulkUpdate = async () => {
    try {
      const updatedTransactions = selectedTransactions.map(id => {
        const transaction = transactions.find(t => t.id === id);
        return {
          id,
          status: transaction ? determineNewStatus(transaction.status) : 'pending',
        };
      });
      await bulkUpdateTransactions(updatedTransactions);
      setSelectedTransactions([]);
      fetchTransactions();
    } catch (error) {
      console.error('Error updating transactions:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedTransactions.length} transactions?`)) {
      try {
        await bulkDelete(selectedTransactions);
        setSelectedTransactions([]);
        await fetchTransactions();
      } catch (error) {
        console.error('Error deleting transactions:', error);
        setError('Failed to delete transactions. Please try again.');
      }
    }
  };

  const handleAddTransaction = async (transactionData) => {
    try {
      await addTransaction(transactionData);
      await fetchTransactions();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  };

  const handleExportCsv = async () => {
    try {
      await exportCsv();
    } catch (error) {
      console.error('Error exporting CSV:', error);
      setError('Failed to export CSV. Please try again.');
    }
  };

  const handleExportPdf = async () => {
    try {
      await exportPdf();
    } catch (error) {
      console.error('Error exporting PDF:', error);
      setError('Failed to export PDF. Please try again.');
    }
  };

  console.log('All Transactions:', transactions);
  console.log('Current Transactions:', currentTransactions);

  return (
  <TransactionsContainer>
    <Heading>Transactions</Heading>

    <Filters>
      <StyledFormControl
        type="text"
        placeholder="Search transactions..."
        value={searchTerm}
        onChange={(e) => handleFilterChange('search', e.target.value)}
      />
      <StyledFormControl
        as="select"
        value={statusFilter}
        onChange={(e) => handleFilterChange('status', e.target.value)}
      >
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="completed">Completed</option>
        <option value="refunded">Refunded</option>
        <option value="cancelled">Cancelled</option>
      </StyledFormControl>
      <StyledFormControl
        as="select"
        value={transactionTypeFilter}
        onChange={(e) => handleFilterChange('transaction_type', e.target.value)}
      >
        <option value="">All Types</option>
        <option value="income">Income</option>
        <option value="expense">Expense</option>
        <option value="cost_of_services">Cost of Services</option>
      </StyledFormControl>
      <StyledFormControl
        type="date"
        value={dateFilter}
        onChange={(e) => handleFilterChange('date', e.target.value)}
      />
      <StyledFormControl
        as="select"
        value={categoryFilter}
        onChange={(e) => handleFilterChange('category', e.target.value)}
      >
        <option value="">All Categories</option>
        <option value="salary">Salary</option>
        <option value="marketing_expenses">Marketing Expenses</option>
        <option value="office_supplies">Office Supplies</option>
        <option value="utilities">Utilities</option>
        <option value="cost_of_services">Cost of Services</option>
        <option value="other">Other</option>
      </StyledFormControl>
    </Filters>
    <ActionButtonContainer>
      <ActionButton onClick={() => setShowCreateModal(true)}>
        Create New Transaction
      </ActionButton>
      <ActionButton
        onClick={() => setShowEditModal(true)}
        disabled={selectedTransactions.length !== 1}
      >
        Update Transaction
      </ActionButton>
      <ActionButton
        onClick={handleBulkDelete}
        disabled={selectedTransactions.length === 0}
      >
        Delete Transactions
      </ActionButton>
      <ActionButton onClick={handleExportCsv}>
        Export CSV
      </ActionButton>
      <ActionButton onClick={handleExportPdf}>
        Export PDF
      </ActionButton>
    </ActionButtonContainer>

    {loading ? (
      <Spinner animation="border" role="status" className="d-block mx-auto" />
    ) : (
      <StyledTable striped bordered hover>
        <thead>
          <tr>
            <Th>
	      <Form.Check 
                type="checkbox" 
                onChange={handleSelectAll}
                checked={selectedTransactions.length === filteredTransactions.length}
              />
            </Th>
            <Th>Date</Th>
            <Th>Description</Th>
            <Th>Amount</Th>
            <Th>Transaction Type</Th>
            <Th>Status</Th>
            <Th>Category</Th>
            <Th>Customer</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map(transaction => (
              <AnimatedTableRow key={transaction.id}>
                <Td>
                  <Form.Check
                    type="checkbox"
                    checked={selectedTransactions.includes(transaction.id)}
                    onChange={() => handleCheckboxChange(transaction.id)}
                  />
                </Td>
                <Td>{transaction.date || 'N/A'}</Td>
                <Td>{transaction.description || 'N/A'}</Td>
                <Td>{transaction.amount || 'N/A'}</Td>
                <Td>{transaction.transaction_type || 'N/A'}</Td>
                <Td>{transaction.status || 'N/A'}</Td>
                <Td>{transaction.category || 'N/A'}</Td>
                <Td>{transaction.customer || 'N/A'}</Td>
                <Td>
                  <Button 
                    variant="info" 
                    size="sm" 
                    className="me-2"
                    onClick={() => handleEditTransaction(transaction)}
                  >
                    Edit
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm"
                    onClick={() => handleDeleteTransaction(transaction.id)}
                  >
                    Delete
                  </Button>
                </Td>
              </AnimatedTableRow>
            ))
          ) : (
            <tr>
              <Td colSpan="9" className="text-center">
                No transactions found for the current filters.
              </Td>
            </tr>
          )}
        </tbody>
      </StyledTable>
    )}

    {pagination.totalPages > 1 && (
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
            // Show current page, first page, last page, and one page before and after current
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
    )}

    {error && <div>Error: {error}</div>}


    {showCreateModal && (
      <AddTransactionModal
        show={showCreateModal}
        handleClose={() => setShowCreateModal(false)}
        handleAddTransaction={handleAddTransaction}
      />
    )}

    {showEditModal && (
      <EditTransactionModal
        show={showEditModal}
        handleClose={() => setShowEditModal(false)}
        refreshTransactions={fetchTransactions}
        transaction={currentTransaction}
      />
    )}
  </TransactionsContainer>
);
};

export default TransactionsPage;

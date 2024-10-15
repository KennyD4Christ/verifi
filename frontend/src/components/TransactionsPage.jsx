import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import { Button, Modal, ButtonGroup, Form } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { TransactionContext } from '../context/TransactionContext';
import { CSVLink } from 'react-csv';
import AddTransactionModal from '../modals/AddTransactionModal';
import EditTransactionModal from '../modals/EditTransactionModal';
import { deleteTransaction } from '../services/api';

const TransactionsContainer = styled.div`
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
  flex-wrap: wrap;
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
    background-color: #45a049;
  }
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

const ActionButton = styled.button`
  padding: 5px 10px;
  margin: 0 5px;
  cursor: pointer;
`;

const TransactionsPage = () => {
  const { transactions, pagination, fetchTransactions, bulkDelete, addTransaction, loading, error, setError, exportCsv,
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

  useEffect(() => {
    if (authChecked && isInitialized && isAuthenticated()) {
      fetchTransactions({
        page: currentPage,
        page_size: transactionsPerPage,
        search: searchTerm,
        status: statusFilter,
        transaction_type: transactionTypeFilter,
        date: dateFilter,
        category: categoryFilter,
      }).catch(error => {
        console.error('Error fetching transactions:', error);
        setError('Failed to fetch transactions. Please check your filters and try again.');
      });
    }
  }, [authChecked, isInitialized, isAuthenticated, fetchTransactions, currentPage, searchTerm, statusFilter, transactionTypeFilter, dateFilter, categoryFilter]);

  useEffect(() => {
    if (transactions) {
      const filtered = transactions.filter(transaction => {
        return (
          (searchTerm === '' ||
           (transaction.amount && transaction.amount.toString().includes(searchTerm)) ||
           (transaction.customer && transaction.customer.toString().includes(searchTerm)) ||
	   (transaction.order && transaction.order.toString().includes(searchTerm)) ||
           (transaction.invoice && transaction.invoice.toString().includes(searchTerm))
          ) &&
          (statusFilter === '' || transaction.status === statusFilter) &&
          (transactionTypeFilter === '' || transaction.transaction_type === transactionTypeFilter) &&
          (dateFilter === '' || transaction.date === dateFilter) &&
          (categoryFilter === '' || transaction.category === categoryFilter)
        );
      });
      setFilteredTransactions(filtered);
    }
  }, [transactions, searchTerm, statusFilter, transactionTypeFilter, dateFilter, categoryFilter]);


  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirstTransaction, indexOfLastTransaction);

  console.log('Transactions:', transactions);
  console.log('Loading:', loading);
  console.log('Error:', error);

  if (!authChecked || !isInitialized) {
    return <div>Initializing...</div>;
  }

  if (!isAuthenticated()) {
    return <div>Please log in to view transactions.</div>;
  }

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    fetchTransactions({
      page: pageNumber,
      page_size: transactionsPerPage,
      search: searchTerm,
      status: statusFilter,
      transaction_type: transactionTypeFilter,
      date: dateFilter,
      category: categoryFilter,
    });
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleStatusFilterChange = (event) => {
    setStatusFilter(event.target.value);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleTransactionTypeFilterChange = (event) => {
    setTransactionTypeFilter(event.target.value);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleDateFilterChange = (event) => {
    setDateFilter(event.target.value);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleCategoryFilterChange = (event) => {
    setCategoryFilter(event.target.value);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleCheckboxChange = (transactionId) => {
    setSelectedTransactions(prevState => {
      const newState = prevState.includes(transactionId)
        ? prevState.filter(id => id !== transactionId)
        : [...prevState, transactionId];
      return newState;
    });
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
      <FilterInput
        type="text"
        placeholder="Search transactions..."
        value={searchTerm}
        onChange={handleSearchChange}
      />
      <FilterSelect value={statusFilter} onChange={handleStatusFilterChange}>
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="completed">Completed</option>
        <option value="refunded">Refunded</option>
        <option value="cancelled">Cancelled</option>
      </FilterSelect>
      <FilterSelect value={transactionTypeFilter} onChange={handleTransactionTypeFilterChange}>
        <option value="">All Types</option>
        <option value="income">Income</option>
        <option value="expense">Expense</option>
	<option value="cost_of_services">Cost of Services</option>
      </FilterSelect>
      <FilterInput
        type="date"
        value={dateFilter}
        onChange={handleDateFilterChange}
      />
      <FilterSelect value={categoryFilter} onChange={handleCategoryFilterChange}>
        <option value="">All Categories</option>
        <option value="salary">Salary</option>
        <option value="marketing_expenses">Marketing Expenses</option>
        <option value="office_supplies">Office Supplies</option>
        <option value="utilities">Utilities</option>
	<option value="cost_of_services">Cost of Services</option>
        <option value="other">Other</option>
      </FilterSelect>
      <Button variant="primary" onClick={() => setShowCreateModal(true)}>
        Create New Transaction
      </Button>
    </Filters>

    <ButtonGroup>
      <Button
        variant="warning"
        onClick={() => setShowEditModal(true)}
        disabled={selectedTransactions.length !== 1}
      >
        Update Transaction
      </Button>
      <Button
        variant="danger"
        onClick={handleBulkDelete}
        disabled={selectedTransactions.length === 0}
      >
        Delete Transactions
      </Button>
      <Button
        variant="secondary"
        onClick={handleExportCsv}
      >
        Export CSV
      </Button>
      <Button
        variant="secondary"
        onClick={handleExportPdf}
      >
        Export PDF
      </Button>
    </ButtonGroup>

    {loading ? (
      <div>Loading transactions...</div>
    ) : error ? (
      <div>Error: {error}</div>
    ) : (
      <>

        <StyledTable>
          <thead>
            <tr>
              <Th>Select</Th>
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
	    {loading ? (
              <tr>
                <td colSpan="9">Loading transactions...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="9">Error: {error}</td>
              </tr>
            ) : currentTransactions.length > 0 ? (
              currentTransactions.map(transaction => (
                <tr key={transaction.id}>
                  <Td>
                    <input
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
                    <ActionButton onClick={() => handleEditTransaction(transaction)}>Edit</ActionButton>
                    <ActionButton onClick={() => handleDeleteTransaction(transaction.id)}>Delete</ActionButton>
                  </Td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9">No transactions found for the current filters.</td>
              </tr>
            )}
          </tbody>
        </StyledTable>

        {filteredTransactions.length > 0 && (
          <Pagination>
            {Array.from({ length: Math.ceil(filteredTransactions.length / transactionsPerPage) }, (_, index) => (
              <PaginationButton
                key={index + 1}
                onClick={() => paginate(index + 1)}
                disabled={currentPage === index + 1}
              >
                {index + 1}
              </PaginationButton>
            ))}
          </Pagination>
        )}
      </>
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

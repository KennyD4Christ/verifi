import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { fetchTransactions as fetchTransactionsAPI, createTransaction, updateTransaction, deleteTransaction, bulkUpdateTransactions, bulkDeleteTransactions,  exportTransactionsToCSV, exportTransactionsToPDF } from '../services/api';
import { useAuth } from './AuthContext';

export const TransactionContext = createContext();

const TransactionProvider = ({ children }) => {
  const { isAuthenticated, user, isInitialized, authChecked } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({
    count: 0,
    next: null,
    previous: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTimestamp, setRefreshTimestamp] = useState(Date.now());

  useEffect(() => {
    const loadTransactions = async () => {
      if (!authChecked) {
        console.log('Waiting for auth check to complete');
        return;
      }
      if (!isAuthenticated() || !user) {
        setLoading(false);
        setTransactions([]);
        return;
      }
      setLoading(true);
      try {
        console.log('Fetching transactions...');
        const data = await fetchTransactionsAPI();
        console.log('Transactions fetched:', data);
        if (data.results && Array.isArray(data.results)) {
          setTransactions(data.results);
          console.log('Number of transactions set:', data.results.length);
        } else {
          console.log('Unexpected data structure:', data);
          setTransactions([]);
        }
        setPagination({
          count: data.count,
          next: data.next,
          previous: data.previous,
        });
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
        setError('Failed to fetch transactions. Please try again.');
        setTransactions([]);
        setPagination({
          count: 0,
          next: null,
          previous: null,
        });
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [isAuthenticated, user, isInitialized, authChecked, refreshTimestamp]);

  const addTransaction = async (transaction) => {
    try {
      const newTransaction = await createTransaction(transaction);
      setRefreshTimestamp(Date.now());
      return newTransaction; // Return the new transaction for success message
    } catch (error) {
      console.error('Failed to add transaction:', error);
      throw new Error('Failed to add transaction');
    }
  };

  const editTransaction = async (id, transaction) => {
    try {
      const updatedTransaction = await updateTransaction(id, transaction);
      setTransactions((prevTransactions) =>
        prevTransactions.map((t) => (t.id === id ? updatedTransaction : t))
      );
      console.log('Updated transaction:', updatedTransaction);
      console.log('Updated transactions state:', transactions);
    } catch (error) {
      throw new Error('Failed to update transaction');
    }
  };

  const removeTransaction = async (id) => {
    try {
      await deleteTransaction(id);
      setTransactions((prevTransactions) => prevTransactions.filter((t) => t.id !== id));
      console.log('Removed transaction with id:', id);
      console.log('Updated transactions state:', transactions);
    } catch (error) {
      console.error('Failed to delete transaction', error);
      throw new Error('Failed to delete transaction');
    }
  };

  const bulkDelete = async (ids) => {
    try {
      await bulkDeleteTransactions(ids);
      setRefreshTimestamp(Date.now());
    } catch (error) {
      console.error('Failed to bulk delete transactions:', error);
      throw error;
    }
  };

  const fetchTransactions = useCallback(async (params = {}) => {
    console.log('fetchTransactions called with params:', params);
  
    if (!authChecked || !isInitialized) {
      console.log('Authentication check not complete, deferring transaction fetch');
      return Promise.resolve(null);
    }

    if (!isAuthenticated()) {
      console.log('Not authenticated in fetchTransactions');
      setTransactions([]);
      setPagination({
        count: 0,
        next: null,
        previous: null,
      });
      return Promise.resolve(null);
    }
  
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching transactions...');
      const response = await fetchTransactionsAPI(params);
      console.log('Transactions fetched:', response);
      
      const newTransactions = response.results || [];
      const newPagination = {
        count: response.count,
        next: response.next,
        previous: response.previous,
      };
      setTransactions(newTransactions);
      setPagination(newPagination);
      if (response.error) {
        setError(response.error);
      }
      console.log('Updated transactions:', newTransactions);
      console.log('Updated pagination:', newPagination);
      return { results: newTransactions, ...newPagination };
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      setError('Failed to fetch transactions. Please try again.');
      setTransactions([]);
      setPagination({
        count: 0,
        next: null,
        previous: null,
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, authChecked, isInitialized]);


  const bulkUpdate = async (updatedTransactions) => {
    try {
      await bulkUpdateTransactions(updatedTransactions);
      await fetchTransactions();
    } catch (error) {
      console.error('Failed to bulk update transactions:', error);
      throw error;
    }
  };

  const exportCsv = async () => {
    try {
      const csvData = await exportTransactionsToCSV();
      // Handle CSV data (e.g., trigger download)
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transactions.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export CSV:', error);
    }
  };

  const exportPdf = async () => {
    try {
      const pdfData = await exportTransactionsToPDF();
      // Handle PDF data (e.g., trigger download)
      const blob = new Blob([pdfData], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transactions.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  return (
    <TransactionContext.Provider value={{
      transactions,
      pagination,
      loading,
      fetchTransactions,
      addTransaction,
      editTransaction,
      removeTransaction,
      bulkUpdate,
      bulkDelete,
      exportCsv,
      exportPdf,
      error,
      setError,
    }}>
      {children}
    </TransactionContext.Provider>
  );
};

export default TransactionProvider;

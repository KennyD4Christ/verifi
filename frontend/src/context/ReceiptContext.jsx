import React, { createContext, useState, useContext, useCallback } from 'react';
import { fetchReceipts as apiFetchReceipts } from '../services/api';

const ReceiptContext = createContext();

export const useReceipts = () => useContext(ReceiptContext);

export const ReceiptProvider = ({ children }) => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReceipts = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetchReceipts(params);
      setReceipts(data.results || []);
      setLoading(false);
      return data;
    } catch (err) {
      setError('Failed to fetch receipts');
      setLoading(false);
      throw err;
    }
  }, []);

  const addReceipt = useCallback((receipt) => {
    setReceipts(prev => [...prev, receipt]);
  }, []);

  const updateReceipt = useCallback((updatedReceipt) => {
    setReceipts(prev => 
      prev.map(receipt => 
        receipt.id === updatedReceipt.id ? updatedReceipt : receipt
      )
    );
  }, []);

  const deleteReceipt = useCallback((receiptId) => {
    setReceipts(prev => prev.filter(receipt => receipt.id !== receiptId));
  }, []);

  const value = {
    receipts,
    setReceipts,
    loading,
    error,
    fetchReceipts,
    addReceipt,
    updateReceipt,
    deleteReceipt
  };

  return (
    <ReceiptContext.Provider value={value}>
      {children}
    </ReceiptContext.Provider>
  );
};

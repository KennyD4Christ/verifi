import React, { createContext, useState, useContext, useCallback } from 'react';
import { fetchInvoices as apiFetchInvoices, createInvoice } from '../services/api';
import { useAuth } from './AuthContext';

export const InvoiceContext = createContext();

const InvoiceProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInvoices = useCallback(async (params) => {
    if (!isAuthenticated) {
      setLoading(false);
      setError('User not authenticated');
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetchInvoices(params);
      console.log('Fetched invoices:', data);
      if (data && Array.isArray(data.results)) {
        setInvoices(data.results);
        setError(null);
        return data; // Return the full data object including count, next, previous
      } else {
        throw new Error('Invalid data structure received from API');
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      setError(error.message || 'Failed to fetch invoices');
      setInvoices([]);
      throw error; // Re-throw the error so it can be caught in the component
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const addInvoice = useCallback(async (invoice) => {
    try {
      const newInvoice = await createInvoice(invoice);
      setInvoices((prevInvoices) => [...prevInvoices, newInvoice]);
      return newInvoice;
    } catch (error) {
      console.error('Failed to create invoice:', error);
      throw new Error('Failed to create invoice');
    }
  }, []);

  return (
    <InvoiceContext.Provider value={{ invoices, loading, error, addInvoice, fetchInvoices, setInvoices }}>
      {children}
    </InvoiceContext.Provider>
  );
};

export const useInvoices = () => useContext(InvoiceContext);
export default InvoiceProvider;

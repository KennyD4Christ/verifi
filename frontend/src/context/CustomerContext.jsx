import React, { createContext, useState, useEffect, useContext } from 'react';
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer } from '../services/api';
import { useAuth } from './AuthContext';

export const CustomerContext = createContext();

const CustomerProvider = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCustomers = async () => {
      if (!isAuthenticated()) {
	setLoading(false);
	return;
      }

      try {
	const data = await fetchCustomers();
	setCustomers(data);
      } catch (error) {
	console.error('Failed to fetch customers:', error);
      } finally {
	setLoading(false);
      }
    };

    loadCustomers();
  }, [isAuthenticated]);

  const addCustomer = async (customer) => {
    try {
      const newCustomer = await createCustomer(customer);
      setCustomers((prevCustomers) => [...prevCustomers, newCustomer]);
    } catch (error) {
      throw new Error('Failed to create customer');
    }
  };

  const editCustomer = async (id, customer) => {
    try {
      const updatedCustomer = await updateCustomer(id, customer);
      setCustomers((prevCustomers) =>
	prevCustomers.map((c) => (c.id === id ? updatedCustomer : c))
      );
    } catch (error) {
      throw new Error('Failed to update customer');
    }
  };

  const removeCustomer = async (id) => {
    try {
      await deleteCustomer(id);
      setCustomers((prevCustomers) => prevCustomers.filter((c) => c.id !== id));
    } catch (error) {
      throw new Error('Failed to delete customer');
    }
  };

  return (
    <CustomerContext.Provider value={{ customers, loading, addCustomer, editCustomer, removeCustomer }}>
      {children}
    </CustomerContext.Provider>
  );
};

export default CustomerProvider;

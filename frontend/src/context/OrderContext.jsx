import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { fetchOrders, createOrder, deleteOrder, applyPromotionToOrder, reorderExistingOrder } from '../services/api';
import { useAuth } from './AuthContext';

const OrderContext = createContext();

export const OrderProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrdersData = useCallback(async (params = {}) => {
    if (!isAuthenticated()) {
      console.log('User not authenticated, skipping order fetch');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching orders with params:', params);
      const data = await fetchOrders({ ...params, include_items: true });
      console.log('Raw data received from fetchOrders:', data);

      if (Array.isArray(data)) {
        console.log('Setting orders (array):', data);
        setOrders(data);
        setTotalOrders(data.length);
      } else if (data && typeof data === 'object') {
        console.log('Setting orders (object):', data.results);
        console.log('Total orders count:', data.count);
        setOrders(data.results || []);
        setTotalOrders(data.count || 0);
      } else {
        console.warn('Unexpected data structure received:', data);
        setOrders([]);
        setTotalOrders(0);
      }
    } catch (error) {
      console.error('Error in fetchOrdersData:', error);
      setError(error.message || 'An error occurred while fetching orders.');
      setOrders([]);
      setTotalOrders(0);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    console.log('OrderContext useEffect triggered');
    fetchOrdersData();
  }, [fetchOrdersData]);

  const addOrder = async (orderData) => {
    try {
      console.log('Adding new order with data:', orderData);
      const newOrder = await createOrder(orderData);
      console.log('New order received from API:', newOrder);
      if (newOrder) {
        const formattedOrder = {
          ...newOrder,
          items: newOrder.items || [],
          total_price: newOrder.total_price || 0
        };
        console.log('Formatted new order:', formattedOrder);
        setOrders((prevOrders) => {
          const updatedOrders = [formattedOrder, ...prevOrders];
          console.log('Updated orders after adding:', updatedOrders);
          return updatedOrders;
        });
        setTotalOrders((prevTotal) => prevTotal + 1);
      } else {
        throw new Error('New order data is invalid');
      }
      return newOrder;
    } catch (error) {
      console.error('Error adding order:', error);
      setError(error.message || 'An error occurred while creating the order.');
      throw error;
    }
  };

  const deleteOrders = async (orderIds) => {
    try {
      console.log('Deleting orders with IDs:', orderIds);
      await Promise.all(orderIds.map(id => deleteOrder(id)));
      setOrders(prevOrders => {
        const updatedOrders = prevOrders.filter(order => !orderIds.includes(order.id));
        console.log('Updated orders after deletion:', updatedOrders);
        return updatedOrders;
      });
      setTotalOrders(prevTotal => {
        const newTotal = prevTotal - orderIds.length;
        console.log('Updated total orders after deletion:', newTotal);
        return newTotal;
      });
    } catch (error) {
      console.error('Error deleting orders:', error);
      setError(error.message || 'An error occurred while deleting orders.');
      throw error;
    }
  };

  const applyPromotion = async (orderId, promotionCode) => {
    try {
      console.log(`Applying promotion ${promotionCode} to order ${orderId}`);
      const updatedOrder = await applyPromotionToOrder(orderId, promotionCode);
      console.log('Updated order after applying promotion:', updatedOrder);
      setOrders(prevOrders => {
        const newOrders = prevOrders.map(order =>
          order.id === updatedOrder.id ? updatedOrder : order
        );
        console.log('Updated orders after applying promotion:', newOrders);
        return newOrders;
      });
      return updatedOrder;
    } catch (error) {
      console.error('Error applying promotion:', error);
      setError(error.message || 'An error occurred while applying the promotion.');
      throw error;
    }
  };

  const reorderOrder = async (orderId) => {
    try {
      console.log(`Reordering order with ID: ${orderId}`);
      const newOrder = await reorderExistingOrder(orderId);
      console.log('New order created from reorder:', newOrder);
      setOrders(prevOrders => {
        const updatedOrders = [newOrder, ...prevOrders];
        console.log('Updated orders after reordering:', updatedOrders);
        return updatedOrders;
      });
      setTotalOrders(prevTotal => {
        const newTotal = prevTotal + 1;
        console.log('Updated total orders after reordering:', newTotal);
        return newTotal;
      });
      return newOrder;
    } catch (error) {
      console.error('Error reordering:', error);
      setError(error.message || 'An error occurred while reordering.');
      throw error;
    }
  };

  return (
    <OrderContext.Provider value={{
      orders,
      totalOrders,
      loading,
      error,
      fetchOrders: fetchOrdersData,
      addOrder,
      deleteOrders,
      applyPromotion,
      reorderOrder
    }}>
      {console.log('Current orders in context:', orders)}
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { fetchProducts, createProduct, updateProduct, deleteProduct, updateProductStock } from '../services/api';
import { useAuth } from './AuthContext';

export const ProductContext = createContext();

const ProductProvider = ({ children }) => {
  const { isAuthenticated, isInitialized } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProductsData = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }

    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isInitialized) {
      fetchProductsData();
    }
  }, [isInitialized, fetchProductsData]);

  const addProduct = async (product) => {
    try {
      const newProduct = await createProduct(product);
      setProducts((prevProducts) => [...prevProducts, newProduct]);
    } catch (error) {
      throw new Error('Failed to create product');
    }
  };

  const editProduct = async (id, product) => {
    try {
      const updatedProduct = await updateProduct(id, product);
      setProducts((prevProducts) =>
        prevProducts.map((p) => (p.id === id ? updatedProduct : p))
      );
    } catch (error) {
      throw new Error('Failed to update product');
    }
  };

  const removeProduct = async (id) => {
    try {
      await deleteProduct(id);
      setProducts((prevProducts) => prevProducts.filter((p) => p.id !== id));
    } catch (error) {
      throw new Error('Failed to delete product');
    }
  };

  const editProductStock = async (id, quantity) => {
    try {
      const updatedProduct = await updateProductStock(id, quantity);
      setProducts((prevProducts) =>
        prevProducts.map((p) => (p.id === id ? updatedProduct : p))
      );
    } catch (error) {
      throw new Error('Failed to update product stock');
    }
  };

  return (
    <ProductContext.Provider value={{ products, loading, addProduct, editProduct, removeProduct, editProductStock, fetchProducts: fetchProductsData }}>
      {children}
    </ProductContext.Provider>
  );
};

export default ProductProvider;

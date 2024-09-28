import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchProductDetails } from '../services/api';

const ProductDetails = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const data = await fetchProductDetails(id);
        setProduct(data);
      } catch (error) {
        console.error('Error fetching product details:', error);
      }
    };
    loadProduct();
  }, [id]);

  if (!product) return <div>Loading...</div>;

  return (
    <div>
      <h2>{product.name}</h2>
      <p>Category: {product.category}</p>
      <p>Price: {product.price}</p>
      <p>Stock: {product.stock}</p>
      <p>SKU: {product.sku}</p>
      <p>Description: {product.description}</p>
    </div>
  );
};

export default ProductDetails;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { createProduct, fetchCategories } from '../services/api';
import { Button, Form, Container, Row, Col, Spinner } from 'react-bootstrap';
import styled from 'styled-components';
import FlippingModal from '../components/FlippingModal';

const StyledForm = styled(Form)`
  height: 100%;
  display: flex;
  flex-direction: column;

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-control {
    border-radius: 8px;
    border: 1px solid #ced4da;
    padding: 10px 15px;
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

    &:focus {
      border-color: #0645AD;
      box-shadow: 0 0 0 0.2rem rgba(6, 69, 173, 0.25);
    }
  }

  label {
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
`;

const StyledButton = styled(Button)`
  padding: 10px 20px;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
`;

const AddProductModal = ({ isOpen, handleClose, refreshProducts, setSuccess, setError }) => {
  const [productData, setProductData] = useState({
    name: '',
    price: '',
    stock: '',
    category_id: '',
    sku: '',
    description: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const fetchedCategories = await fetchCategories();
        setCategories(fetchedCategories);
      } catch (error) {
        console.error('Error fetching categories:', error);
        setError('Failed to load categories. Please try again.');
      }
    };

    loadCategories();
  }, [setError]);

  useEffect(() => {
    console.log('Current categories state:', categories);
  }, [categories]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProductData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!productData.name.trim()) newErrors.name = 'Name is required';
    if (!productData.price || isNaN(parseFloat(productData.price))) newErrors.price = 'Valid price is required';
    if (!productData.stock || isNaN(parseInt(productData.stock))) newErrors.stock = 'Valid stock quantity is required';
    if (!productData.category_id) newErrors.category_id = 'Category is required';
    if (!productData.sku.trim()) newErrors.sku = 'SKU is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);
      try {
        // Format the data before sending
        const formattedData = {
          ...productData,
          price: parseFloat(productData.price),
          stock: parseInt(productData.stock, 10),
          category_id: parseInt(productData.category_id, 10)
        };
        console.log('Sending product data:', formattedData);
        const result = await createProduct(formattedData);
        console.log('Create product result:', result);
        setSuccess('Product added successfully.');
	refreshProducts();
        handleClose();
      } catch (error) {
        console.error('Error details:', error);
        setError(error.response?.data?.detail || 'Error creating product. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <FlippingModal isOpen={isOpen} onClose={handleClose}>
      <Container fluid className="h-100 d-flex flex-column">
        <Row className="flex-grow-0">
          <Col>
            <h2>Add New Product</h2>
            <Button variant="link" onClick={handleClose}>&times;</Button>
          </Col>
        </Row>
        <Row className="flex-grow-1">
          <Col>
            <Form onSubmit={handleSubmit}>
              <Form.Group controlId="name">
                <Form.Label>Name</Form.Label>
                <Form.Control
                  type="text"
                  name="name"
                  value={productData.name}
                  onChange={handleChange}
                  isInvalid={!!errors.name}
                />
                <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
              </Form.Group>
              <Form.Group controlId="price">
                <Form.Label>Price</Form.Label>
                <Form.Control
                  type="number"
                  name="price"
                  value={productData.price}
                  onChange={handleChange}
                  isInvalid={!!errors.price}
                />
                <Form.Control.Feedback type="invalid">{errors.price}</Form.Control.Feedback>
              </Form.Group>
              <Form.Group controlId="stock">
                <Form.Label>Stock</Form.Label>
                <Form.Control
                  type="number"
                  name="stock"
                  value={productData.stock}
                  onChange={handleChange}
                  isInvalid={!!errors.stock}
                />
                <Form.Control.Feedback type="invalid">{errors.stock}</Form.Control.Feedback>
              </Form.Group>
              <Form.Group controlId="category_id">
                <Form.Label>Category</Form.Label>
                <Form.Control
                  as="select"
                  name="category_id"
                  value={productData.category_id}
                  onChange={handleChange}
                  isInvalid={!!errors.category_id}
                >
                  <option value="">Select a category</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Form.Control>
                <Form.Control.Feedback type="invalid">
                  {errors.category_id}
                </Form.Control.Feedback>
              </Form.Group>
              <Form.Group controlId="sku">
                <Form.Label>SKU</Form.Label>
                <Form.Control
                  type="text"
                  name="sku"
                  value={productData.sku}
                  onChange={handleChange}
                  isInvalid={!!errors.sku}
                />
                <Form.Control.Feedback type="invalid">{errors.sku}</Form.Control.Feedback>
              </Form.Group>
              <Form.Group controlId="description">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="description"
                  value={productData.description}
                  onChange={handleChange}
                />
              </Form.Group>
            </Form>
          </Col>
        </Row>
        <Row className="flex-grow-0">
          <Col className="text-right">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading} onClick={handleSubmit}>
              {isLoading ? <Spinner animation="border" size="sm" /> : 'Add Product'}
            </Button>
          </Col>
        </Row>
      </Container>
    </FlippingModal>
  );
};

AddProductModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  handleClose: PropTypes.func.isRequired,
  refreshProducts: PropTypes.func.isRequired,
  setSuccess: PropTypes.func.isRequired,
  setError: PropTypes.func.isRequired,
};

export default AddProductModal;

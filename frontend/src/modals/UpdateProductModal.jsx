import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { updateProduct, fetchProductDetails } from '../services/api';
import { Modal, Button, Form, Container, Row, Col, Spinner } from 'react-bootstrap';
import styled from 'styled-components';

const EnhancedModal = styled(Modal)`
  .modal-dialog {
    max-width: 800px;
  }

  .modal-content {
    background-color: #f8f9fa;
    border-radius: 15px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  }

  .modal-header {
    background-color: #0645AD;
    color: white;
    border-top-left-radius: 15px;
    border-top-right-radius: 15px;
    padding: 20px;
  }

  .modal-body {
    padding: 30px;
  }

  .modal-footer {
    border-top: none;
    padding: 20px;
  }
`;

const StyledForm = styled(Form)`
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

const UpdateProductModal = ({ show, handleClose, productId, refreshProducts }) => {
  const [productData, setProductData] = useState({
    name: '',
    price: '',
    stock: '',
    category: '',
    sku: '',
    description: '',
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const loadProduct = async () => {
      if (show && productId) {
        setIsFetching(true);
        try {
          const data = await fetchProductDetails(productId);
          setProductData(data);
        } catch (error) {
          console.error('Error fetching product details:', error);
          setErrors({ fetch: 'Failed to load product details. Please try again.' });
        } finally {
          setIsFetching(false);
        }
      }
    };
    loadProduct();
  }, [productId, show]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProductData({ ...productData, [name]: value });
    setErrors({ ...errors, [name]: '' });
  };

  const validateForm = () => {
    const newErrors = {};
    if (!productData.name) newErrors.name = 'Name is required';
    if (!productData.price) newErrors.price = 'Price is required';
    if (!productData.stock) newErrors.stock = 'Stock is required';
    if (!productData.category) newErrors.category = 'Category is required';
    if (!productData.sku) newErrors.sku = 'SKU is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);
      try {
        await updateProduct(productId, productData);
        refreshProducts();
        handleClose();
      } catch (error) {
        console.error('Error updating product:', error);
        setErrors({ submit: 'An error occurred. Please try again.' });
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (isFetching) {
    return (
      <EnhancedModal show={show} onHide={handleClose} centered>
        <Modal.Body className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </Modal.Body>
      </EnhancedModal>
    );
  }

  return (
    <EnhancedModal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Update Product</Modal.Title>
      </Modal.Header>
      <StyledForm onSubmit={handleSubmit}>
        <Modal.Body>
          <Container>
            <Row>
              <Col md={6}>
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
              </Col>
              <Col md={6}>
                <Form.Group controlId="category">
                  <Form.Label>Category</Form.Label>
                  <Form.Control
                    type="text"
                    name="category"
                    value={productData.category}
                    onChange={handleChange}
                    isInvalid={!!errors.category}
                  />
                  <Form.Control.Feedback type="invalid">{errors.category}</Form.Control.Feedback>
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
              </Col>
            </Row>
          </Container>
          {errors.submit && <div className="text-danger mt-3">{errors.submit}</div>}
        </Modal.Body>
        <Modal.Footer>
          <StyledButton variant="secondary" onClick={handleClose}>
            Cancel
          </StyledButton>
          <StyledButton type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? <Spinner animation="border" size="sm" /> : 'Update Product'}
          </StyledButton>
        </Modal.Footer>
      </StyledForm>
    </EnhancedModal>
  );
};

UpdateProductModal.propTypes = {
  show: PropTypes.bool.isRequired,
  handleClose: PropTypes.func.isRequired,
  productId: PropTypes.number.isRequired,
  refreshProducts: PropTypes.func.isRequired,
};

export default UpdateProductModal;

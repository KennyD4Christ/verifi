import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { Modal, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { createStockAdjustment, fetchAdjustmentTypes, fetchProducts } from '../services/api';

const StyledModal = styled(Modal)`
  .modal-content {
    border-radius: 12px;
    padding: 20px;
  }
  .modal-header {
    border-bottom: none;
  }
  .modal-title {
    font-weight: bold;
    font-size: 1.5rem;
  }
  .modal-footer {
    border-top: none;
    justify-content: space-between;
  }
`;

const StyledForm = styled(Form)`
  .form-group {
    margin-bottom: 15px;
  }
`;

const AddAdjustmentModal = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    product: '',
    quantity: 0,
    adjustment_type: '',
    reason: '',
    adjustment_date: new Date().toISOString().split('T')[0], // Set default date to today
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [adjustmentTypes, setAdjustmentTypes] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetchAdjustmentTypes()
      .then(types => setAdjustmentTypes(types))
      .catch(() => setAdjustmentTypes([]));
  }, []);

  useEffect(() => {
    fetchProducts()
      .then(data => setProducts(data.results || []))
      .catch(() => setProducts([]));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const newAdjustment = await createStockAdjustment(formData);
      onAdd(newAdjustment);
      onClose();
      // Reset form after successful submission
      setFormData({
        product: '',
        quantity: 0,
        adjustment_type: '',
        reason: '',
        adjustment_date: new Date().toISOString().split('T')[0],
      });
    } catch (err) {
      setError('Failed to add stock adjustment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal show={isOpen} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Add New Stock Adjustment</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group controlId="product">
            <Form.Label>Product</Form.Label>
            <Form.Control
              as="select"
              name="product"
              value={formData.product}
              onChange={handleChange}
              required
            >
              <option value="">Select Product</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </Form.Control>
          </Form.Group>
          <Form.Group controlId="quantity">
            <Form.Label>Quantity</Form.Label>
            <Form.Control
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              required
            />
          </Form.Group>
          <label htmlFor="adjustment_type">Adjustment Type</label>
          <select
            id="adjustment_type"
            name="adjustment_type"
            value={formData.adjustment_type}
            onChange={handleChange}
            required
          >
            <option value="">Select Type</option>
            <option value="ADD">Add</option>
            <option value="REMOVE">Remove</option>
            <option value="RETURN">Return</option>
            <option value="DAMAGE">Damage</option>
          </select>
          <Form.Group controlId="reason">
            <Form.Label>Reason</Form.Label>
            <Form.Control
              as="textarea"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              required
            />
          </Form.Group>
          <Form.Group controlId="adjustment_date">
            <Form.Label>Date</Form.Label>
            <Form.Control
              type="date"
              name="adjustment_date"
              value={formData.adjustment_date}
              onChange={handleChange}
              required
            />
          </Form.Group>
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="d-flex justify-content-end">
            <Button variant="secondary" onClick={onClose} disabled={isLoading} className="mr-2">
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? <Spinner animation="border" size="sm" /> : 'Add Adjustment'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

AddAdjustmentModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
};

export default AddAdjustmentModal;

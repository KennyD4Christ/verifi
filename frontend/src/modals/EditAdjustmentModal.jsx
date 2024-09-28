import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { updateStockAdjustment } from '../services/api';

const EnhancedModal = styled(Modal)`
  .modal-dialog {
    max-width: 700px;
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

const EditAdjustmentModal = ({ isOpen, onClose, adjustment, onUpdate, setSuccess, setError }) => {
  const [formData, setFormData] = useState({
    product: '',
    quantity: 0,
    adjustment_type: '',
    reason: '',
    adjustment_date: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (adjustment) {
      setFormData({
        product: adjustment.product.name,
        quantity: adjustment.quantity,
        adjustment_type: adjustment.adjustment_type,
        reason: adjustment.reason,
        adjustment_date: adjustment.adjustment_date,
      });
    }
  }, [adjustment]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    setErrors({ ...errors, [name]: '' });
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.quantity) newErrors.quantity = 'Quantity is required';
    if (!formData.adjustment_type) newErrors.adjustment_type = 'Adjustment type is required';
    if (!formData.reason) newErrors.reason = 'Reason is required';
    if (!formData.adjustment_date) newErrors.adjustment_date = 'Date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);
      try {
        const updatedAdjustment = await updateStockAdjustment(adjustment.id, formData);
        onUpdate(updatedAdjustment);
        setSuccess('Stock adjustment updated successfully.');
        onClose();
      } catch (err) {
        setError('Failed to update stock adjustment. Please try again.');
        console.error('Error updating stock adjustment:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <EnhancedModal show={isOpen} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Edit Stock Adjustment</Modal.Title>
      </Modal.Header>
      <StyledForm onSubmit={handleSubmit}>
        <Modal.Body>
          <Form.Group controlId="product">
            <Form.Label>Product</Form.Label>
            <Form.Control
              type="text"
              name="product"
              value={formData.product}
              onChange={handleChange}
              disabled
            />
          </Form.Group>
          <Form.Group controlId="quantity">
            <Form.Label>Quantity</Form.Label>
            <Form.Control
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              isInvalid={!!errors.quantity}
              required
            />
            <Form.Control.Feedback type="invalid">{errors.quantity}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group controlId="adjustment_type">
            <Form.Label>Adjustment Type</Form.Label>
            <Form.Control
              as="select"
              name="adjustment_type"
              value={formData.adjustment_type}
              onChange={handleChange}
              isInvalid={!!errors.adjustment_type}
              required
            >
              <option value="">Select Type</option>
              <option value="ADD">Add</option>
              <option value="REMOVE">Remove</option>
              <option value="RETURN">Return</option>
              <option value="DAMAGE">Damage</option>
            </Form.Control>
            <Form.Control.Feedback type="invalid">{errors.adjustment_type}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group controlId="reason">
            <Form.Label>Reason</Form.Label>
            <Form.Control
              as="textarea"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              isInvalid={!!errors.reason}
              required
            />
            <Form.Control.Feedback type="invalid">{errors.reason}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group controlId="adjustment_date">
            <Form.Label>Date</Form.Label>
            <Form.Control
              type="date"
              name="adjustment_date"
              value={formData.adjustment_date}
              onChange={handleChange}
              isInvalid={!!errors.adjustment_date}
              required
            />
            <Form.Control.Feedback type="invalid">{errors.adjustment_date}</Form.Control.Feedback>
          </Form.Group>
          {errors.submit && <div className="text-danger mt-3">{errors.submit}</div>}
        </Modal.Body>
        <Modal.Footer>
          <StyledButton variant="secondary" onClick={onClose}>
            Cancel
          </StyledButton>
          <StyledButton type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? <Spinner animation="border" size="sm" /> : 'Update Adjustment'}
          </StyledButton>
        </Modal.Footer>
      </StyledForm>
    </EnhancedModal>
  );
};

EditAdjustmentModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  adjustment: PropTypes.object,
  onUpdate: PropTypes.func.isRequired,
  setSuccess: PropTypes.func.isRequired,
  setError: PropTypes.func.isRequired,
};

export default EditAdjustmentModal;

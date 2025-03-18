import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col, Spinner } from 'react-bootstrap';
import styled from 'styled-components';
import { updateReceipt } from '../services/api';
import { format } from 'date-fns';

const StyledModal = styled(Modal)`
  .modal-content {
    border-radius: 8px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  }
  
  .modal-header {
    background-color: #f8f9fa;
    border-bottom: 1px solid #e9ecef;
  }
  
  .modal-footer {
    border-top: 1px solid #e9ecef;
  }
`;

const FormGroup = styled(Form.Group)`
  margin-bottom: 1rem;
`;

const ValidationMessage = styled.div`
  color: #dc3545;
  font-size: 0.875rem;
  margin-top: 0.25rem;
`;

const EditReceiptModal = ({ show, onHide, receipt, onSuccess }) => {
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    payment_method: 'cash',
    amount: '',
    payment_date: '',
    description: '',
    receipt_number: '',
    tax_amount: '',
    currency: 'USD',
    status: 'paid',
    notes: ''
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const paymentMethodOptions = ['cash', 'credit_card', 'bank_transfer', 'cheque', 'online', 'other'];
  const statusOptions = ['paid', 'pending', 'cancelled', 'refunded'];
  const currencyOptions = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY'];
  
  useEffect(() => {
    if (receipt) {
      // Format the date to YYYY-MM-DD for the input
      const formattedDate = receipt.payment_date ? 
        format(new Date(receipt.payment_date), 'yyyy-MM-dd') : 
        '';
        
      setFormData({
        customer_name: receipt.customer_name || '',
        customer_email: receipt.customer_email || '',
        payment_method: receipt.payment_method || 'cash',
        amount: receipt.amount?.toString() || '',
        payment_date: formattedDate,
        description: receipt.description || '',
        receipt_number: receipt.receipt_number || '',
        tax_amount: receipt.tax_amount?.toString() || '',
        currency: receipt.currency || 'USD',
        status: receipt.status || 'paid',
        notes: receipt.notes || ''
      });
    }
  }, [receipt]);
  
  const validate = () => {
    const newErrors = {};
    
    if (!formData.customer_name.trim()) {
      newErrors.customer_name = 'Customer name is required';
    }
    
    if (formData.customer_email && !/\S+@\S+\.\S+/.test(formData.customer_email)) {
      newErrors.customer_email = 'Please enter a valid email address';
    }
    
    if (!formData.amount || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }
    
    if (!formData.payment_date) {
      newErrors.payment_date = 'Payment date is required';
    }
    
    if (formData.tax_amount && (isNaN(parseFloat(formData.tax_amount)) || parseFloat(formData.tax_amount) < 0)) {
      newErrors.tax_amount = 'Please enter a valid tax amount';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    try {
      setLoading(true);
      setMessage({ type: '', text: '' });
      
      // Format data for API
      const dataToUpdate = {
        ...formData,
        amount: parseFloat(formData.amount),
        tax_amount: formData.tax_amount ? parseFloat(formData.tax_amount) : 0,
      };
      
      await updateReceipt(receipt.id, dataToUpdate);
      
      setMessage({
        type: 'success',
        text: 'Receipt updated successfully!'
      });
      
      // Call the success callback
      if (onSuccess) {
        onSuccess();
      }
      
      // Close modal after a brief delay
      setTimeout(() => {
        onHide();
      }, 1500);
      
    } catch (error) {
      console.error('Error updating receipt:', error);
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Failed to update receipt. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <StyledModal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      backdrop="static"
      keyboard={false}
    >
      <Modal.Header closeButton>
        <Modal.Title>Edit Receipt</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {message.text && (
          <div className={`alert alert-${message.type} mb-3`} role="alert">
            {message.text}
          </div>
        )}
        
        <Form onSubmit={handleSubmit}>
          <Row>
            <Col md={6}>
              <FormGroup controlId="customer_name">
                <Form.Label>Customer Name*</Form.Label>
                <Form.Control
                  type="text"
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleChange}
                  isInvalid={!!errors.customer_name}
                />
                {errors.customer_name && (
                  <ValidationMessage>{errors.customer_name}</ValidationMessage>
                )}
              </FormGroup>
            </Col>
            
            <Col md={6}>
              <FormGroup controlId="customer_email">
                <Form.Label>Customer Email</Form.Label>
                <Form.Control
                  type="email"
                  name="customer_email"
                  value={formData.customer_email}
                  onChange={handleChange}
                  isInvalid={!!errors.customer_email}
                />
                {errors.customer_email && (
                  <ValidationMessage>{errors.customer_email}</ValidationMessage>
                )}
              </FormGroup>
            </Col>
          </Row>
          
          <Row>
            <Col md={6}>
              <FormGroup controlId="amount">
                <Form.Label>Amount*</Form.Label>
                <Form.Control
                  type="number"
                  name="amount"
                  step="0.01"
                  value={formData.amount}
                  onChange={handleChange}
                  isInvalid={!!errors.amount}
                />
                {errors.amount && (
                  <ValidationMessage>{errors.amount}</ValidationMessage>
                )}
              </FormGroup>
            </Col>
            
            <Col md={6}>
              <FormGroup controlId="tax_amount">
                <Form.Label>Tax Amount</Form.Label>
                <Form.Control
                  type="number"
                  name="tax_amount"
                  step="0.01"
                  value={formData.tax_amount}
                  onChange={handleChange}
                  isInvalid={!!errors.tax_amount}
                />
                {errors.tax_amount && (
                  <ValidationMessage>{errors.tax_amount}</ValidationMessage>
                )}
              </FormGroup>
            </Col>
          </Row>
          
          <Row>
            <Col md={6}>
              <FormGroup controlId="currency">
                <Form.Label>Currency</Form.Label>
                <Form.Select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                >
                  {currencyOptions.map(currency => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </Form.Select>
              </FormGroup>
            </Col>
            
            <Col md={6}>
              <FormGroup controlId="payment_method">
                <Form.Label>Payment Method</Form.Label>
                <Form.Select
                  name="payment_method"
                  value={formData.payment_method}
                  onChange={handleChange}
                >
                  {paymentMethodOptions.map(method => (
                    <option key={method} value={method}>
                      {method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </Form.Select>
              </FormGroup>
            </Col>
          </Row>
          
          <Row>
            <Col md={6}>
              <FormGroup controlId="payment_date">
                <Form.Label>Payment Date*</Form.Label>
                <Form.Control
                  type="date"
                  name="payment_date"
                  value={formData.payment_date}
                  onChange={handleChange}
                  isInvalid={!!errors.payment_date}
                />
                {errors.payment_date && (
                  <ValidationMessage>{errors.payment_date}</ValidationMessage>
                )}
              </FormGroup>
            </Col>
            
            <Col md={6}>
              <FormGroup controlId="status">
                <Form.Label>Status</Form.Label>
                <Form.Select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  {statusOptions.map(status => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </Form.Select>
              </FormGroup>
            </Col>
          </Row>
          
          <FormGroup controlId="receipt_number">
            <Form.Label>Receipt Number</Form.Label>
            <Form.Control
              type="text"
              name="receipt_number"
              value={formData.receipt_number}
              onChange={handleChange}
            />
          </FormGroup>
          
          <FormGroup controlId="description">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              name="description"
              value={formData.description}
              onChange={handleChange}
            />
          </FormGroup>
          
          <FormGroup controlId="notes">
            <Form.Label>Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="notes"
              value={formData.notes}
              onChange={handleChange}
            />
          </FormGroup>
        </Form>
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
                className="me-2"
              />
              Updating...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </Modal.Footer>
    </StyledModal>
  );
};

export default EditReceiptModal;

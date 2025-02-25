import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { createTransaction } from '../services/api';
import { Modal, Button, Form, Alert } from 'react-bootstrap';

const AddTransactionModal = ({ show, handleClose, handleAddTransaction, initialData }) => {
  const [transactionData, setTransactionData] = useState({
    payment_method: '',
    amount: '',
    date: '',
    transaction_type: 'expense',
    status: '',
    category: '',
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    if (initialData) {
      setTransactionData(prevData => ({
        ...prevData,
        ...initialData,
        // Ensure required fields are populated
        payment_method: initialData.payment_method || prevData.payment_method,
        status: initialData.status || 'pending',
        category: initialData.category || prevData.category
      }));
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTransactionData({ ...transactionData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');
    try {
      await handleAddTransaction(transactionData);
      setMessage('Transaction successfully created');
      setMessageType('success');
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      console.error('Error creating transaction:', error);
      setMessage('Error in creating a transaction. Try again later');
      setMessageType('error');
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>
          {initialData ? 'Complete Scanned Transaction' : 'Add Transaction'}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
	  {message && (
            <Alert variant={messageType === 'success' ? 'success' : 'danger'}>
            {message}
            </Alert>
          )}
          <Form.Group controlId="payment_method">
            <Form.Label>Payment Method</Form.Label>
            <Form.Control
              as="select"
              name="payment_method"
              value={transactionData.payment_method}
              onChange={handleChange}
              required
            >
              <option value="">Select Payment Method</option>
              <option value="cash">Cash</option>
              <option value="credit_card">Credit Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="paypal">PayPal</option>
              <option value="other">Other</option>
            </Form.Control>
          </Form.Group>
          <Form.Group controlId="amount">
            <Form.Label>Amount</Form.Label>
            <Form.Control
              type="number"
              name="amount"
              value={transactionData.amount}
              onChange={handleChange}
              required
            />
          </Form.Group>
          <Form.Group controlId="date">
            <Form.Label>Date</Form.Label>
            <Form.Control
              type="date"
              name="date"
              value={transactionData.date}
              onChange={handleChange}
              required
            />
          </Form.Group>
          <Form.Group controlId="transaction_type">
            <Form.Label>Type</Form.Label>
            <Form.Control
              as="select"
              name="transaction_type"
              value={transactionData.type}
              onChange={handleChange}
              required
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
	      <option value="cost_of_services">Cost of Services</option>
            </Form.Control>
          </Form.Group>
          <Form.Group controlId="status">
            <Form.Label>Status</Form.Label>
            <Form.Control
              as="select"
              name="status"
              value={transactionData.status}
              onChange={handleChange}
              required
            >
              <option value="">Select Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="refunded">Refunded</option>
              <option value="cancelled">Cancelled</option>
            </Form.Control>
          </Form.Group>
          <Form.Group controlId="category">
            <Form.Label>Category</Form.Label>
            <Form.Control
              as="select"
              name="category"
              value={transactionData.category}
              onChange={handleChange}
              required
            >
              <option value="">Select Category</option>
              <option value="salary">Salary</option>
              <option value="marketing_expenses">Marketing Expenses</option>
              <option value="office_supplies">Office Supplies</option>
              <option value="utilities">Utilities</option>
	      <option value="cost_of_services">Cost of Services</option>
              <option value="other">Other</option>
            </Form.Control>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button type="submit" variant="primary">
            Save Transaction
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

AddTransactionModal.propTypes = {
  show: PropTypes.bool.isRequired,
  handleClose: PropTypes.func.isRequired,
  handleAddTransaction: PropTypes.func.isRequired,
  initialData: PropTypes.object,
};

export default AddTransactionModal;

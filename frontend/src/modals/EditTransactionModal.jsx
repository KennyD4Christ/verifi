import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { updateTransaction } from '../services/api';
import { Modal, Button, Form } from 'react-bootstrap';

const EditTransactionModal = ({ show, handleClose, refreshTransactions, transaction }) => {
  const [transactionData, setTransactionData] = useState({
    payment_method: '',
    amount: '',
    date: '',
    type: '',
    status: '',
  });

  useEffect(() => {
    if (transaction) {
      setTransactionData({
        payment_method: transaction.payment_method,
        amount: transaction.amount,
        date: transaction.date,
        transaction_type: transaction.transaction_type,
        status: transaction.status,
      });
    }
  }, [transaction]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTransactionData({ ...transactionData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateTransaction(transaction.id, transactionData);
      refreshTransactions();
      handleClose();
    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Edit Transaction</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Form.Group controlId="payment_method">
            <Form.Label>Payment Method</Form.Label>
            <Form.Control
              type="text"
              name="payment_method"
              value={transactionData.payment_method}
              onChange={handleChange}
              required
            />
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
            <Form.Label>Transaction Type</Form.Label>
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
              type="text"
              name="status"
              value={transactionData.status}
              onChange={handleChange}
              required
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button type="submit" variant="primary">
            Save Changes
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

EditTransactionModal.propTypes = {
  show: PropTypes.bool.isRequired,
  handleClose: PropTypes.func.isRequired,
  refreshTransactions: PropTypes.func.isRequired,
  transaction: PropTypes.object,
};

export default EditTransactionModal;

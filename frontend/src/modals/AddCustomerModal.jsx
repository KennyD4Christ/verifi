import React, { useState } from 'react';
import Modal from 'react-modal';
import styled from 'styled-components';

const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
  },
};

const Form = styled.form`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  margin-bottom: 10px;
`;

const Input = styled.input`
  padding: 10px;
  margin-bottom: 20px;
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const Button = styled.button`
  padding: 10px 20px;
  background-color: #28a745;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background-color: #218838;
  }
`;

const ErrorMessage = styled.p`
  color: red;
  margin-top: 10px;
`;

const AddCustomerModal = ({ isOpen, onClose, onAddCustomer }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const newCustomer = { first_name: firstName, last_name: lastName, email, phone };
      console.log('Submitting customer:', newCustomer);
      await onAddCustomer(newCustomer);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      onClose();
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      setError(err.message || 'Error adding customer');
    }
  };

  return (
    <Modal isOpen={isOpen} onRequestClose={onClose} style={customStyles} contentLabel="Add Customer">
      <h2>Add New Customer</h2>
      <Form onSubmit={handleSubmit}>
        <Label htmlFor="first_name">First Name</Label>
        <Input
	  type="text"
	  id="first_name"
	  value={firstName}
	  onChange={(e) => setFirstName(e.target.value)}
	  required
	/>
	<Label htmlFor="last_name">Last Name</Label>
	<Input
	  type="text"
	  id="last_name"
	  value={lastName}
	  onChange={(e) => setLastName(e.target.value)}
	  required
	/>
	<Label htmlFor="email">Email</Label>
	<Input
	  type="email"
	  id="email"
	  value={email}
	  onChange={(e) => setEmail(e.target.value)}
	  required
	/>
	<Label htmlFor="phone">Phone</Label>
	<Input
	  type="text"
	  id="phone"
	  value={phone}
	  onChange={(e) => setPhone(e.target.value)}
	  required
	/>
	<Button type="submit">Add Customer</Button>
	{error && <ErrorMessage>{error}</ErrorMessage>}
      </Form>
    </Modal>
  );
};

export default AddCustomerModal;

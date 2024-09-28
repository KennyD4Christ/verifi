import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { createUser } from '../services/api';
import { Modal, Button, Form } from 'react-bootstrap';

const AddUserModal = ({ show, handleClose, refreshUsers }) => {
  const [userData, setUserData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone_number: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserData({ ...userData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createUser(userData);
      refreshUsers();
      handleClose();
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
	<Modal.Title>Add User</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
	<Modal.Body>
	  <Form.Group controlId="username">
	    <Form.Label>Username</Form.Label>
	    <Form.Control
	      type="text"
	      name="username"
	      value={userData.username}
	      onChange={handleChange}
	      required
	    />
	  </Form.Group>
	  <Form.Group controlId="email">
	    <Form.Label>Email</Form.Label>
	    <Form.Control
	      type="email"
	      name="email"
	      value={userData.email}
	      onChange={handleChange}
	      required
	    />
	  </Form.Group>
	  <Form.Group controlId="password">
	    <Form.Label>Password</Form.Label>
	    <Form.Control
	      type="password"
	      name="password"
	      value={userData.password}
	      onChange={handleChange}
	      required
	    />
	  </Form.Group>
	  <Form.Group controlId="first_name">
	    <Form.Label>First Name</Form.Label>
	    <Form.Control
	      type="text"
	      name="first_name"
	      value={userData.first_name}
	      onChange={handleChange}
	      required
	    />
	  </Form.Group>
          <Form.Group controlId="last_name">
	    <Form.Label>Last Name</Form.Label>
	    <Form.Control
	      type="text"
	      name="last_name"
	      value={userData.last_name}
	      onChange={handleChange}
	      required
	    />
	  </Form.Group>
	  <Form.Group controlId="phone_number">
	    <Form.Label>Phone Number</Form.Label>
	    <Form.Control
	      type="tel"
	      name="phone_number"
	      value={userData.phone_number}
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
	    Save User
	  </Button>
	</Modal.Footer>
      </Form>
    </Modal>
  );
};

AddUserModal.propTypes = {
  show: PropTypes.bool.isRequired,
  handleClose: PropTypes.func.isRequired,
  refreshUsers: PropTypes.func.isRequired,
};

export default AddUserModal;

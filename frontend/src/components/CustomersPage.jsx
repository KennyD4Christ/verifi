import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import styled from 'styled-components';
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer } from '../services/api';
import AddCustomerModal from '../modals/AddCustomerModal';
import EditCustomerModal from '../modals/EditCustomerModal';

const CustomersContainer = styled.div`
  padding: 20px;
`;

const Heading = styled.h1`
  font-size: 2em;
  margin-bottom: 20px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
`;

const Th = styled.th`
  background-color: #f5f5f5;
  padding: 10px;
  border: 1px solid #ddd;
`;

const Td = styled.td`
  padding: 10px;
  border: 1px solid #ddd;
`;

const Button = styled.button`
  padding: 10px 20px;
  background-color: #007bff;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background-color: #0056b3;
  }
`;

const EditButton = styled(Button)`
  background-color: #ffc107;

  &:hover {
    background-color: #e0a800;
  }
`;

const DeleteButton = styled(Button)`
  background-color: #dc3545;

  &:hover {
    background-color: #c82333;
  }
`;

const CustomersPage = () => {
  const { isAuthenticated } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState(null);
	  
  useEffect(() => {
    const fetchData = async () => {
      if (isAuthenticated()) {
	try {
          const data = await fetchCustomers();
          setCustomers(data);
	} catch (error) {
	  console.error('Error fetching customers:', error);
	}
      }
    };

    fetchData();
  }, [isAuthenticated]);

  if (!isAuthenticated()) {
    return <div>Please log in to view customers.</div>;
  }

  const handleAddCustomer = async (customerData) => {
    try {
      const newCustomer = await createCustomer(customerData);
      setCustomers([...customers, newCustomer]);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error adding customer:', error);
    }
  };

  const handleEditCustomer = async (id, updatedData) => {
    try {
      const updatedCustomer = await updateCustomer(id, updatedData);
      setCustomers(customers.map(customer => (customer.id === id ? updatedCustomer : customer)));
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating customer:', error);
    }
  };

  const handleDeleteCustomer = async (id) => {
    try {
      await deleteCustomer(id);
      setCustomers(customers.filter(customer => customer.id !== id));
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const openEditModal = (customer) => {
    setCurrentCustomer(customer);
    setIsEditModalOpen(true);
  };

  return (
    <CustomersContainer>
      <Heading>Customers</Heading>

      <Button onClick={() => setIsAddModalOpen(true)}>Add New Customer</Button>

      <Table>
	<thead>
	  <tr>
	    <Th>Name</Th>
	    <Th>Email</Th>
	    <Th>Phone</Th>
	    <Th>Actions</Th>
	  </tr>
	</thead>
	<tbody>
	  {customers.map(customer => (
	    <tr key={customer.id}>
	      <Td>{`${customer.first_name} ${customer.last_name}`}</Td>
	      <Td>{customer.email}</Td>
	      <Td>{customer.phone}</Td>
	      <Td>
		<EditButton onClick={() => openEditModal(customer)}>Edit</EditButton>
		<DeleteButton onClick={() => handleDeleteCustomer(customer.id)}>Delete</DeleteButton>
	      </Td>
	    </tr>
	  ))}
	</tbody>
      </Table>

      <AddCustomerModal
        isOpen={isAddModalOpen}
	onClose={() => setIsAddModalOpen(false)}
	onAddCustomer={handleAddCustomer}
      />

      <EditCustomerModal
        isOpen={isEditModalOpen}
	onClose={() => setIsEditModalOpen(false)}
	customer={currentCustomer}
	onEditCustomer={handleEditCustomer}
      />
    </CustomersContainer>
  );
};

export default CustomersPage;

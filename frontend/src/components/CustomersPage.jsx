import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import styled from 'styled-components';
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer } from '../services/api';
import AddCustomerModal from '../modals/AddCustomerModal';
import EditCustomerModal from '../modals/EditCustomerModal';
import { ThemeProvider } from "styled-components";
import { Table, Container } from 'react-bootstrap';


const getThemeValue = (path, fallback) => props => {
  const value = path.split('.').reduce((acc, part) => {
    if (acc && acc[part] !== undefined) return acc[part];
    return undefined;
  }, props.theme);

  return value !== undefined ? value : fallback;
};

const CustomersContainer = styled.div`
  padding: clamp(1rem, 3vw, 2rem);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: ${getThemeValue('colors.background', '#ffffff')};
  color: ${getThemeValue('colors.text.primary', '#2d3748')};
  width: 100%;
  max-width: 100%;
`;

const Heading = styled.h1`
  color: ${getThemeValue('colors.text.primary', '#2d3748')};
  margin-bottom: clamp(1.5rem, 4vw, 2.5rem);
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 600;
  letter-spacing: -0.025em;
  border-bottom: 2px solid ${getThemeValue('colors.border', '#e2e8f0')};
  padding-bottom: 1rem;
`;

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 0 auto;
  border-radius: clamp(0px, 2vw, 4px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  background-color: ${getThemeValue('colors.surface', '#f7fafc')};
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};

  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: ${getThemeValue('colors.surface', '#f7fafc')};
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${getThemeValue('colors.border', '#e2e8f0')};
    border-radius: 3px;
    
    &:hover {
      background: ${getThemeValue('colors.text.secondary', '#4a5568')};
    }
  }
`;

const StyledTable = styled(Table)`
  width: 100%;
  min-width: min-content;
  font-size: clamp(0.875rem, 2vw, 1rem);
`;

const Th = styled.th`
  background-color: #f5f5f5;
  padding: clamp(0.5rem, 2vw, 1rem);
  border: 2px solid ${getThemeValue('colors.border', '#e2e8f0')};
  white-space: nowrap;
  text-align: left;
`;

const Td = styled.td`
  padding: clamp(0.5rem, 2vw, 1rem);
  border: 1px solid #ddd;
  
  @media (max-width: 640px) {
    &:before {
      content: attr(data-label);
      float: left;
      font-weight: bold;
      margin-right: 1rem;
    }
  }
`;

const ButtonContainer = styled.div`
  width: 100%;
  margin-bottom: 1rem;
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  background-color: ${getThemeValue('colors.primary', '#1a365d')};
  color: #fff;
  border: none;
  border-radius: 1.5rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  min-width: 120px;
  
  &:hover {
    background-color: #0056b3;
  }

  @media (max-width: 640px) {
    width: 100%;
  }
`;

const EditButton = styled(Button)`
  background-color: #ffc107;
  margin-bottom: 0;

  height: 85%;
  padding: clamp(0.45rem, 1.8vw, 0.9rem);
  width: 14%; /* Reduced width */
  min-width: 108px;
  margin-right: 0;

  &:hover {
    background-color: #e0a800;
  }

  transform: scale(0.9);
`;

const DeleteButton = styled(Button)`
  background-color: #dc3545;
  margin-bottom: 0;

  height: 85%;
  padding: clamp(0.45rem, 1.8vw, 0.9rem);
  width: 15%; /* Reduced width */
  min-width: 108px;
  margin-left: 0;

  &:hover {
    background-color: #c82333;
  }

  transform: scale(0.9);
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

      <ButtonContainer>
        <Button onClick={() => setIsAddModalOpen(true)}>
          Add New Customer
        </Button>
      </ButtonContainer>

      <TableWrapper>
        <StyledTable>
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
                <Td data-label="Name">{`${customer.first_name} ${customer.last_name}`}</Td>
                <Td data-label="Email">{customer.email}</Td>
                <Td data-label="Phone">{customer.phone}</Td>
                <Td data-label="Actions">
                  <ButtonContainer>
                    <EditButton onClick={() => openEditModal(customer)}>Edit</EditButton>
                    <DeleteButton onClick={() => handleDeleteCustomer(customer.id)}>Delete</DeleteButton>
                  </ButtonContainer>
                </Td>
              </tr>
            ))}
          </tbody>
        </StyledTable>
      </TableWrapper>

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

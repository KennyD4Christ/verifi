import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Table } from 'react-bootstrap';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import styled from 'styled-components';
import { createInvoice, fetchCustomers, fetchCompanyInfo, updateCompanyInfo, fetchProducts } from '../services/api';
import CompanyInfoForm from '../components/CompanyInfoForm';

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

const AutocompleteWrapper = styled.div`
  position: relative;
`;

const AutocompleteList = styled.ul`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: white;
  border: 1px solid #ddd;
  border-top: none;
  list-style-type: none;
  padding: 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1;
`;

const AutocompleteItem = styled.li`
  padding: 10px;
  cursor: pointer;

  &:hover {
    background-color: #f0f0f0;
  }
`;

const CreateInvoiceModal = ({ isOpen, onClose, onInvoiceCreated }) => {
  const [customers, setCustomers] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const [customerInput, setCustomerInput] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);

  const { register, control, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      customer: '',
      issue_date: new Date().toISOString().substr(0, 10),
      due_date: new Date().toISOString().substr(0, 10),
      items: [{ product_id: '', quantity: 1, unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchItems = watch('items');
  const total = watchItems?.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0) || 0;

  useEffect(() => {
    const loadData = async () => {
      try {
        const [fetchedCustomers, fetchedCompanyInfo, fetchedProducts] = await Promise.all([
          fetchCustomers(),
          fetchCompanyInfo(),
          fetchProducts(),
        ]);
	console.log('Fetched products:', fetchedProducts);
        setCustomers(fetchedCustomers);
        setCompanyInfo(fetchedCompanyInfo);
        setProducts(fetchedProducts.results || []);
      } catch (err) {
	console.error('Error loading data:', err);
        setError('Error loading data: ' + err.message);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (customerInput) {
      const filtered = customers.filter(customer =>
        `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(customerInput.toLowerCase()) ||
        customer.email.toLowerCase().includes(customerInput.toLowerCase()) ||
        (customer.phone && customer.phone.includes(customerInput))
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers([]);
    }
  }, [customerInput, customers]);

  const handleProductChange = (index, selectedProductId) => {
    console.log('handleProductChange called with:', index, selectedProductId);
    console.log('Current products:', products);
    const product = products.find(p => p.id === selectedProductId);
    console.log('Found product:', product);
    if (product) {
      console.log('Setting values for product:', product);
      setValue(`items.${index}.product_id`, product.id);
      setValue(`items.${index}.unit_price`, product.price);
      console.log('Current form values:', getValues());
    } else {
      console.log('Product not found');
    }
  };

  const handleCompanyInfoChange = (updatedCompanyInfo) => {
    setCompanyInfo(updatedCompanyInfo);
  };

  const handleSelectCustomer = (customer) => {
    setValue('customer', customer.id);
    setCustomerInput(`${customer.first_name} ${customer.last_name}`);
    setFilteredCustomers([]);
  };

  const onSubmit = async (data) => {
    try {
      const newInvoice = {
        customer: data.customer,
        total_amount: total,
        issue_date: data.issue_date,
        due_date: data.due_date,
        company_info: companyInfo,
        items: data.items.map(item => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price)
        }))
      };
      const createdInvoice = await createInvoice(newInvoice);
      onInvoiceCreated(createdInvoice);
      onClose();
    } catch (err) {
      setError('Error creating invoice: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <Modal show={isOpen} onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Create New Invoice</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <CompanyInfoForm
          initialCompanyInfo={companyInfo}
          onCompanyInfoChange={handleCompanyInfoChange}
        />
        <Form onSubmit={handleSubmit(onSubmit)} id="createInvoiceForm">
          <Form.Group className="mb-3">
            <Form.Label htmlFor="customerInput">Customer</Form.Label>
            <AutocompleteWrapper>
              <Form.Control
                type="text"
                id="customerInput"
                value={customerInput}
                onChange={(e) => setCustomerInput(e.target.value)}
                placeholder="Search by name, email, or phone"
                required
              />
              {filteredCustomers.length > 0 && (
                <AutocompleteList>
                  {filteredCustomers.map(customer => (
                    <AutocompleteItem
                      key={customer.id}
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      {`${customer.first_name} ${customer.last_name} - ${customer.email}`}
                    </AutocompleteItem>
                  ))}
                </AutocompleteList>
              )}
            </AutocompleteWrapper>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Issue Date</Form.Label>
            <Form.Control
              {...register('issue_date', { required: 'Issue date is required' })}
              type="date"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Due Date</Form.Label>
            <Form.Control
              {...register('due_date', { required: 'Due date is required' })}
              type="date"
            />
          </Form.Group>

          <h5 className="mt-4">Invoice Items</h5>
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    <Controller
                      name={`items.${index}.product_id`}
                      control={control}
                      render={({ field }) => (
                        <Form.Select
                          {...field}
                          onChange={(e) => handleProductChange(index, e.target.value)}
                        >
                          <option value="">Select a product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </Form.Select>
                      )}
                    />
                  </td>
                  <td>
                    <Form.Control
                      {...register(`items.${index}.quantity`)}
                      type="number"
                      min="1"
                    />
                  </td>
                  <td>
                    <Form.Control
                      {...register(`items.${index}.unit_price`)}
                      type="number"
                      min="0"
                      step="0.01"
                      readOnly
                    />
                  </td>
                  <td>
                    <Button variant="danger" onClick={() => remove(index)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Button variant="secondary" onClick={() => append({ product_id: '', quantity: 1, unit_price: 0 })}>
            Add Item
          </Button>

          <Form.Group className="mt-3">
            <Form.Label>Total Amount: ${total.toFixed(2)}</Form.Label>
          </Form.Group>

          {error && <div className="text-danger mt-3">{error}</div>}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" form="createInvoiceForm">
          Create Invoice
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CreateInvoiceModal;

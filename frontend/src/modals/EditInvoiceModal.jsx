import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Table } from 'react-bootstrap';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import styled from 'styled-components';
import AsyncSelect from 'react-select/async';
import { searchCustomers, getCustomerById, fetchCompanyInfo, updateCompanyInfo, fetchProducts } from '../services/api';
import CompanyInfoForm from '../components/CompanyInfoForm';
import { InvoiceQRCode } from '../components/QRCode';

const StyledModal = styled(Modal)`
  .modal-dialog {
    max-width: 800px;
  }
`;

const ActionButton = styled(Button)`
  margin-right: 10px;
`;

const EditInvoiceModal = ({ isOpen, onClose, invoice, onSave }) => {
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [products, setProducts] = useState([]);

  const defaultValues = React.useMemo(() => ({
    customer: invoice?.customer || null,
    description: invoice?.description || '',
    issue_date: invoice?.issue_date || new Date().toISOString().substr(0, 10),
    due_date: invoice?.due_date || new Date().toISOString().substr(0, 10),
    status: invoice?.status || 'draft',
    items: invoice?.items || [{ description: '', quantity: 1, unit_price: 0 }],
    company_info: invoice?.company_info || null,
  }), [invoice]);

  const { register, control, handleSubmit, watch, setValue, getValues } = useForm({
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchItems = watch('items');
  const total = watchItems?.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0) || 0;

  useEffect(() => {
    const fetchProductsData = async () => {
      try {
        const fetchedProducts = await fetchProducts();
	console.log('Fetched products:', JSON.stringify(fetchedProducts, null, 2));
        const productsToSet = fetchedProducts.results || [];
	console.log('Setting products:', JSON.stringify(productsToSet, null, 2));
        setProducts(productsToSet);
      } catch (error) {
        console.error('Error fetching products:', error);
	setProducts([]);
      }
    };

    fetchProductsData();
  }, []);

  const loadCustomerOptions = async (inputValue) => {
    try {
      return await searchCustomers(inputValue);
    } catch (error) {
      console.error('Error loading customer options:', error);
      return [];
    }
  };

  const handleCustomerChange = (selectedOption) => {
    setSelectedCustomer(selectedOption);
    setValue('customer', selectedOption.value);
  };

  useEffect(() => {
    const fetchCompanyInformation = async () => {
      try {
        const fetchedCompanyInfo = await fetchCompanyInfo();
        setCompanyInfo(fetchedCompanyInfo);
      } catch (error) {
        console.error('Error fetching company information:', error);
      }
    };

    fetchCompanyInformation();
  }, []);

  const handleCompanyInfoChange = (updatedCompanyInfo) => {
    setCompanyInfo(updatedCompanyInfo);
  };

  const handleProductChange = (index, selectedProductId) => {
    const product = products.find(p => p.id === parseInt(selectedProductId, 10));
    if (product) {
      setValue(`items.${index}.product_id`, product.id);
      setValue(`items.${index}.unit_price`, parseFloat(product.price));
      setValue(`items.${index}.description`, product.name);
    } else {
      setValue(`items.${index}.product_id`, '');
      setValue(`items.${index}.unit_price`, 0);
      setValue(`items.${index}.description`, '');
    }
  };

  const handleQRCodeScan = (qrData) => {
    try {
      const invoiceData = JSON.parse(qrData);
      
      // You can customize this behavior
      setSelectedInvoice(invoiceData);
      setShowDetailsModal(true);
    } catch (error) {
      setError('Error processing QR code');
    }
  };

  const onSubmit = (data) => {
    const updatedInvoice = {
      ...invoice,
      ...data,
      customer_id: data.customer,
      total_amount: total,
      items: data.items.map(item => ({
	product_id: item.product_id,
        description: item.description,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price)
      })),
      company_info: companyInfo
    };
    onSave(updatedInvoice);
    onClose();
  };

  useEffect(() => {
    const fetchCustomer = async () => {
      if (invoice?.customer_id) {
        try {
          const customer = await getCustomerById(invoice.customer_id);
          setSelectedCustomer(customer);
        } catch (error) {
          console.error('Error fetching customer:', error);
        }
      }
    };

    fetchCustomer();
  }, [invoice]);

  if (!register) return null;

  return (
    <StyledModal show={isOpen} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>{invoice?.id ? 'Edit Invoice' : 'Create Invoice'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
	<CompanyInfoForm
          initialCompanyInfo={companyInfo}
          onCompanyInfoChange={handleCompanyInfoChange}
        />
        <Form onSubmit={handleSubmit(onSubmit)} id="editInvoiceForm">
          <Form.Group className="mb-3">
            <Form.Label>Customer</Form.Label>
            <Controller
              name="customer"
              control={control}
              rules={{ required: 'Customer is required' }}
              render={({ field }) => (
                <AsyncSelect
                  {...field}
                  cacheOptions
                  loadOptions={loadCustomerOptions}
                  defaultOptions
                  onChange={handleCustomerChange}
                  value={selectedCustomer}
                />
              )}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control
              {...register('description')}
              as="textarea"
              rows={3}
            />
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

          <Form.Group className="mb-3">
            <Form.Label>Status</Form.Label>
            <Form.Select {...register('status', { required: 'Status is required' })}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
            </Form.Select>
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
                          onChange={(e) => {
                            field.onChange(e);
                            handleProductChange(index, e.target.value);
		          }}
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
                        {...register(`items.${index}.description`)}
                        readOnly
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
          
          {invoice && invoice.id && (
            <div className="mt-4">
              <h5>Invoice QR Code</h5>
              <div className="d-flex justify-content-center my-3">
                <InvoiceQRCode
                  invoice={invoice}
                  size="120px"
                  onScan={handleQRCodeScan}
                />
              </div>
            </div>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" form="editInvoiceForm">
          Save Changes
        </Button>
      </Modal.Footer>
    </StyledModal>
  );
};

export default EditInvoiceModal;

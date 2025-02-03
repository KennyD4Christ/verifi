import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, Select, Button, message, InputNumber, Typography, Table } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { fetchProducts } from '../services/api';
import { formatCurrency } from '../utils/dataTransformations';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

const STATUS_OPTIONS = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const CreateOrderModal = ({ open, onClose, onOrderCreated, customers, currentUser }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [fetchingProducts, setFetchingProducts] = useState(false);

  const TRANSACTION_CATEGORIES = [
    { value: 'income', label: 'Income' },
    { value: 'expense', label: 'Expense' },
    { value: 'cost_of_services', label: 'Cost of Services' },
  ];

  useEffect(() => {
    if (open && currentUser) {
      form.setFieldsValue({
        sales_rep_id: currentUser.id,
	sales_rep_name: `${currentUser.firstName} ${currentUser.lastName}`
      });
    }
  }, [open, currentUser, form]);


  const totalPrice = useMemo(() => {
    return orderItems.reduce((total, item) => total + (parseFloat(item.unit_price) * item.quantity), 0);
  }, [orderItems]);

  useEffect(() => {
    if (open) {
      form.resetFields();
      setOrderItems([]);
      fetchProductList();
    }
  }, [open]);

  const fetchProductList = async () => {
    setFetchingProducts(true);
    try {
      const fetchedProducts = await fetchProducts();
      // Ensure fetchedProducts is an array and has the expected structure
      if (Array.isArray(fetchedProducts.results)) {
        setProducts(fetchedProducts.results);
      } else if (Array.isArray(fetchedProducts)) {
        setProducts(fetchedProducts);
      } else {
        console.error('Unexpected product data structure:', fetchedProducts);
        setProducts([]);
      }
      console.log('Fetched products:', fetchedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      message.error('Failed to fetch products. Please try again.');
      setProducts([]);
    } finally {
      setFetchingProducts(false);
    }
  };

  const handleSubmit = async (values) => {
    console.log('Submitting order:', values);
    if (orderItems.length === 0) {
      message.error('Please add at least one product to the order.');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
	sales_rep_id: currentUser.id,
	sales_rep_name: `${currentUser.firstName} ${currentUser.lastName}`,
        customer_id: values.customer_id || null,
	transaction_category: values.transaction_category,
        special_instructions: values.special_instructions,
        items: orderItems.map(item => ({
          product: item.product_id,
          quantity: item.quantity,
          unit_price: parseFloat(item.unit_price),
        })),
	status: values.status
      };

      console.log('Processed order data:', orderData);
      await onOrderCreated(orderData);
      message.success('Order created successfully');
      onClose();
    } catch (err) {
      console.error('Error creating order:', err);
      message.error(err.message || 'An error occurred while creating the order.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = () => {
    setOrderItems([...orderItems, { product_id: null, quantity: 1, unit_price: '0', status: 'pending' }]);
  };

  const handleProductChange = (value, index) => {
    console.log('Selected product ID:', value);
    console.log('Available products:', products);
    const selectedProduct = products.find(p => p.id === value);
    if (!selectedProduct) {
      console.error(`Product with id ${value} not found`);
      message.error(`Product with id ${value} not found. Please select a valid product.`);
      return;
    }

    console.log('Selected product:', selectedProduct);

    setOrderItems(prevItems => {
      const newItems = [...prevItems];
      newItems[index] = {
        ...newItems[index],
        product_id: selectedProduct.id,
        unit_price: selectedProduct.price,
      };
      return newItems;
    });
  };

  const handleQuantityChange = (value, index) => {
    setOrderItems(prevItems => {
      const newItems = [...prevItems];
      newItems[index] = { ...newItems[index], quantity: value };
      return newItems;
    });
  };

  const handleStatusChange = (value, index) => {
    setOrderItems(prevItems => {
      const newItems = [...prevItems];
      newItems[index] = { ...newItems[index], status: value };
      return newItems;
    });
  };

  const handleRemoveProduct = (index) => {
    setOrderItems(prevItems => prevItems.filter((_, i) => i !== index));
  };

  const columns = [
    {
      title: 'Product',
      dataIndex: 'product_id',
      key: 'product_id',
      render: (value, _, index) => (
        <Select
          style={{ width: 200 }}
          value={value}
          onChange={(v) => handleProductChange(v, index)}
          placeholder="Select product"
	  loading={fetchingProducts}
          disabled={fetchingProducts}
        >
          {products.map(product => (
            <Option key={product.id} value={product.id}>
              {product.name}
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (value, _, index) => (
        <InputNumber
          min={1}
          value={value}
          onChange={(v) => handleQuantityChange(v, index)}
        />
      ),
    },
    {
      title: 'Unit Price',
      dataIndex: 'unit_price',
      key: 'unit_price',
      render: (value) => formatCurrency(value),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (value, _, index) => (
        <Select
          style={{ width: 120 }}
          value={value}
          onChange={(v) => handleStatusChange(v, index)}
        >
          {STATUS_OPTIONS.map(status => (
            <Option key={status} value={status}>
              {status}
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, __, index) => (
        <Button type="link" onClick={() => handleRemoveProduct(index)} icon={<DeleteOutlined />}>
          Remove
        </Button>
      ),
    },
  ];

  return (
    <Modal
      title="Create New Order"
      open={open}
      onCancel={() => {
        form.resetFields();
        setOrderItems([]);
        onClose();
      }}
      footer={null}
      width={800}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="sales_rep_name" label="Sales Representative">
          <Input
            disabled
            value={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'N/A'}
          />
        </Form.Item>

        <Form.Item name="customer_id" label="Customer (Optional)">
          <Select placeholder="Select customer">
            {customers.map(customer => (
              <Option key={customer.id} value={customer.id}>
                {`${customer.first_name} ${customer.last_name}`}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="transaction_category"
          label="Transaction Category"
          rules={[{ required: true, message: 'Please select a transaction category' }]}
        >
          <Select placeholder="Select transaction category">
            {TRANSACTION_CATEGORIES.map(category => (
              <Option key={category.value} value={category.value}>
                {category.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="status"
          label="Order Status"
          rules={[{ required: true, message: 'Please select an order status' }]}
        >
          <Select placeholder="Select order status">
            {STATUS_OPTIONS.map(status => (
              <Option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="Order Items">
          <Table
            dataSource={orderItems}
            columns={columns}
            pagination={false}
            rowKey={(record, index) => index}
          />
          <Button
            type="dashed"
            onClick={handleAddProduct}
            block
            icon={<PlusOutlined />}
            style={{ marginTop: 16 }}
          >
            Add Product
          </Button>
        </Form.Item>

        <Form.Item name="special_instructions" label="Special Instructions">
          <TextArea rows={3} />
        </Form.Item>

        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            Sales Representative: {currentUser?.first_name} {currentUser?.last_name}
          </Text>
        </div>

        <Text strong>Total Price: {formatCurrency(totalPrice)}</Text>

        <Form.Item style={{ marginTop: 16 }}>
          <Button type="primary" htmlType="submit" loading={loading}>
            Create Order
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateOrderModal;

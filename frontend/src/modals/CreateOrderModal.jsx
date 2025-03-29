import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Modal, Form, Input, Select, Button, message, InputNumber, 
  Typography, Table, Card, Space, Divider, Row, Col, Badge, Tag,
  Layout, PageHeader
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, QrcodeOutlined, 
  ShoppingCartOutlined, UserOutlined, DollarOutlined,
  InfoCircleOutlined, CheckCircleOutlined, CloseOutlined
} from '@ant-design/icons';
import { fetchProducts } from '../services/api';
import { formatCurrency } from '../utils/dataTransformations';
import QRScannerModal from './QRScannerModal';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;
const { Header, Content, Footer } = Layout;

const STATUS_OPTIONS = [
  { value: 'pending', color: 'orange', label: 'Pending' },
  { value: 'processing', color: 'blue', label: 'Processing' },
  { value: 'shipped', color: 'cyan', label: 'Shipped' },
  { value: 'delivered', color: 'green', label: 'Delivered' },
  { value: 'cancelled', color: 'red', label: 'Cancelled' }
];

const TRANSACTION_CATEGORIES = [
  { value: 'income', label: 'Income', icon: <DollarOutlined /> },
  { value: 'expense', label: 'Expense', icon: <ShoppingCartOutlined /> },
  { value: 'cost_of_services', label: 'Cost of Services', icon: <InfoCircleOutlined /> },
];

const CreateOrderModal = ({ open, onClose, onOrderCreated, customers, currentUser, scannedProduct }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [orderItems, setOrderItems] = useState([]);        
  const [products, setProducts] = useState([]);
  const [fetchingProducts, setFetchingProducts] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  useEffect(() => {
    if (open && currentUser) {
      form.setFieldsValue({
        sales_rep_id: currentUser.id,
        sales_rep_name: `${currentUser.firstName} ${currentUser.lastName}`
      });
    }
  }, [open, currentUser, form]);

  const totalPrice = useMemo(() => {
    return orderItems.reduce((total, item) => total + (parseFloat(item.unit_price || 0) * (item.quantity || 0)), 0);
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
      if (Array.isArray(fetchedProducts.results)) {
        setProducts(fetchedProducts.results);
      } else if (Array.isArray(fetchedProducts)) {
        setProducts(fetchedProducts);
      } else {
        console.error('Unexpected product data structure:', fetchedProducts);
        setProducts([]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      message.error('Failed to fetch products. Please try again.');
      setProducts([]);
    } finally {
      setFetchingProducts(false);
    }
  };

  const handleScannedProduct = (scannedItem) => {
    setOrderItems(prevItems => [...prevItems, {
      ...scannedItem,
      tempId: `${scannedItem.product_id}-${Date.now()}`
    }]);
    message.success({
      content: 'Product added successfully',
      icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />
    });
  };

  useEffect(() => {
    if (scannedProduct && open) {
      const existingItemIndex = orderItems.findIndex(
        item => item.product_id === scannedProduct.product_id
      );

      if (existingItemIndex >= 0) {
        setOrderItems(prevItems => {
          const newItems = [...prevItems];
          newItems[existingItemIndex].quantity += scannedProduct.quantity;
          return newItems;
        });
      } else {
        setOrderItems(prevItems => [...prevItems, {
          ...scannedProduct,
          tempId: `${scannedProduct.product_id}-${Date.now()}`
        }]);
      }
    }
  }, [scannedProduct, open]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      
      if (orderItems.length === 0) {
        message.error('Please add at least one product to the order.');
        return;
      }

      setLoading(true);
      
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

      await onOrderCreated(orderData);
      message.success({
        content: 'Order created successfully',
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />
      });
      onClose();
    } catch (err) {
      console.error('Error creating order:', err);
      if (err.errorFields) {
        // Form validation error
        return;
      }
      message.error(err.message || 'An error occurred while creating the order.');
    } finally {
      setLoading(false);
    }
  }, [form, orderItems, currentUser, onOrderCreated, onClose]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && event.ctrlKey) {
      handleSubmit();
    }
    if (event.key === 'Escape') {
      onClose();
    }
  }, [handleSubmit, onClose]);

  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [open, handleKeyDown]);

  const handleAddProduct = () => {
    setOrderItems([...orderItems, { 
      product_id: null, 
      quantity: 1, 
      unit_price: '0', 
      status: 'pending',
      tempId: `new-item-${Date.now()}`
    }]);
  };

  const handleProductChange = (value, index) => {
    const selectedProduct = products.find(p => p.id === value);
    if (!selectedProduct) {
      message.error(`Product with id ${value} not found. Please select a valid product.`);
      return;
    }

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
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleProductChange(v, index)}
          placeholder="Select product"
          loading={fetchingProducts}
          disabled={fetchingProducts}
          showSearch
          optionFilterProp="children"
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
      width: 120,
      render: (value, _, index) => (
        <InputNumber
          min={1}
          value={value}
          onChange={(v) => handleQuantityChange(v, index)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Unit Price',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 120,
      render: (value) => formatCurrency(value),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (value, _, index) => (
        <Select
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleStatusChange(v, index)}
        >
          {STATUS_OPTIONS.map(status => (
            <Option key={status.value} value={status.value}>
              <Tag color={status.color}>{status.label}</Tag>
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Subtotal',
      key: 'subtotal',
      width: 120,
      render: (_, record) => {
        const subtotal = (parseFloat(record.unit_price || 0) * (record.quantity || 0));
        return formatCurrency(subtotal);
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      render: (_, __, index) => (
        <Button 
          type="text" 
          danger
          onClick={() => handleRemoveProduct(index)} 
          icon={<DeleteOutlined />}
        />
      ),
    },
  ];

  // Make columns responsive based on screen size
  const getResponsiveColumns = () => {
    // Get window width (with SSR check)
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    
    if (windowWidth < 768) {
      // Mobile view: Hide some columns and adjust widths
      return columns.filter(col => !['status'].includes(col.key));
    }
    
    return columns;
  };

  // If modal is not open, don't render anything
  if (!open) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="100%"
      style={{ top: 0, padding: 0, maxWidth: '100%' }}
      bodyStyle={{ height: '100vh', padding: 0, overflow: 'auto' }}
      closable={false}
      maskClosable={false}
      destroyOnClose
      className="full-screen-modal"
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Header 
          style={{ 
            padding: '0 16px', 
            backgroundColor: '#fff', 
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            position: 'sticky', 
            top: 0, 
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ShoppingCartOutlined style={{ fontSize: '20px', marginRight: '12px' }} />
            <Title level={4} style={{ margin: 0 }}>Create New Order</Title>
          </div>
          <Space>
            <Button
              onClick={onClose}
              icon={<CloseOutlined />}
            >
              Cancel
            </Button>
            <Button 
              type="primary" 
              onClick={handleSubmit} 
              loading={loading}
              disabled={orderItems.length === 0}
            >
              Create Order
            </Button>
          </Space>
        </Header>
        
        <Content style={{ padding: '16px', backgroundColor: '#f0f2f5' }}>
          <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginBottom: '60px' }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card 
                  size="small" 
                  title={<><UserOutlined /> Order Information</>}
                >
                  <Form.Item 
                    name="sales_rep_name" 
                    label="Sales Representative"
                  >
                    <Input
                      disabled
                      value={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'N/A'}
                      prefix={<UserOutlined />}
                    />
                  </Form.Item>

                  <Form.Item name="customer_id" label="Customer">
                    <Select 
                      placeholder="Select customer (optional)"
                      allowClear
                      showSearch
                      optionFilterProp="children"
                    >
                      {customers.map(customer => (
                        <Select.Option key={customer.id} value={customer.id}>
                          {`${customer.first_name} ${customer.last_name}`}
                        </Select.Option>
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
                        <Select.Option key={category.value} value={category.value}>
                          {category.icon} {category.label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Card>
              </Col>
              
              <Col xs={24} md={12}>
                <Card 
                  size="small" 
                  title={<><InfoCircleOutlined /> Order Details</>}
                >
                  <Form.Item
                    name="status"
                    label="Order Status"
                    rules={[{ required: true, message: 'Please select an order status' }]}
                  >
                    <Select placeholder="Select order status">
                      {STATUS_OPTIONS.map(status => (
                        <Select.Option key={status.value} value={status.value}>
                          <Badge color={status.color} text={status.label} />
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item name="special_instructions" label="Special Instructions">
                    <TextArea rows={3} placeholder="Enter any special instructions or notes" />
                  </Form.Item>
                </Card>
              </Col>
            </Row>

            <Card 
              title={<Space><ShoppingCartOutlined /> Order Items</Space>}
              style={{ marginTop: '16px' }}
              extra={
                <Space wrap>
                  <Button
                    type="primary"
                    ghost
                    onClick={handleAddProduct}
                    icon={<PlusOutlined />}
                  >
                    Add Product
                  </Button>
                  <Button
                    onClick={() => setIsQRScannerOpen(true)}
                    icon={<QrcodeOutlined />}
                  >
                    Scan QR Code
                  </Button>
                </Space>
              }
            >
              <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <Table
                  dataSource={orderItems}
                  columns={getResponsiveColumns()}
                  pagination={false}
                  rowKey={(record) => record.tempId || record.product_id}
                  bordered
                  size="small"
                  locale={{ emptyText: 'No products added yet' }}
                  scroll={{ x: 'max-content' }}
                />
              </div>
            </Card>

            <Card style={{ marginTop: '16px' }}>
              <Row justify="space-between" align="middle">
                <Col xs={24} sm={12}>
                  <Space direction={window.innerWidth < 576 ? 'vertical' : 'horizontal'} size="small">
                    <Text type="secondary">
                      <UserOutlined /> Sales Rep: {currentUser?.first_name} {currentUser?.last_name}
                    </Text>
                    {orderItems.length > 0 && (
                      <Text type="secondary">
                        <ShoppingCartOutlined /> Items: {orderItems.length}
                      </Text>
                    )}
                  </Space>
                </Col>
                <Col xs={24} sm={12} style={{ textAlign: 'right', marginTop: window.innerWidth < 576 ? '16px' : 0 }}>
                  <Title level={4} style={{ margin: 0 }}>
                    Total: {formatCurrency(totalPrice)}
                  </Title>
                </Col>
              </Row>
            </Card>
          </Form>
        </Content>
        
        <Footer 
          style={{ 
            padding: '10px 16px', 
            textAlign: 'right', 
            backgroundColor: '#fff',
            position: 'fixed',
            bottom: 0,
            width: '100%',
            boxShadow: '0 -1px 4px rgba(0,0,0,0.15)',
            zIndex: 1000
          }}
        >
          <Space>
            <Button onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="primary" 
              onClick={handleSubmit} 
              loading={loading}
              disabled={orderItems.length === 0}
            >
              Create Order
            </Button>
          </Space>
        </Footer>
      </Layout>

      <QRScannerModal
        open={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScan={handleScannedProduct}
        products={products}
      />
    </Modal>
  );
};

export default CreateOrderModal;

import React, { useState, useMemo, useEffect } from 'react';
import { Modal, Typography, Descriptions, Table, Input, Button, message, Card, Space } from 'antd';
import { ShoppingCartOutlined, UserOutlined, EnvironmentOutlined, DollarOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const OrderDetailsModal = ({ open, onClose, order, onApplyPromotion }) => {
  console.log('OrderDetailsModal rendered with order:', JSON.stringify(order, null, 2));
  const [promotionCode, setPromotionCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('OrderDetailsModal received updated order:', JSON.stringify(order, null, 2));
  }, [order]);

  const handleApplyPromotion = async () => {
    if (!promotionCode.trim()) {
      message.error('Please enter a promotion code');
      return;
    }
    setLoading(true);
    try {
      await onApplyPromotion(order.id, promotionCode);
      message.success('Promotion applied successfully');
      setPromotionCode('');
    } catch (err) {
      message.error(err.message || 'An error occurred while applying the promotion.');
    } finally {
      setLoading(false);
    }
  };

  const orderItems = useMemo(() => {
    console.log('Processing order items:', order?.items);
    return (order?.items || []).map(item => ({
      ...item,
      key: item.id || item.product?.id || Math.random().toString(),
      product_name: item.product?.name || 'N/A',
      unit_price: item.unit_price || item.product?.price || 0,
      quantity: item.quantity || 0
    }));
  }, [order?.items]);

  const totalPrice = useMemo(() => {
    console.log('Calculating total price, order items:', orderItems);
    const calculatedTotal = orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    console.log('Calculated total price:', calculatedTotal);
    return calculatedTotal || order?.total_price || 0;
  }, [orderItems, order?.total_price]);

  if (!order) {
    console.log('No order data provided to OrderDetailsModal');
    return null;
  }

  const columns = [
    {
      title: 'Product',
      dataIndex: 'product_name',
      key: 'product',
      render: (name) => name || 'N/A',
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: 'Unit Price',
      dataIndex: 'unit_price',
      key: 'unit_price',
      render: (price) => `$${parseFloat(price).toFixed(2)}`,
    },
    {
      title: 'Total',
      key: 'total',
      render: (_, record) => `$${(record.quantity * record.unit_price).toFixed(2)}`,
    },
  ];

  return (
    <Modal
      title={<Title level={3}><ShoppingCartOutlined /> Order Details - Order #{order.id}</Title>}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      width={800}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Customer Information */}
        <Card>
          <Descriptions title={<Title level={4}><UserOutlined /> Customer Information</Title>} column={1}>
            <Descriptions.Item label="Name">{`${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Email">{order.customer?.email || 'N/A'}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Order Information */}
        <Card>
          <Descriptions title={<Title level={4}><ShoppingCartOutlined /> Order Information</Title>} column={1}>
            <Descriptions.Item label="Date">{order.order_date ? new Date(order.order_date).toLocaleDateString() : 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Status">{order.status || 'N/A'}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Addresses */}
        <Card>
          <Descriptions title={<Title level={4}><EnvironmentOutlined /> Addresses</Title>} column={1}>
            <Descriptions.Item label="Shipping Address">{order.shipping_address || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Billing Address">{order.billing_address || 'N/A'}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Special Instructions */}
        {order.special_instructions && (
          <Card>
            <Descriptions title={<Title level={4}>Special Instructions</Title>} column={1}>
              <Descriptions.Item>{order.special_instructions}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {/* Order Items */}
        <Card>
          <Title level={4}><DollarOutlined /> Order Items</Title>
          <Table
            columns={columns}
            dataSource={orderItems}
            rowKey="key"
            pagination={false}
          />
          {orderItems.length === 0 && <Text>No items in this order</Text>}
        </Card>

        {/* Total Price */}
        <Card>
          <Descriptions>
            <Descriptions.Item label="Total Price">
              <Text strong>${totalPrice.toFixed(2)}</Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Apply Promotion */}
        <Card>
          <Title level={4}>Apply Promotion</Title>
          <Input.Group compact>
            <Input
              style={{ width: 'calc(100% - 100px)' }}
              value={promotionCode}
              onChange={(e) => setPromotionCode(e.target.value)}
              placeholder="Enter promotion code"
            />
            <Button type="primary" onClick={handleApplyPromotion} loading={loading}>
              Apply
            </Button>
          </Input.Group>
        </Card>
      </Space>
    </Modal>
  );
};

export default OrderDetailsModal;

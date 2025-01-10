import React, { useState, useEffect, useCallback } from 'react';
import { useOrders } from '../context/OrderContext';
import { fetchProducts, fetchCustomers, fetchOrders, fetchCurrentUser } from '../services/api';
import CreateOrderModal from '../modals/CreateOrderModal';
import OrderDetailsModal from '../modals/OrderDetailsModal';
import { format } from 'date-fns';
import { debounce } from 'lodash';
import {
  Table,
  Input,
  Button,
  Select,
  Alert,
  Pagination,
  message,
  Space,
  Spin,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';

const { Search } = Input;
const { Option } = Select;

const OrdersPage = () => {
  const {
    orders,
    totalOrders,
    loading,
    error,
    fetchOrders,
    addOrder,
    deleteOrders,
    applyPromotion,
    reorderOrder
  } = useOrders();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(10);
  const [customers, setCustomers] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [products, setProducts] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [sortField, setSortField] = useState('order_date');
  const [sortDirection, setSortDirection] = useState('descend');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        console.log('Fetching customers, products, and current user...');
        const [customersData, productsData, userData] = await Promise.all([
          fetchCustomers(),
          fetchProducts(),
	  fetchCurrentUser()
        ]);
        
        
        console.log('Current user data structure:', {
          hasData: !!userData,
          properties: userData ? Object.keys(userData) : [],
          fullData: userData
        });

        setCurrentUser(userData);

        setCustomers(customersData);

        // Format products data
        let formattedProducts;
        if (Array.isArray(productsData)) {
          formattedProducts = productsData;
        } else if (productsData && productsData.results && Array.isArray(productsData.results)) {
          formattedProducts = productsData.results;
        } else {
          formattedProducts = Object.values(productsData).filter(product =>
            product && typeof product === 'object' && product.id && product.name && product.price
          );
        }

	// Ensure price is a number
        formattedProducts = formattedProducts.map(product => ({
          ...product,
          price: parseFloat(product.price)
        }));

        console.log('Formatted products:', JSON.stringify(formattedProducts, null, 2));
        
        if (formattedProducts.length === 0) {
          console.warn('No products found or failed to format products data');
          message.warning('No products available. Please check the product data.');
        }

        setProducts(formattedProducts);
      } catch (error) {
        console.error('Error fetching data:', error);
        message.error('Failed to fetch necessary data. Please try again.');
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, []);

  const fetchOrdersWithParams = useCallback(() => {
    const params = {
      page: currentPage,
      page_size: 10,
      search: searchTerm,
      status: statusFilter,
      ordering: `${sortDirection === 'descend' ? '-' : ''}${sortField}`,
    };
    fetchOrders(params);
  }, [currentPage, searchTerm, statusFilter, sortDirection, sortField, fetchOrders]);

  useEffect(() => {
    fetchOrdersWithParams();
  }, [fetchOrdersWithParams]);

  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearchTerm(value);
      setCurrentPage(1);
    }, 300),
    []
  );

  const handleSearchChange = (value) => {
    debouncedSearch(value);
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleTableChange = (pagination, filters, sorter) => {
    setSortField(sorter.field);
    setSortDirection(sorter.order);
    setCurrentPage(pagination.current);
  };

  const handleAddNewOrder = () => {
    console.log('Customers:', customers);
    console.log('Products:', products);

    if (!currentUser) {
        message.error('Unable to create order: Current user information not available');
        return;
    }
    if (customers.length === 0 || products.length === 0) {
      message.error('Unable to create order: Current user information not available');
      return;
    }
    setIsCreateModalOpen(true);
  };

  const handleOrderCreated = async (newOrder) => {
    try {
        const orderWithSalesRep = {
            ...newOrder,
            sales_rep: currentUser.id
        };

        await addOrder(orderWithSalesRep);
        setIsCreateModalOpen(false);
        message.success('Order created successfully');
        setCurrentPage(1);
        
        await fetchOrders({
            page: 1,
            search: searchTerm,
            status: statusFilter,
            ordering: `${sortDirection === 'descend' ? '-' : ''}${sortField}`
        });
    } catch (error) {
        console.error('Order creation error:', error);
        message.error('Error creating order: ' + (error.message || 'An unexpected error occurred'));
    }
  };

  const handleOrderClick = (order) => {
    if (order && order.customer && order.items) {
      setSelectedOrder(order);
      setIsDetailsModalOpen(true);
    } else {
      message.error('Unable to view order details. Some data is missing.');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await deleteOrders(selectedRowKeys);
      setSelectedRowKeys([]);
      fetchOrders({
        page: currentPage,
        search: searchTerm,
        status: statusFilter,
        ordering: `${sortDirection === 'descend' ? '-' : ''}${sortField}`
      });
      message.success('Orders deleted successfully');
    } catch (error) {
      message.error('Error deleting orders: ' + error.message);
    }
  };

  const handleApplyPromotion = async (orderId, promotionCode) => {
    try {
      await applyPromotion(orderId, promotionCode);
      fetchOrders({
        page: currentPage,
        search: searchTerm,
        status: statusFilter,
        ordering: `${sortDirection === 'descend' ? '-' : ''}${sortField}`
      });
      message.success('Promotion applied successfully');
    } catch (error) {
      message.error('Error applying promotion: ' + error.message);
    }
  };

  const handleReorder = async (orderId) => {
    try {
      await reorderOrder(orderId);
      fetchOrders({
        page: currentPage,
        search: searchTerm,
        status: statusFilter,
        ordering: `${sortDirection === 'descend' ? '-' : ''}${sortField}`
      });
      message.success('Order reordered successfully');
    } catch (error) {
      message.error('Error reordering: ' + error.message);
    }
  };

  const columns = [
    {
      title: 'Order ID',
      dataIndex: 'id',
      sorter: true,
    },
    {
      title: 'Sales Representative',
      dataIndex: 'sales_rep_name',
      key: 'sales_rep_name',
      render: (sales_rep_name, record) => {
        // First try to use the sales_rep_name from the backend
        if (sales_rep_name && sales_rep_name !== 'N/A') {
          return sales_rep_name;
        }
    
        // If no sales_rep_name, use the current user's information
        if (currentUser) {
          const name = `${currentUser.firstName} ${currentUser.lastName}`.trim();
          return name || currentUser.username || 'N/A';
        }
    
        return 'N/A';
      }
    },
    {
      title: 'Customer Name',
      dataIndex: ['customer', 'first_name'],
      render: (_, record) => record.customer ? `${record.customer.first_name || ''} ${record.customer.last_name || ''}`.trim() || 'N/A' : 'N/A',
      sorter: true,
    },
    {
      title: 'Transaction Category',
      dataIndex: 'transaction_category',
      key: 'transaction_category',
      render: (text) => text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, ' '),
    },
    {
      title: 'Date',
      dataIndex: 'order_date',
      render: (date) => format(new Date(date), 'PPP'),
      sorter: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status) => status || 'N/A',
      sorter: true,
    },
    {
      title: 'Total Amount',
      dataIndex: 'total_price',
      key: 'total_price',
      render: (totalPrice, record) => {
        console.log('Rendering total price for order:', record);
        const calculatedTotal = (record.items || []).reduce((sum, item) =>
          sum + (item.quantity * (parseFloat(item.unit_price) || 0)), 0
        );
        console.log('Calculated total:', calculatedTotal);
        return `$${(calculatedTotal || totalPrice || 0).toFixed(2)}`;
      },
      sorter: true,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => handleOrderClick(record)}
          >
            View Details
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => handleReorder(record.id)}
          >
            Reorder
          </Button>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
  };

  if (loading || loadingData) {
    return <Spin size="large" />;
  }

  if (error) {
    return (
      <Alert
        message="Error"
        description={`Failed to load orders: ${error}`}
        type="error"
        showIcon
      />
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Orders</h1>

      <Space style={{ marginBottom: '16px' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddNewOrder}
          disabled={loadingData || customers.length === 0 || products.length === 0}
        >
          Add New Order
        </Button>
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={handleBulkDelete}
          disabled={selectedRowKeys.length === 0}
        >
          Delete Selected
        </Button>
      </Space>

      <Space style={{ marginBottom: '16px' }}>
        <Search
          placeholder="Search orders..."
          onSearch={handleSearchChange}
          style={{ width: 200 }}
        />
        <Select
          style={{ width: 200 }}
          placeholder="Filter by status"
          onChange={handleStatusFilterChange}
          value={statusFilter}
        >
          <Option value="">All Statuses</Option>
          <Option value="pending">Pending</Option>
          <Option value="processing">Processing</Option>
          <Option value="shipped">Shipped</Option>
          <Option value="delivered">Delivered</Option>
          <Option value="cancelled">Cancelled</Option>
        </Select>
      </Space>

      <Table
        dataSource={orders}
        columns={columns}
        rowSelection={{
          selectedRowKeys,
          onChange: (selectedRowKeys) => setSelectedRowKeys(selectedRowKeys),
        }}
        onChange={handleTableChange}
        pagination={false}
        loading={loading}
        rowKey={(record) => record.id}
      />

      <Pagination
        current={currentPage}
        total={totalOrders}
        pageSize={10}
        onChange={(page) => setCurrentPage(page)}
        style={{ marginTop: '16px', textAlign: 'right' }}
	showSizeChanger={false}
      />

      <CreateOrderModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onOrderCreated={handleOrderCreated}
        customers={customers}
        products={products}
	currentUser={currentUser}
      />

      {selectedOrder && (
        <OrderDetailsModal
          open={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          order={selectedOrder}
          onApplyPromotion={handleApplyPromotion}
        />
      )}
    </div>
  );
};

export default OrdersPage;

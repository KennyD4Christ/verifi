import React, { useState, useEffect, useCallback } from 'react';
import { useOrders } from '../context/OrderContext';
import { fetchProducts, fetchCustomers, fetchOrders, fetchCurrentUser, addScannedItemToOrder } from '../services/api';
import CreateOrderModal from '../modals/CreateOrderModal';
import OrderDetailsModal from '../modals/OrderDetailsModal';
import { format } from 'date-fns';
import { formatCurrency } from '../utils/dataTransformations';
import styled, { ThemeProvider } from 'styled-components';
import { ScanOutlined } from '@ant-design/icons';
import { fetchProductByBarcode } from '../services/api';
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
  Col,
  Row
} from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';

const { Search } = Input;
const { Option } = Select;

const getThemeValue = (path, fallback) => props => {
  const value = path.split('.').reduce((acc, part) => {
    if (acc && acc[part] !== undefined) return acc[part];
    return undefined;
  }, props.theme);

  return value !== undefined ? value : fallback;
};

const PageContainer = styled.div`
  padding: 2rem;
  height: 100%;
  min-height: calc(100vh - var(--header-height, 64px));
  background-color: ${getThemeValue('colors.background', '#ffffff')};
  color: ${getThemeValue('colors.text.primary', '#2d3748')};

  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`;

const PageHeader = styled.h1`
  color: ${getThemeValue('colors.text.primary', '#2d3748')};
  margin-bottom: 2.5rem;
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  border-bottom: 2px solid ${getThemeValue('colors.border', '#e2e8f0')};
  padding-bottom: 1rem;

  @media (max-width: 768px) {
    text-align: center;
  }
`;

const ActionBar = styled(Row)`
  margin-bottom: 16px;
  gap: 8px;

  @media (max-width: 576px) {
    .ant-space {
      flex-direction: column;
      width: 100%;
    }

    .ant-btn {
      width: 100%;
    }
  }
`;

const ActionButton = styled.button`
  background-color: ${props => {
    switch (props.variant) {
      case 'danger':
        return getThemeValue('colors.danger', '#e53e3e');
      case 'info':
        return getThemeValue('colors.info', '#3182ce');
      case 'warning':
        return getThemeValue('colors.warning', '#dd6b20');
      default:
        return getThemeValue('colors.primary', '#1a365d');
    }
  }};
  color: white;
  border: none;
  border-radius: ${props => (props.size === 'sm' ? '8px' : '12px')};
  padding: ${props =>
    props.size === 'sm' ? '0.5rem 1rem' : '0.75rem 1.5rem'};
  font-weight: 500;
  cursor: pointer;
  transition: ${getThemeValue('transitions.standard', 'all 0.2s ease-in-out')};
  font-size: ${props => (props.size === 'sm' ? '0.75rem' : '0.875rem')};
  letter-spacing: 0.025em;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &:hover:not(:disabled) {
    background-color: ${props => {
      switch (props.variant) {
        case 'danger':
          return getThemeValue('colors.dangerHover', '#c53030');
        case 'info':
          return getThemeValue('colors.infoHover', '#3182ce');
        case 'warning':
          return getThemeValue('colors.warningHover', '#c05621');
        default:
          return getThemeValue('colors.secondary', '#87CEFA');
      }
    }};
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    transform: none;
    box-shadow: none;
  }
`;

const FilterBar = styled.div`
  margin-bottom: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  align-items: center;
  background-color: ${getThemeValue('colors.surface', '#f7fafc')};
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
`;

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin-bottom: 1.5rem;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  background-color: ${getThemeValue('colors.surface', '#f7fafc')};
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};

  @media (max-width: 768px) {
    margin: 0 -1.5rem;
    width: calc(100% + 3rem);
    border-radius: 0;
  }

  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: ${getThemeValue('colors.surface', '#f7fafc')};
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${getThemeValue('colors.border', '#e2e8f0')};
    border-radius: 4px;

    &:hover {
      background: ${getThemeValue('colors.text.secondary', '#4a5568')};
    }
  }
`;

const ResponsiveTable = styled(Table)`
  .ant-table {
    overflow-x: auto;
    &-content {
      overflow-x: auto;
    }
  }

  @media (max-width: 768px) {
    .ant-table-cell {
      padding: 8px;
      white-space: nowrap;

      &::before {
        min-width: 80px;
        display: inline-block;
      }
    }
  }
`;

const PaginationContainer = styled.div`
    width: 100%;
  margin-top: auto;
  padding: 1rem;
  background-color: ${getThemeValue('colors.surface', '#f7fafc')};
  border-radius: 4px;
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};

  @media (max-width: 768px) {
    border-radius: 0;
    margin: 0 -1.5rem;
    width: calc(100% + 3rem);
  }
`;

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
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [lastScanTime, setLastScanTime] = useState(0);
  const [scannedProduct, setScannedProduct] = useState(null);

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

  const handleBarcodeInput = useCallback(async (event) => {
    const currentTime = Date.now();
    const SCAN_TIMEOUT = 100; // Configure timeout for manual vs scanner input

    // Debounce manual input
    if (currentTime - lastScanTime > SCAN_TIMEOUT) {
      setBarcodeBuffer('');
    }
    setLastScanTime(currentTime);

    try {
      if (event.key === 'Enter' && barcodeBuffer) {
        const product = await fetchProductByBarcode(barcodeBuffer);
      
        if (product) {
          setScannedProduct({
            product_id: product.id,
            quantity: 1,
            unit_price: product.price,
            status: 'pending'
          });
          setIsCreateModalOpen(true);
          message.success(`Product found: ${product.name}`);
        } else {
          message.error('No product found for barcode: ' + barcodeBuffer);
        }
        setBarcodeBuffer('');
      } else if (event.key.length === 1 && /[\d]/.test(event.key)) {
        // Only add numeric characters to buffer
        setBarcodeBuffer(prev => prev + event.key);
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
      message.error('Failed to process barcode scan');
      setBarcodeBuffer('');
    }
  }, [barcodeBuffer, lastScanTime]);

  useEffect(() => {
    const handleKeyPress = (event) => handleBarcodeInput(event);
    window.addEventListener('keypress', handleKeyPress);
  
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      // Clear any pending state
      setBarcodeBuffer('');
      setLastScanTime(0);
    };
  }, [handleBarcodeInput]); 

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

  const handleScannedItem = async (orderId, scannedData) => {
    try {
      const result = await addScannedItemToOrder(orderId, scannedData);
      message.success('Item successfully added to order');
      
      // Refresh the orders list to show updated data
      await fetchOrdersWithParams();
      
      // If the scanned item was added to the currently selected order, update it
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => ({
          ...prev,
          items: [...prev.items, result.scanned_items[result.scanned_items.length - 1]]
        }));
      }
    } catch (error) {
      console.error('Error adding scanned item:', error);
      message.error('Failed to add scanned item: ' + error.message);
    }
  };

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
        const calculatedTotal = (record.items || []).reduce((sum, item) =>
          sum + (item.quantity * (parseFloat(item.unit_price) || 0)), 0
        );
        return formatCurrency(calculatedTotal || totalPrice || 0);
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
    <PageContainer>
      <PageHeader>Orders</PageHeader>
      
      <ActionBar>
        <Col xs={24} sm={24} md={24}>
          <Space wrap>
            <ActionButton
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddNewOrder}
              disabled={loadingData || customers.length === 0 || products.length === 0}
            >
              Add New Order
            </ActionButton>
	    <ActionButton
              type="primary"
              icon={<ScanOutlined />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Scan Product
            </ActionButton>
            <ActionButton
              danger
              icon={<DeleteOutlined />}
              onClick={handleBulkDelete}
              disabled={selectedRowKeys.length === 0}
            >
              Delete Selected
            </ActionButton>
          </Space>
        </Col>
      </ActionBar>

      <FilterBar>
        <Col xs={24} sm={24} md={24}>
          <Space wrap>
            <Search
              placeholder="Search orders..."
              onSearch={handleSearchChange}
              style={{ minWidth: '200px' }}
            />
            <Select
              style={{ minWidth: '200px' }}
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
        </Col>
      </FilterBar>

      <TableWrapper>
      <ResponsiveTable
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
        scroll={{ x: 'max-content' }}
      />
      </TableWrapper>

      <PaginationContainer>
        <Pagination
          current={currentPage}
          total={totalOrders}
          pageSize={10}
          onChange={(page) => setCurrentPage(page)}
          showSizeChanger={false}
        />
      </PaginationContainer>

      <CreateOrderModal
        open={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setScannedProduct(null);
        }}
        onOrderCreated={handleOrderCreated}
	onScannedItem={handleScannedItem}
        customers={customers}
        products={products}
        currentUser={currentUser}
	scannedProduct={scannedProduct}
      />
      
      {selectedOrder && (
        <OrderDetailsModal
          open={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          order={selectedOrder}
          onApplyPromotion={handleApplyPromotion}
	  onScannedItem={(scannedData) => handleScannedItem(selectedOrder.id, scannedData)}
        />
      )}
    </PageContainer>
  );
};

export default OrdersPage;

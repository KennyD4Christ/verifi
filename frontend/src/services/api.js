import axios from 'axios';
import { isTokenPresent, getAuthHeader } from '../utils/auth';

const BASE_URL = 'http://localhost:8000/api'

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Clear local storage and redirect to login
const handleUnauthorized = () => {
  localStorage.removeItem('token');
  window.location.href = '/login';
};

// Request interceptor to add Authorization header if authenticated
axiosInstance.interceptors.request.use(
  config => {
    if (isTokenPresent()) {
      const authHeader = getAuthHeader();
      if (authHeader) {
	config.headers.Authorization = authHeader;
      }
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor to handle authentication errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      switch (error.response.status) {
	case 401:
	case 403:
          handleUnauthorized();
	  break;
	default:
	  console.error('API error:', error.response.data);
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;

// Function to create an order
export const createOrder = async (orderData) => {
  try {
    console.log('Sending order data:', JSON.stringify(orderData, null, 2));
    const response = await axiosInstance.post('/core/orders/', orderData);
    console.log('API Response for create order:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating order:', error.response?.data || error.message);
    if (error.response?.data?.errors) {
      const errorMessages = Object.entries(error.response.data.errors)
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
        .join('; ');
      throw new Error(errorMessages);
    } else if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    } else if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw error;
  }
};

// Function to fetch orders
export const fetchOrders = async () => {
  try {
    const response = await axiosInstance.get('/core/orders/', {
      params: {
        include_items: true
      }
    });
    console.log('API Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching orders:', error.response?.data || error.message);
    throw error;
  }
};

// Function to delete an order
export const deleteOrder = async (orderId) => {
  try {
    await axiosInstance.delete(`/core/orders/${orderId}/`);
  } catch (error) {
    console.error('Error deleting order:', error.response?.data || error.message);
    throw error;
  }
};

// Function to apply a promotion to an order
export const applyPromotionToOrder = async (orderId, promotionCode) => {
  try {
    const response = await axiosInstance.post(`/core/orders/${orderId}/apply_promotion/`, { promotion_code: promotionCode });
    return response.data;
  } catch (error) {
    console.error('Error applying promotion:', error.response?.data || error.message);
    throw error;
  }
};

// Function to reorder an existing order
export const reorderExistingOrder = async (orderId) => {
  try {
    const response = await axiosInstance.post(`/core/orders/${orderId}/reorder/`);
    return response.data;
  } catch (error) {
    console.error('Error reordering:', error.response?.data || error.message);
    throw error;
  }
};

// Function to get order details
export const getOrderDetails = async (orderId) => {
  try {
    const response = await axiosInstance.get(`/core/orders/${orderId}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching order details:', error.response?.data || error.message);
    throw error;
  }
};

// Function to update an order
export const updateOrder = async (orderId, orderData) => {
  try {
    const response = await axiosInstance.put(`/core/orders/${orderId}/`, orderData);
    return response.data;
  } catch (error) {
    console.error('Error updating order:', error.response?.data || error.message);
    throw error;
  }
};

// Function to fetch order history
export const fetchOrderHistory = async (customerId) => {
  try {
    const response = await axiosInstance.get(`/core/orders/history/`, { params: { customer_id: customerId } });
    return response.data;
  } catch (error) {
    console.error('Error fetching order history:', error.response?.data || error.message);
    throw error;
  }
};

export const searchCustomers = async (query) => {
  try {
    const response = await axiosInstance.get(`/core/customers/search/?query=${query}`);
    return response.data.map(customer => ({
      value: customer.id,
      label: `${customer.first_name} ${customer.last_name} (${customer.email})`
    }));
  } catch (error) {
    console.error('Error searching customers:', error.response?.data || error.message);
    throw error;
  }
};

// Function to get a single customer by ID
export const getCustomerById = async (customerId) => {
  try {
    const response = await axiosInstance.get(`/core/customers/${customerId}/`);
    const customer = response.data;
    return {
      value: customer.id,
      label: `${customer.first_name} ${customer.last_name} (${customer.email})`
    };
  } catch (error) {
    console.error('Error fetching customer:', error.response?.data || error.message);
    throw error;
  }
};


// Function to fetch customers
export const fetchCustomers = async () => {
  try {
    const response = await axiosInstance.get('/core/customers/');
    return response.data;
  } catch (error) {
    console.error('Error fetching customers:', error.response?.data || error.message);
    throw error;
  }
};

// Function to create customers
export const createCustomer = async (customer) => {
  try {
    if (!customer.first_name) throw new Error('First name is required');
    if (!customer.last_name) throw new Error('Last name is required');
    if (!customer.email) throw new Error('Email is required');
    
    console.log('Sending customer data:', customer);
    const response = await axiosInstance.post('/core/customers/', customer);
    console.log('Server response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating customer:', error.response?.data || error.message);
    throw error;
  }
};

// Function to update customers
export const updateCustomer = async (id, customer) => {
  try {
    if (!id || !customer) {
      throw new Error('Customer ID and updated data are required');
    }
    if (!customer.first_name || !customer.last_name) {
      throw new Error('First name and last name are required');
    }
    console.log('Updating customer with data:', customer);
    const response = await axiosInstance.put(`/core/customers/${id}/`, customer);
    return response.data;
  } catch (error) {
    console.error('Error updating customer:', error.response?.data || error.message);
    throw error;
  }
};

// Function to delete customers
export const deleteCustomer = async (id) => {
  try {
    if (!id) {
      throw new Error('Customer ID is required');
    }
    await axiosInstance.delete(`/core/customers/${id}/`);
  } catch (error) {
    console.error('Error deleting customer:', error.response?.data || error.message);
    
    throw error;
  }
};

// Function to create a new product
export const createProduct = async (productData) => {
  try {
    if (!productData.name || !productData.price || !productData.sku || !productData.stock) {
      throw new Error('Name, price, SKU, and stock are required for a product');
    }
    console.log('Sending request to:', `${BASE_URL}/products/products/`);
    console.log('Product data:', productData);
    const response = await axiosInstance.post('/products/products/', productData);
    return response.data;
  } catch (error) {
    console.error('Error creating product:', error.response?.data || error.message);
    throw error;
  }
};

export const fetchProducts = async (params = {}) => {
  try {
    const response = await axiosInstance.get('/products/products/', { params });
      if (response.status === 200) {
      return response.data;
    } else {
      throw new Error('Failed to fetch products');
    }
  } catch (error) {
    console.error('Error fetching products:', error.response?.data || error.message);
    throw error;
  }
};

// Function to bulk delete products
export const bulkDeleteProducts = async (productIds) => {
  try {
    const response = await axiosInstance.post('/products/products/bulk_delete/', { ids: productIds });
    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error('Failed to delete products');
    }
  } catch (error) {
    console.error('Error deleting products:', error.response?.data || error.message);
    throw error;
  }
};

// Function to export products as CSV
export const exportProductsCsv = async () => {
  try {
    const response = await axiosInstance.get('/products/products/export_csv/', {
      responseType: 'blob', // Important for file downloads
    });
    if (response.status === 200) {
      // Create a Blob from the response data
      const blob = new Blob([response.data], { type: 'text/csv' });
      // Create a link element and trigger the download
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = 'products_export.csv';
      link.click();
      return true;
    } else {
      throw new Error('Failed to export products as CSV');
    }
  } catch (error) {
    console.error('Error exporting products as CSV:', error.response?.data || error.message);
    throw error;
  }
};

// Function to export products as PDF
export const exportProductsPdf = async () => {
  try {
    const response = await axiosInstance.get('/products/products/export_pdf/', {
      responseType: 'blob', // Important for file downloads
    });
    if (response.status === 200) {
      // Create a Blob from the response data
      const blob = new Blob([response.data], { type: 'application/pdf' });
      // Create a link element and trigger the download
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = 'products_export.pdf';
      link.click();
      return true;
    } else {
      throw new Error('Failed to export products as PDF');
    }
  } catch (error) {
    console.error('Error exporting products as PDF:', error.response?.data || error.message);
    throw error;
  }
};

// Function to fetch product details
export const fetchProductDetails = async (productId) => {
  try {
    const response = await axiosInstance.get(`/products/products/${productId}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching product details:', error.response?.data || error.message);
    throw error;
  }
};


export const createStockAdjustment = async (data) => {
  try {
    // Ensure we're sending 'product' instead of 'product_id'
    const adjustmentData = {
      ...data,
      product: data.product_id || data.product,
    };
    
    // Remove product_id if it exists to avoid confusion
    delete adjustmentData.product_id;

    const response = await axiosInstance.post('/stock_adjustments/stock_adjustments/', adjustmentData);
    return response.data;
  } catch (error) {
    console.error('Error creating stock adjustment:', error);
    throw error;
  }
};

export const fetchStockAdjustments = async (params = {}) => {
  try {
    const response = await axiosInstance.get('/stock_adjustments/stock_adjustments/', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching stock adjustments:', error);
    throw error;
  }
};

export const fetchAdjustmentTypes = async () => {
  try {
    const response = await axiosInstance.get('/stock_adjustments/stock_adjustments/get_adjustment_types/');
    
    // Check if the response data is already an array
    if (Array.isArray(response.data)) {
      return response.data; // Directly return the array
    } else {
      console.error('Unexpected API response:', response.data);
      return []; // Return an empty array as a fallback
    }
  } catch (error) {
    console.error('Error fetching adjustment types:', error);
    return []; // Ensure it returns an empty array on error
  }
};

export const updateStockAdjustment = async (id, data) => {
  try {
    const response = await axiosInstance.put(`/stock_adjustments/stock_adjustments/${id}/`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating stock adjustment:', error);
    throw error;
  }
};

export const deleteStockAdjustment = async (id) => {
  try {
    await axiosInstance.delete(`/stock_adjustments/stock_adjustments/${id}/`);
  } catch (error) {
    console.error('Error deleting stock adjustment:', error);
    throw error;
  }
};

export const bulkDeleteStockAdjustments = async (ids) => {
  try {
    await axiosInstance.post('/stock_adjustments/stock_adjustments/bulk_delete/', { ids });
  } catch (error) {
    console.error('Error bulk deleting stock adjustments:', error);
    throw error;
  }
};

export const exportStockAdjustmentsCsv = async (params = {}) => {
  try {
    const response = await axiosInstance.get('/stock_adjustments/stock_adjustments/export_csv/', {
      params,
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    console.error('Error exporting stock adjustments to CSV:', error);
    throw error;
  }
};

export const exportStockAdjustmentsPdf = async (params = {}) => {
  try {
    const response = await axiosInstance.get('/stock_adjustments/stock_adjustments/export_pdf/', {
      params,
      responseType: 'blob',
    });
    
    // Create a blob from the response data
    const blob = new Blob([response.data], { type: 'application/pdf' });
    
    // Create a link element and trigger the download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'stock_adjustments.pdf');
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return response.data;
  } catch (error) {
    console.error('Error exporting stock adjustments to PDF:', error);
    throw error;
  }
};

// Function to update product stock
export const updateProductStock = async (productId, newStock) => {
  try {
    if (!productId || typeof newStock !== 'number') {
      throw new Error('Product ID and new stock value are required');
    }
    const response = await axiosInstance.patch(`/products/${productId}/`, {
      stock: newStock
    });
    return response.data;
  } catch (error) {
    console.error('Error updating product stock:', error.response?.data || error.message);
    throw error;
  }
};

// Helper function to format date for API requests
const formatDate = (date) => {
  if (!date) return '';
  if (typeof date === 'string') {
    // If it's already a string, assume it's in the correct format
    return date;
  }
  // Format as YYYY-MM-DD
  return date.toISOString().split('T')[0];
};

// Function to fetch Top product
export const fetchTopProducts = async (startDate, endDate) => {
  try {
    const params = {
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
    };

    console.log('Fetching top products with params:', params);
    const response = await axiosInstance.get('/products/top/', {
      headers: getAuthHeader(),
      params,
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching top products:', error.response?.data || error.message);
    throw error;
  }
};

// Function to fetch recent transaction
export const fetchRecentTransactions = async (startDate, endDate) => {
  try {
    const params = {
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
    };

    console.log('Fetching recent transactions with params:', params);
    const response = await axiosInstance.get('/transactions/recent/', {
      headers: getAuthHeader(),
      params,
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching recent transactions:', error.response?.data || error.message);
    throw error;
  }
};

// Function to fetch net profit data
export const fetchNetProfitData = async (startDate, endDate) => {
  try {

    const params = {
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
    };
    console.log('Fetching net profit data with params:', params);
    const response = await axiosInstance.get('/analytics/net-profit/', {
      headers: getAuthHeader(),
      params,
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching net profit data:', error.response?.data || error.message);
    throw error;
  }
};

// Function to fetch conversion rate data
export const fetchConversionRateData = async (startDate, endDate) => {
  try {

    const params = {
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
    };
    console.log('Fetching conversion rate data with params:', params);
    const response = await axiosInstance.get('/analytics/conversion-rate/', {
      headers: getAuthHeader(),
      params,
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching conversion rate data:', error.response?.data || error.message);
    throw error;
  }
}

export const fetchInventoryLevels = async (startDate, endDate) => {
  try {
    const params = {
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
    };
    console.log('Fetching inventory levels with params:', params);
    const response = await axiosInstance.get('/inventory/levels/', {
      headers: getAuthHeader(),
      params,
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching inventory levels:', error.response?.data || error.message);
    throw error;
  }
};

export const fetchCashFlow = async (startDate, endDate) => {
  try {
    const response = await axiosInstance.get('/finance/cash-flow/', {
      headers: getAuthHeader(),
      params: { start_date: startDate, end_date: endDate },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching cash flow:', error.response?.data || error.message);
    throw error;
  }
};

// Function to create an invoice
export const createInvoice = async (invoiceData) => {
  try {
    const response = await axiosInstance.post('/invoices/invoices/', invoiceData);
    console.log('API response for createInvoice:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating invoice:', error.response?.data || error.message);
    throw error;
  }
};

// Function to fetch invoices
export const fetchInvoices = async (params) => {
  console.log('fetchInvoices called with params:', params);
  try {
    console.log('Sending GET request to /invoices/invoices/');
    const response = await axiosInstance.get('/invoices/invoices/', { params });
    console.log('Raw response:', response);

    if (response.status !== 200) {
      throw new Error(`Unexpected status code: ${response.status}`);
    }

    if (!response.data) {
      throw new Error('Response data is undefined');
    }

    console.log('Invoices fetched successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in fetchInvoices:', error);
    throw error;
  }
};

// Function to fetch a specific invoice by ID
export const fetchInvoice = async (invoiceId) => {
  console.log(`Fetching invoice with ID: ${invoiceId}`);
  try {
    const response = await axiosInstance.get(`/invoices/invoices/${invoiceId}/`);
    console.log('Invoice fetched successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error(`Error fetching invoice ${invoiceId}:`, error.response?.data || error.message);
    throw error;
  }
};

// Function to update an invoice
export const updateInvoice = async (invoiceId, invoiceData) => {
  try {
    const response = await axiosInstance.put(`/invoices/invoices/${invoiceId}/`, invoiceData);
    return response.data;
  } catch (error) {
    console.error('Error updating invoice:', error.response?.data || error.message);
    throw error;
  }
};

// Function to fetch company information
export const fetchCompanyInfo = async () => {
  try {
    const response = await axiosInstance.get('/core/company-info/');
    // Assuming the API returns an array with a single company info object
    return response.data[0] || null;
  } catch (error) {
    console.error('Error fetching company info:', error.response?.data || error.message);
    throw error;
  }
};

// Function to update company information
export const updateCompanyInfo = async (companyInfo) => {
  try {
    let response;
    if (companyInfo.id) {
      // If the company info has an ID, update the existing record
      response = await axiosInstance.put(`/core/company-info/${companyInfo.id}/`, companyInfo);
    } else {
      // If there's no ID, create a new company info record
      response = await axiosInstance.post('/core/company-info/', companyInfo);
    }
    return response.data;
  } catch (error) {
    console.error('Error updating company info:', error.response?.data || error.message);
    throw error;
  }
};


// Function to delete an invoice
export const deleteInvoice = async (invoiceId) => {
  try {
    await axiosInstance.delete(`/invoices/invoices/${invoiceId}/`);
  } catch (error) {
    console.error('Error deleting invoice:', error.response?.data || error.message);
    throw error;
  }
};

// Function to generate PDF for an invoice
export const generateInvoicePDF = async (invoiceId) => {
  try {
    const response = await axiosInstance.get(`/invoices/invoices/${invoiceId}/generate_pdf/`, {
      responseType: 'blob'
    });
    
    if (response.data instanceof Blob) {
      return response.data;
    } else {
      console.error('Unexpected response type:', response.data);
      throw new Error('Invalid response type. Expected a Blob.');
    }
  } catch (error) {
    console.error('Error in generateInvoicePDF:', error);
    throw error;
  }
};

// Function to mark an invoice as paid
export const markInvoiceAsPaid = async (invoiceId) => {
  try {
    const response = await axiosInstance.post(`/invoices/invoices/${invoiceId}/mark_as_paid/`);
    return response.data;
  } catch (error) {
    console.error('Error marking invoice as paid:', error.response?.data || error.message);
    throw error;
  }
};

export const bulkDeleteInvoices = async (invoiceIds) => {
  try {
    const response = await axiosInstance.post('/invoices/invoices/bulk_delete/', { invoice_ids: invoiceIds }, {
    });
    console.log('Invoices deleted successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error deleting invoices:', error);
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
      throw new Error(error.response.data.error || 'Failed to delete invoices');
    } else if (error.request) {
      console.error('No response received:', error.request);
      throw new Error('No response received from server');
    } else {
      console.error('Error message:', error.message);
      throw new Error('An error occurred while deleting invoices');
    }
  }
};

// Function to fetch transactions data
export const fetchTransactions = async (params = {}) => {
  try {
    console.log('Calling API to fetch transactions with params:', params);
    const headers = getAuthHeader();
    console.log('Auth headers:', headers);
    
    const response = await axiosInstance.get('/transactions/transactions/', {
      params,
      headers,
    });
    
    console.log('API response received:', response.data);
    
    // Ensure we always return a consistent structure
    const formattedResponse = {
      results: response.data.results || [],
      count: response.data.count || 0,
      next: response.data.next || null,
      previous: response.data.previous || null,
    };
    
    console.log('Number of transactions:', formattedResponse.results.length);
    return formattedResponse;
  } catch (error) {
    console.error('Error in fetchTransactionsAPI:', error.response || error);
    // Return a consistent structure even in case of an error
    return {
      results: [],
      count: 0,
      next: null,
      previous: null,
      error: error.response?.data?.error || 'An unexpected error occurred'
    };
  }
};

// Function to create a transaction
export const createTransaction = async (transactionData) => {
  try {
    const response = await axiosInstance.post('/transactions/transactions/', transactionData, {
      headers: getAuthHeader(),
    });
    return response.data;
  } catch (error) {
    console.error('Error creating transaction:', error.response?.data || error.message);
    throw error;
  }
};

// Function to bulk update transactions status
export const bulkUpdateTransactions = async (updatedTransactions) => {
  try {
    const response = await axiosInstance.post('/transactions/transactions/bulk_update_status/', {
      transactions: updatedTransactions
    });
    return response.data;
  } catch (error) {
    console.error('Error updating transactions:', error.response?.data || error.message);
    throw error;
  }
};


// Function to update a transaction
export const updateTransaction = async (id, transactionData) => {
  try {
    const response = await axiosInstance.put(`/transactions/transactions/${id}/`, transactionData);
    return response.data;
  } catch (error) {
    console.error('Error updating transaction:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    console.error('Headers:', error.response?.headers);
    console.error('Data sent:', transactionData);
    throw error;
  }
};

// Function to delete a transaction
export const deleteTransaction = async (id) => {
  try {
    await axiosInstance.delete(`/transactions/transactions/${id}/`);
  } catch (error) {
    console.error('Error deleting transaction:', error.response?.data || error.message);
    throw error;
  }
};

export const bulkDeleteTransactions = async (ids) => {
  try {
    const response = await axiosInstance.post('/transactions/transactions/bulk_delete/', { ids });
    return response.data;
  } catch (error) {
    console.error('Error in bulkDeleteTransactions:', error.response?.data || error.message);
    throw error.response?.data || { error: 'An unexpected error occurred' };
  }
};

// Function to export transactions to CSV
export const exportTransactionsToCSV = async (params = {}) => {
  try {
  const response = await axiosInstance.get('/transactions/transactions/export_csv/', { params, responseType: 'blob' });
  return response.data;
  } catch (error) {
  console.error('Error exporting transactions to CSV:', error.response?.data || error.message);
  throw error;
  }
};

// Function to fetch summary data with date range
export const fetchSummaryData = async (startDate, endDate) => {
  try {
    const params = {
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
    };

    console.log('Fetching summary data with params:', params);

    const [orders, products, customers, transactions] = await Promise.all([
      axiosInstance.get('/core/orders/', { params }),
      axiosInstance.get('/products/', { params }),
      axiosInstance.get('/core/customers/', { params }),
      axiosInstance.get('/transactions/transactions/', { params })
    ]);
    const safeArrayOp = (data, op) => {
      if (Array.isArray(data)) {
        return op === 'length' ? data.length : data.slice(0, 5);
      } else if (data && typeof data === 'object') {
        // If it's a paginated response, try to use the 'results' field
        return op === 'length' ? (data.count || 0) : (data.results || []).slice(0, 5);
      }
      return op === 'length' ? 0 : [];
    };

    const orderData = Array.isArray(orders.data) ? orders.data : (orders.data.results || []);
    const totalRevenue = orderData.reduce((sum, order) => sum + (parseFloat(order.total_price) || 0), 0);
    const totalOrders = safeArrayOp(orders.data, 'length');
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalRevenue,
      averageOrderValue,
      totalOrders,
      totalProducts: safeArrayOp(products.data, 'length'),
      totalCustomers: safeArrayOp(customers.data, 'length'),
      recentTransactions: safeArrayOp(transactions.data, 'slice')
    };
  } catch (error) {
    console.error('Error fetching summary data:', error.response?.data || error.message);
    throw error;
  }
};

// Function to fetch sales data with date range
export const fetchSalesData = async (startDate, endDate) => {
  try {
    const params = {
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
    };

    console.log('Fetching orders with params:', params);
    const response = await axiosInstance.get('/core/orders/', {params});

    const processOrders = (orders) => orders.map(order => ({
      id: order.id,
      date: order.order_date,
      amount: order.total_price,
      customer: order.customer,
      status: order.status,
      isPaid: order.is_paid,
    }));

    // Ensure the response data is an array
    if (Array.isArray(response.data)) {
      // Transform the data to match the expected structure
      return processOrders(response.data);
    } else if (typeof response.data === 'object' && response.data.results) {
      return processOrders(response.data.results);
    } else {
      console.error('Unexpected data structure received:', response.data);
      return [];
    }
  } catch (error) {
    console.error('Error fetching sales data:', error.response?.data || error.message);
    throw error;
  }
};

// Function to fetch user preferences
export const fetchUserPreferences = async () => {
  try {
    const response = await axiosInstance.get('/users/preferences/', {
      headers: getAuthHeader(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching user preferences:', error.response?.data || error.message);
    throw error;
  }
};

// Function to update user preferences
export const updateUserPreferences = async (updatedPreferences) => {
  try {
    const response = await axiosInstance.put('/users/preferences/', updatedPreferences, {
      headers: getAuthHeader(),
    });
    return response.data;
  } catch (error) {
    console.error('Error updating user preferences:', error.response?.data || error.message);
    throw error;
  }
};

// Function to fetch detail data
export const fetchDetailData = async (type, id) => {
  try {
    const response = await axiosInstance.get(`/${type}/${id}/`, {
      headers: getAuthHeader(),
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${type} detail data:`, error.response?.data || error.message);
    throw error;
  }
};

// Function to fetch insights
export const fetchInsights = async () => {
  try {
    const response = await axiosInstance.get('/insights/', {
      headers: getAuthHeader(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching insights:', error.response?.data || error.message);
    throw error;
  }
};

// Function to export transactions to PDF
export const exportTransactionsToPDF = async (params = {}) => {
  try {
    const response = await axiosInstance.get('/transactions/transactions/export_pdf/', { 
    params, 
    responseType: 'blob' 
    });
    return response.data;
  } catch (error) {
    console.error('Error exporting transactions to PDF:', error.response?.data || error.message);
    throw error;
  }
};

// Function to create reports
async function createReport(name, description = null) {
  try {
    const response = await axiosInstance.post('/reports/reports/', {
      name: name,
      description: description
    });

    return response.data;
  } catch (error) {
    console.error('Error creating report:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }
      throw error;
  }
}

export { createReport };

// Function to fetch reports
export const fetchReports = async () => {
  try {
    const response = await axiosInstance.get('/reports/reports/');
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Error fetching reports:", error.response.data);
      throw new Error(`Failed to fetch reports: ${error.response.data.message || 'Unknown error'}`);
    } else if (error.request) {
      console.error("No response received when fetching reports");
      throw new Error('No response received from server');
    } else {
      console.error("Error setting up request to fetch reports:", error.message);
      throw new Error('Error setting up request');
    }
  }
};

// Function to generate reports
export const generateReport = async (reportData) => {
  try {
    if (!reportData || !reportData.name) {
      throw new Error('Report name is required');
    }
    const response = await axiosInstance.post('/reports/reports/', reportData);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Error generating report:", error.response.data);
      throw new Error(`Failed to generate report: ${error.response.data.message || 'Unknown error'}`);
    } else if (error.request) {
      console.error("No response received when generating report");
      throw new Error('No response received from server');
    } else {
      console.error("Error setting up request to generate report:", error.message);
      throw new Error('Error setting up request');
    }
  }
};

// Function to download reports
export const downloadReport = async (id) => {
  try {
    const response = await axiosInstance.get(`/reports/reports/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Error downloading report:", error.response.data);
      throw new Error(`Failed to download report: ${error.response.data.message || 'Unknown error'}`);
    } else if (error.request) {
      console.error("No response received when downloading report");
      throw new Error('No response received from server');
    } else {
      console.error("Error setting up request to download report:", error.message);
      throw new Error('Error setting up request');
    }
  }
};

// Function to export report to CSV
export async function exportReportToCsv(reportId) {
  try {
    const response = await axiosInstance.get(`/reports/reports/${reportId}/export_csv/`);
    return response.data.csv_url;
  } catch (error) {
    console.error('Error exporting report to CSV:', error);
    throw error;
  }
}

// Function to export report to Excel
export async function exportReportToExcel(reportId) {
  try {
    const response = await axiosInstance.get(`/reports/reports/${reportId}/export_excel/`);
    return response.data.excel_url;
  } catch (error) {
    console.error('Error exporting report to Excel:', error);
    throw error;
  }
}

// Function to clone a report template
export async function cloneReportTemplate(templateId) {
  try {
    const response = await axiosInstance.post(`/reports/reports/${templateId}/clone_template/`);
    return response.data;
  } catch (error) {
    console.error('Error cloning report template:', error);
    throw error;
  }
}

// Function to create a calculated field
export async function createCalculatedField(reportId, name, formula) {
  try {
    const response = await axiosInstance.post('/reports/calculated-fields/', {
      report: reportId,
      name,
      formula
    });
    return response.data;
  } catch (error) {
    console.error('Error creating calculated field:', error);
    throw error;
  }
}

// Function to calculate a custom field
export async function calculateCustomField(fieldId) {
  try {
    const response = await axiosInstance.get(`/reports/calculated-fields/${fieldId}/calculate/`);
    return response.data.result;
  } catch (error) {
    console.error('Error calculating custom field:', error);
    throw error;
  }
}

// Function to fetch report access logs
export async function fetchReportAccessLogs(reportId) {
  try {
    const response = await axiosInstance.get(`/reports/report-access-logs/?report=${reportId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching report access logs:', error);
    throw error;
  }
}

// Function to update report schedule
export async function updateReportSchedule(reportId, schedule) {
  try {
    const response = await axiosInstance.patch(`/reports/reports/${reportId}/`, {
      schedule: schedule
    });
    return response.data;
  } catch (error) {
    console.error('Error updating report schedule:', error);
    throw error;
  }
}

// Function to create user
async function createUser(userData) {
  if (!userData.username) {
    throw new Error('Username is required');
  }

  try {
    const response = await axiosInstance.post('/users/users/register/', userData);
    return response.data;
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.response) {
      console.error('Server responded with:', error.response.data);
      console.error('Status code:', error.response.status);
      throw new Error(JSON.stringify(error.response.data));
    } else if (error.request) {
      console.error('No response received:', error.request);
      throw new Error('No response received from server');
    } else {
      console.error('Error setting up request:', error.message);
      throw error;
    }
  }
}

export { createUser };

// Function to fetch all users
async function fetchUsers() {
  try {
    const response = await axiosInstance.get('/users/');
    return response.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

// Update a user
async function updateUser(userId, userData) {
  try {
    const response = await axiosInstance.put(`/users/${userId}/`, userData);
    return response.data;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

// Delete a user
async function deleteUser(userId) {
  try {
    await axiosInstance.delete(`/users/${userId}/`);
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

// Update a product
async function updateProduct(productId, productData) {
  try {
    const { category, ...restData } = productData;
    const dataToSend = {
      ...restData,
      category_id: category.id
    };
    const response = await axiosInstance.put(`/products/products/${productId}/`, dataToSend);
    return response.data;
  } catch (error) {
    console.error('Error fetching product details:', error.response?.data || error.message);
    throw error;
  }
}

// Delete a product
async function deleteProduct(productId) {
  try {
    await axiosInstance.delete(`/products/products/${productId}/`);
    return true;
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}

export { fetchUsers, updateUser, deleteUser, updateProduct, deleteProduct };

// Function to fetch roles
export const fetchRoles = async () => {
  const response = await axiosInstance.get('/users/roles/');
  return response.data;
};

// Function to create role
export const createRole = async (role) => {
  const response = await axiosInstance.post('/users/roles/', role);
  return response.data;
};

// Function to update role
export const updateRole = async (id, role) => {
  const response = await axiosInstance.put(`/users/roles/${id}/`, role);
  return response.data;
};

// Function to delete role
export const deleteRole = async (id) => {
  await axiosInstance.delete(`/users/roles/${id}/`);
};

// Function to fetch Categories
export async function fetchCategories() {
  try {
    const response = await axiosInstance.get('/products/categories/', {
      headers: getAuthHeader(),
    });
    console.log('Categories fetched:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
}

// Function to fetch reviews
async function fetchReviews(productId) {
  if (!productId) {
    throw new Error('Product ID is required');
  }

  try {
    const response = await axiosInstance.get(`/products/${productId}/reviews/`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching reviews for product ${productId}:`, error);
    throw error;
  }
}

export { fetchReviews };

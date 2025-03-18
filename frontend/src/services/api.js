import axios from 'axios';
import { isTokenPresent, getAuthHeader } from '../utils/auth';
import { dateUtils } from '../utils/dateUtils';
import moment from 'moment-timezone';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { formatCurrency, extractNumericValue } from '../utils/dataTransformations';

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

// Request interceptor to add Authorization header if authenticated and also handle moment objects
axiosInstance.interceptors.request.use(
  config => {
    if (isTokenPresent()) {
      const authHeader = getAuthHeader();
      if (authHeader) {
	config.headers.Authorization = authHeader;
      }
    }

    if (config.params) {
      config.params = Object.fromEntries(
        Object.entries(config.params)
          .map(([key, value]) => {
            // Skip moment internal properties
            if (key.startsWith('_')) {
              return false;
            }
            
            // Handle moment objects
            if (moment.isMoment(value)) {
              return [key, value.format('YYYY-MM-DD')];
            }
            
            // Keep other values as is
            return [key, value];
          })
          .filter(Boolean)
      );
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

export const addScannedItemToOrder = async (orderId, scannedData) => {
  try {
    const response = await axiosInstance.post(`/core/orders/${orderId}/add-scanned-item/`, scannedData);
    console.log('API Response for adding scanned item:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error adding scanned item:', error.response?.data || error.message);
    if (error.response?.data?.errors) {
      const errorMessages = Object.entries(error.response.data.errors)
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
        .join('; ');
      throw new Error(errorMessages);
    }
    throw error;
  }
};

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
export const fetchOrders = async (params = {}) => {
  try {
    const processedParams = { ...params };
    
    // Process dates if they exist
    if (processedParams.start_date || processedParams.end_date) {
      const { formattedStartDate, formattedEndDate } = dateUtils.processDateRange(
        processedParams.start_date,
        processedParams.end_date
      );
      processedParams.start_date = formattedStartDate;
      processedParams.end_date = formattedEndDate;
    }

    const response = await axiosInstance.get('/core/orders/', {
      params: {
        ...processedParams,
        include_items: true
      }
    });
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


// Function to fetch customers
export const fetchSalesReps = async () => {
  try {
    const response = await axiosInstance.get('/core/sales-reps/');
    return response.data;
  } catch (error) {
    console.error('Error fetching sales representatives:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      stack: error.stack
    });
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

export const fetchProductByBarcode = async (barcode) => {
  try {
    const response = await axiosInstance.get(`/products/products/barcode/${barcode}/`);
    if (response.status === 200) {
      return response.data;
    }
    throw new Error('Failed to fetch product');
  } catch (error) {
    console.error('Error fetching product by barcode:', error.response?.data || error.message);
    throw error;
  }
};

export const scanBarcodeProduct = async (productId, data) => {
  try {
    const response = await axiosInstance.post(`/products/products/${productId}/scan-barcode/`, data);
    if (response.status === 201) {
      return response.data;
    }
    throw new Error('Failed to process barcode scan');
  } catch (error) {
    console.error('Error processing barcode scan:', error.response?.data || error.message);
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

// Function to fetch Top product
export const fetchTopProducts = async (startDate, endDate) => {
  try {
    console.log('fetchTopProducts input dates:', { startDate, endDate });

    // Process the date range properly
    const { formattedStartDate, formattedEndDate } = dateUtils.processDateRange(startDate, endDate);
    
    const params = {
      start_date: formattedStartDate,
      end_date: formattedEndDate
    };

    console.log('API request params:', params);
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
    console.log('fetchRecentTransactions input dates:', { startDate, endDate });

    // Process the date range properly
    const { formattedStartDate, formattedEndDate } = dateUtils.processDateRange(startDate, endDate);
    
    const params = {
      start_date: formattedStartDate,
      end_date: formattedEndDate
    };

    console.log('API request params:', params);

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
    console.log('fetchNetProfitData input dates:', { startDate, endDate });

    // Process the date range properly
    const { formattedStartDate, formattedEndDate } = dateUtils.processDateRange(startDate, endDate);

    const params = {
      start_date: formattedStartDate,
      end_date: formattedEndDate
    };

    console.log('API request params:', params);
    
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

// function to fetch ConversionRate Data
export const fetchConversionRateData = async (startDate, endDate) => {
  try {
    console.log('fetched Conversion Rate input dates:', { startDate, endDate });

    // Process the date range properly
    const { formattedStartDate, formattedEndDate } = dateUtils.processDateRange(startDate, endDate);
    
    const params = {
      start_date: formattedStartDate,
      end_date: formattedEndDate
    };

    console.log('API request params:', params);
    
    const response = await axiosInstance.get('/analytics/conversion-rate/', {
      headers: getAuthHeader(),
      params,
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching conversion rate data:', error.response?.data || error.message);
    throw error;
  }
};

export const fetchInventoryLevels = async (startDate, endDate) => {
  try {
    console.group('🔍 Inventory Levels Fetch Debug');
    
    const authHeader = getAuthHeader();
    if (!authHeader) {
      throw new Error('Authentication token is missing');
    }

    console.log('Request Configuration:', {
      endpoint: '/inventory/levels/',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      params: {
        start_date: startDate,
        end_date: endDate
      }
    });

    const response = await axiosInstance.get('/inventory/levels/', {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      params: {
        start_date: startDate,
        end_date: endDate
      },
      validateStatus: (status) => {
        return status < 500; // Resolve only if status code is less than 500
      }
    });

    if (response.status === 200) {
      const inventoryData = response.data?.data || [];
      console.log('✅ Successful Response:', {
        status: response.status,
        dataLength: inventoryData.length,
        data: inventoryData
      });
      console.groupEnd();
      return inventoryData;
    } else {
      throw new Error(`Unexpected response status: ${response.status}`);
    }

  } catch (error) {
    console.error('❌ Inventory Fetch Error Details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      requestConfig: error.config
    });

    // Format the error for better handling in the UI
    const formattedError = {
      message: error.response?.data?.detail || error.message,
      status: error.response?.status,
      timestamp: new Date().toISOString(),
      requestParams: { startDate, endDate },
      technical_details: error.response?.data?.error || error.response?.data
    };

    console.groupEnd();
    throw formattedError;
  }
};

export const fetchCashFlow = async (startDate, endDate) => {
  try {
    console.log('Fetched Cash Flow input dates:', { startDate, endDate });

    // Process the date range properly
    const { formattedStartDate, formattedEndDate } = dateUtils.processDateRange(startDate, endDate);
    
    const params = {
      start_date: formattedStartDate,
      end_date: formattedEndDate
    };

    console.log('API request params:', params);

    const response = await axiosInstance.get('/finance/cash-flow/', {
      headers: getAuthHeader(),
      params,
    });

    console.log('Cash flow API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching cash flow:', error);
    console.error('Error details:', error.response?.data);
    return [];
  }
};

export const fetchReceipt = async (id) => {
  try {
    const response = await axiosInstance.get(`/receipts/${id}/`);
    console.log('Receipt API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Function to fetch receipts
export const fetchReceipts = async (params) => {
  console.log('fetchReceipts called with params:', params);
  try {
    console.log('Sending GET request to /receipts/');
    const response = await axiosInstance.get('/receipts/', { params });
    console.log('Raw response:', response);

    if (response.status !== 200) {
      throw new Error(`Unexpected status code: ${response.status}`);
    }

    if (!response.data) {
      throw new Error('Response data is undefined');
    }

    console.log('Receipts fetched successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in fetchReceipts:', error);
    throw error;
  }
};

export const checkReceiptExists = async (invoiceId) => {
  try {
    const response = await fetch(`/invoices/invoices/${invoiceId}/has-receipt/`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to check receipt status');
    }

    const data = await response.json();
    return data.has_receipt;
  } catch (error) {
    console.error('Error checking receipt status:', error);
    return false; // Default to false if check fails
  }
};

// Function to create a new receipt
export const createReceipt = async (receiptData) => {
  try {
    const response = await axiosInstance.post('/receipts/', receiptData);
    return response.data;
  } catch (error) {
    console.error('Error creating receipt:', error);
    throw error;
  }
};

// Function to update a receipt
export const updateReceipt = async (receiptId, receiptData) => {
  try {
    const response = await axiosInstance.put(`/receipts/${receiptId}/`, receiptData);
    return response.data;
  } catch (error) {
    console.error('Error updating receipt:', error);
    throw error;
  }
};

// Function to delete a receipt
export const deleteReceipt = async (receiptId) => {
  try {
    await axiosInstance.delete(`/receipts/${receiptId}/`);
    return true;
  } catch (error) {
    console.error('Error deleting receipt:', error);
    throw error;
  }
};

// Function to bulk delete receipts
export const bulkDeleteReceipts = async (receiptIds) => {
  try {
    await axiosInstance.post('/receipts/bulk-delete/', { receipt_ids: receiptIds });
    return true;
  } catch (error) {
    console.error('Error bulk deleting receipts:', error);
    throw error;
  }
};

export const generateReceiptPDF = async (receiptId) => {
  try {
    const response = await axiosInstance.get(`/receipts/${receiptId}/pdf/`, {
      responseType: 'blob',
    });

    // Create a URL for the blob
    const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
    const today = format(new Date(), 'yyyy-MM-dd');

    // Trigger download
    saveAs(pdfBlob, `Receipt-${receiptId}-${today}.pdf`);

    return response.data;
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    throw error;
  }
};

export const exportReceiptsPdf = async (ids, format = 'detailed') => {
  try {
    const response = await axiosInstance.post(
      `/receipts/export/pdf/`,
      {
        ids,
        format,
      },
      {
        responseType: 'blob',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/pdf',
        },
      }
    );

    // Check if the response is valid
    if (response.status !== 200 || !response.data) {
      throw new Error(`Failed to generate PDF: ${response.statusText}`);
    }

    // Create a URL for the blob
    const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
    const today = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const fileName = ids.length > 1
      ? `receipts-export-${today}.pdf`
      : `receipt-${ids[0]}-${today}.pdf`;

    // Trigger download
    saveAs(pdfBlob, fileName);
    
    return response.data;
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    // Provide more detailed error information if available
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
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

export const exportPdf = async (exportParams) => {
  try {
    const response = await axiosInstance.post('/invoices/invoices/export_pdf/', exportParams, {
      responseType: 'blob', // Important for file download
    });

    // Create a download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
    link.setAttribute('download', `invoice_export_${timestamp}.pdf`);

    document.body.appendChild(link);
    link.click();
    link.remove();

    return response.data; // Return the blob data if needed
  } catch (error) {
    console.error('Export PDF error:', error);

    if (error.response) {
      console.error('Error details:', error.response.data);
    }
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
    console.log('fetchSummaryData input dates:', { startDate, endDate });

    const { formattedStartDate, formattedEndDate } = dateUtils.processDateRange(startDate, endDate);

    const params = {
      start_date: formattedStartDate,
      end_date: formattedEndDate
    };

    const [orders, products, customers, transactions] = await Promise.all([
      axiosInstance.get('/core/orders/', { params }),
      axiosInstance.get('/products/', { params }),
      axiosInstance.get('/core/customers/', { params }),
      axiosInstance.get('/transactions/transactions/', { params })
    ]);

    // Improved data extraction with verbose logging
    const orderData = Array.isArray(orders.data) ? orders.data : 
                     (orders.data.results || []);

    console.log('Raw Order Data:', orderData);

    let totalRevenue = 0;
    // Process each order individually with error handling
    orderData.forEach((order, index) => {
      try {
        const orderValue = extractNumericValue(order.total_price);
        console.log(`Processing order ${index}:`, {
          originalPrice: order.total_price,
          extractedValue: orderValue
        });
        totalRevenue += orderValue;
      } catch (err) {
        console.error(`Error processing order ${index}:`, err);
      }
    });

    const totalOrders = orderData.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    console.log('Processing Results:', {
      totalRevenue,
      totalOrders,
      averageOrderValue
    });

    const summaryData = {
      totalRevenue: formatCurrency(totalRevenue),
      averageOrderValue: formatCurrency(averageOrderValue),
      totalOrders,
      totalProducts: Array.isArray(products.data) ? products.data.length : 
                    (products.data?.results?.length || 0),
      totalCustomers: Array.isArray(customers.data) ? customers.data.length :
                     (customers.data?.results?.length || 0),
      recentTransactions: Array.isArray(transactions.data) ? 
                         transactions.data.slice(0, 5) :
                         (transactions.data?.results || []).slice(0, 5)
    };

    console.log('Final Summary Data:', summaryData);
    return summaryData;

  } catch (error) {
    console.error('Error in fetchSummaryData:', error);
    throw error;
  }
};

// Function to fetch sales data with date range
export const fetchSalesData = async (startDate, endDate) => {
  try {
    console.log('SalesData input dates:', { startDate, endDate });

    // Process the date range properly
    const { formattedStartDate, formattedEndDate } = dateUtils.processDateRange(startDate, endDate);
    
    const params = {
      start_date: formattedStartDate,
      end_date: formattedEndDate
    };

    console.log('API request params:', params);
    const response = await axiosInstance.get('/core/orders/', {params});

    const processOrders = (orders) => orders.map(order => ({
      id: order.id,
      date: order.order_date,
      amount: extractNumericValue(order.total_price),
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
  if (!reportData || !reportData.name) {
    throw new Error('Report name is required');
  }

  try {
    // Sanitize and prepare report data
    const sanitizedReportData = {
      name: String(reportData.name).trim(), // Ensure name is a string and trimmed
      description: reportData.description || `Generated on ${new Date().toLocaleString()}`,
      is_template: !!reportData.is_template,
      start_date: reportData.startDate || null,
      end_date: reportData.endDate || null
    };

    // Validate name is not empty after trimming
    if (!sanitizedReportData.name) {
      throw new Error('Report name cannot be empty');
    }

    // Perform deep clone to remove any potential circular references
    const cleanPayload = JSON.parse(JSON.stringify(sanitizedReportData));

    // Make API call with clean, sanitized data
    const response = await axiosInstance.post('/reports/reports/', cleanPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    // Comprehensive error handling
    if (error.response) {
      // Server responded with an error status
      const errorMessage = 
        (error.response.data.name && error.response.data.name[0]) ||
        error.response.data.detail || 
        error.response.data.message || 
        'An unknown error occurred';

      throw new Error(errorMessage);
    }
    throw error;
  }
};

// Function to download reports
export const downloadReport = async (id, startDate = null, endDate = null) => {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await axiosInstance.post(
      `/reports/reports/${id}/generate_pdf/${params.toString() ? '?' + params.toString() : ''}`,
      {},
      { responseType: 'blob' }
    );
    
    // Create a blob URL and trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `report_${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      throw new Error('Report not found or not yet ready for download');
    }
    console.error("PDF Download Error:", error);
    throw new Error(`Failed to download PDF: ${error.message}`);
  }
};

// Function to delete report
export const deleteReport = async (id) => {
  try {
    const response = await axiosInstance.delete(`/reports/reports/${id}/`);
    return response.data;
  } catch (error) {
    console.error("Delete Report Error:", error);
    throw new Error(`Failed to delete report: ${error.message}`);
  }
};

// Function to export report to CSV
export async function exportReportToCsv(reportId, params) {
  try {
    const response = await axiosInstance.get(
      `/reports/reports/${reportId}/export_csv/?${params.toString()}`,
      {
        responseType: 'blob',
      }
    );

    // Create a URL for the blob
    const blob = new Blob([response.data], { type: 'text/csv' });
    const file_url = window.URL.createObjectURL(blob);

    // Get filename from response headers if available
    const contentDisposition = response.headers['content-disposition'];
    const filename = contentDisposition
      ? contentDisposition.split('filename=')[1].replace(/"/g, '')
      : null;

    return { file_url, filename };
  } catch (error) {
    console.error('Error exporting report to CSV:', error);
    throw error;
  }
}


// Function to export report to Excel
export const exportReportToExcel = async (reportId, startDate, endDate) => {
  try {
    const response = await axiosInstance.get(
      `/reports/reports/${reportId}/export_excel/`,
      {
        params: {
          start_date: startDate,
          end_date: endDate
        },
        responseType: 'arraybuffer'
      }
    );

    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = window.URL.createObjectURL(blob);
    const filename = `report_${reportId}_${startDate}_${endDate}.xlsx`;

    return { url, filename };
  } catch (error) {
    console.error('Excel export error:', error);
    throw new Error('Failed to export report to Excel');
  }
};

export const sendReportEmail = async (reportId, emailData, dateRange) => {
  try {
    const requestData = {
      ...emailData,
      start_date: dateRange.startDate,
      end_date: dateRange.endDate
    };
    const response = await axiosInstance.post(`/reports/reports/${reportId}/email_report/`, requestData);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Error sending report email:", error.response.data);
      throw new Error(`Failed to send report email: ${error.response.data.message || 'Unknown error'}`);
    } else if (error.request) {
      console.error("No response received when sending report email");
      throw new Error('No response received from server');
    } else {
      console.error("Error setting up request to send report email:", error.message);
      throw new Error('Error setting up request');
    }
  }
};

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

// Function to fetch current user
export async function fetchCurrentUser() {
  try {
    const response = await axiosInstance.get('/users/me/');
    console.log('Current User API Response:', response.data);

    // Normalize the response data
    const user = response.data;

    return {
      id: user.id || null,
      username: user.username || 'Unknown',
      email: user.email || 'No Email',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      displayName: user.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user.username || 'Unknown User',
    };
  } catch (error) {
    console.error('Error fetching current user:', error);

    if (error.response) {
      switch (error.response.status) {
        case 404:
          console.error('Endpoint not found. Check API routes.');
          break;
        case 401:
          console.error('Unauthorized. Please log in.');
          break;
        case 500:
          console.error('Server error. Please try again later.');
          break;
        default:
          console.error('Unexpected error occurred.');
      }
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
async function fetchUsers(page = 1) {
  try {
    const url = `/users/users/?page=${page}`;
    const response = await axiosInstance.get(url);

    console.log('Raw API Response:', response.data);

    // Comprehensive data normalization
    let users = [];

    // Case 1: Paginated response with results
    if (response.data.results) {
      users = response.data.results;
    } 
    // Case 2: Direct array response
    else if (Array.isArray(response.data)) {
      users = response.data;
    } 
    else {
      console.error('Unexpected API response structure:', response.data);
      users = [];
    }

    // Map users with proper fallback
    return users.map((user, index) => ({
      ...user,
      username: user.username || `User-${index}`,
      email: user.email || 'No Email',
      displayName: user.first_name 
        ? `${user.first_name} ${user.last_name || ''}`.trim() 
        : user.username || `User-${index}`
    }));

  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

// pagination helper function
export function getUsersPagination(response) {
  return {
    count: response.data.count || 0,
    next: response.data.next || null,
    previous: response.data.previous || null,
    totalPages: response.data.total_pages || Math.ceil(response.data.count / response.data.results.length)
  };
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

// Function to update a User
export const updateUser = async (userId, userData) => {
  // Validate inputs
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const cleanUserId = userId.toString()
      .replace(/^(user-|temp-)/, '')
      .split('-')[0];

    console.log('Updating user:', cleanUserId);
    console.log('User data:', userData);

    const response = await axiosInstance.patch(
      `/users/users/${cleanUserId}/`,
      userData
    );

    return response.data;
  } catch (error) {
    console.error('Error updating user:', error);
    if (error.response) {
      console.error('Error response data:', error.response.data);
      throw new Error(error.response.data.error || 'Failed to update user');
    }
    throw error;
  }
};

// Function to update user roles
export const updateUserRoles = async (userId, data) => {
  // Validate inputs
  if (!userId) {
    throw new Error('Invalid user ID Cannot update roles for undefined user');
  }

  // Allow empty array for role removal
  if (!Array.isArray(data.role_ids)) {
    throw new Error('Invalid role IDs: Must be an array');
  }

  try {
    const cleanUserId = userId.toString()
      .replace(/^(user-|temp-)/, '')
      .split('-')[0];

    const formattedData = {
      roles: data.role_ids
        .map(id => {
          const parsedId = typeof id === 'string' 
            ? parseInt(id, 10) 
            : typeof id === 'number' 
              ? id 
              : null;
          return parsedId;
        })
        .filter(id => id !== null && !isNaN(id))
    };

    console.log('Role Update Request:', {
      url: `/users/users/${cleanUserId}/roles/`,
      data: formattedData
    });

    const response = await axiosInstance.put(
      `/users/users/${cleanUserId}/roles/`,
      formattedData
    );

    return response.data;
  } catch (error) {
    console.error('Comprehensive Role Update Error:', error);
    throw error;
  }
};

// Function for assigning roles
export const assignUserRoles = async (userId, roleIds) => {
  try {
    const response = await axios.post(`/users/${userId}/assign-roles/`, {
      role_ids: roleIds
    });
    return response;
  } catch (error) {
    throw error;
  }
};

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

export { fetchUsers, deleteUser, updateProduct, deleteProduct };

export const fetchPermissions = async () => {
  try {
    const response = await axiosInstance.get(`/users/permissions/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching permissions:', error);
    throw error;
  }
};

export const fetchUserPermissions = async () => {
  try {
    const response = await axiosInstance.get('/users/permissions/');
    return {
      permissions: response.data.permissions || [],
      accessibleRoutes: response.data.accessible_routes || []
    };
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    throw error;
  }
};

// Function to fetch roles
export const fetchRoles = async () => {
  const response = await axiosInstance.get('/users/roles/');
  return response.data;
};

// Function to create role
export const createRole = async (roleData) => {
  try {
    const response = await axiosInstance.post(`/users/roles/`, {
      name: roleData.name,
      description: roleData.description,
      permission_ids: roleData.permissions
    });
    return response.data;
  } catch (error) {
    console.error('Error creating role:', error);
    throw error;
  }
};

export const updateRole = async (roleId, roleData) => {
  try {
    const response = await axiosInstance.patch(`/users/roles/${roleId}/`, {
      name: roleData.name,
      description: roleData.description,
      permission_ids: roleData.permissions.map(p => p.id || p)
    });
    // Trigger a comprehensive permission refresh mechanism
    await triggerPermissionRefresh(roleId);
    return response.data;
  } catch (error) {
    console.error('Error updating role:', error);
    throw error;
  }
};

// Permission refresh utility
const triggerPermissionRefresh = async (roleId) => {
  try {
    // Endpoint to force permission re-evaluation
    await axiosInstance.post('/api/auth/refresh-permissions/', {
      role_id: roleId,
      refresh_type: 'full'
    });

    // Optional: Invalidate existing authentication tokens
    await invalidateUserTokens();
  } catch (refreshError) {
    console.error('Permission refresh failed:', refreshError);
    // Implement fallback mechanism or user notification
    throw refreshError;
  }
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

import { format, isValid, parseISO } from 'date-fns';

/**
 * Transforms data for a line chart
 * @param {Array} data - Array of data points
 * @param {string} xKey - Key for X-axis values
 * @param {string} yKey - Key for Y-axis values
 * @returns {Object} Transformed data for Chart.js
 */
export const transformLineChartData = (data, xKey, yKey) => {
  // Check if data is an array and has length
  if (!Array.isArray(data) || data.length === 0) {
    console.warn('Invalid or empty data passed to transformLineChartData');
    return { labels: [], datasets: [{ label: yKey, data: [], fill: false, borderColor: 'rgb(75, 192, 192)', tension: 0.1 }] };
  }

  const labels = data.map(item => {
    if (typeof item[xKey] === 'string') {
      const date = parseISO(item[xKey]);
      return isValid(date) ? format(date, 'MMM dd, yyyy') : item[xKey];
    }
    return item[xKey];
  });

  const values = data.map(item => {
    const value = parseFloat(item[yKey]);
    return isNaN(value) ? null : value;
  });


  return {
    labels,
    datasets: [
      {
        label: yKey,
        data: values,
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }
    ]
  };
};

/**
 * Transforms data for a bar chart
 * @param {Array} data - Array of data points
 * @param {string} xKey - Key for X-axis values
 * @param {string} yKey - Key for Y-axis values
 * @returns {Object} Transformed data for Chart.js
 */
export const transformBarChartData = (data, xKey, yKey) => {
  const labels = data.map(item => item[xKey]);
  const values = data.map(item => item[yKey]);

  return {
    labels,
    datasets: [
      {
        label: yKey,
        data: values,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }
    ]
  };
};

/**
 * Transforms data for a pie chart
 * @param {Array} data - Array of data points
 * @param {string} labelKey - Key for label values
 * @param {string} valueKey - Key for numeric values
 * @returns {Object} Transformed data for Chart.js
 */
export const transformPieChartData = (data, labelKey, valueKey) => {
  const labels = data.map(item => item[labelKey]);
  const values = data.map(item => item[valueKey]);

  return {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
        ],
        borderWidth: 1
      }
    ]
  };
};

/**
 * Transforms sales data for time series analysis
 * @param {Array} data - Array of sales data
 * @param {string} dateKey - Key for date values
 * @param {string} valueKey - Key for sales values
 * @returns {Array} Array of objects with date and value properties
 */
export const transformSalesData = (data, dateKey, valueKey) => {
  return data.map(item => ({
    date: new Date(item[dateKey]),
    value: parseFloat(item[valueKey])
  })).sort((a, b) => a.date - b.date);
};

/**
 * Calculates the total sum of a specific key in an array of objects
 * @param {Array} data - Array of objects
 * @param {string} key - Key to sum
 * @returns {number} Total sum
 */
export const calculateTotal = (data, key) => {
  return data.reduce((sum, item) => sum + parseFloat(item[key] || 0), 0);
};

export const calculateGrowthRate = (oldValue, newValue) => {
  if (oldValue === 0) return newValue > 0 ? Infinity : 0;
  return ((newValue - oldValue) / oldValue) * 100;
};

export const validateSearchInput = (value, category) => {
  switch (category) {
    case 'id':
      return /^\d+$/.test(value);
    case 'amount':
      return /^\d+(\.\d{1,2})?$/.test(value);
    case 'customer':
    case 'product':
      return /^[a-zA-Z0-9\s]+$/.test(value);
    default:
      return true;
  }
};

/**
 * Groups data by a specific key and calculates the sum of another key
 * @param {Array} data - Array of objects
 * @param {string} groupKey - Key to group by
 * @param {string} sumKey - Key to sum
 * @returns {Object} Grouped sums
 */
export const groupAndSum = (data, groupKey, sumKey) => {
  return data.reduce((groups, item) => {
    const group = item[groupKey];
    if (!groups[group]) {
      groups[group] = 0;
    }
    groups[group] += parseFloat(item[sumKey] || 0);
    return groups;
  }, {});
};

/**
 * Calculates the percentage change between two values
 * @param {number} oldValue - The original value
 * @param {number} newValue - The new value
 * @returns {number} Percentage change
 */
export const calculatePercentageChange = (oldValue, newValue) => {
  if (oldValue === 0) return newValue === 0 ? 0 : 100;
  return ((newValue - oldValue) / oldValue) * 100;
};

export const calculateAverageSales = (salesData) => {
  if (!salesData || salesData.length === 0) {
    return 0;
  }
  const sum = salesData.reduce((acc, value) => acc + value, 0);
  return sum / salesData.length;
};

/**
 * Formats a number as currency
 * @param {number} value - The value to format
 * @param {string} currency - The currency code (default: 'USD')
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, currency = 'USD', locale = 'en-US') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(value);
};

/**
 * Main function to transform data based on chart type
 * @param {Array} data - The data to transform
 * @param {string} type - The type of chart ('line', 'bar', 'pie')
 * @param {Object} options - Additional options (e.g., keys for x and y axes)
 * @returns {Object} Transformed data for Chart.js
 */
export const transformChartData = (data, type, options = {}) => {
  const { xKey = 'x', yKey = 'y', labelKey, valueKey } = options;

  if (!Array.isArray(data) || data.length === 0) {
    console.warn(`Invalid or empty data passed to transformChartData for ${type} chart`);
    return { labels: [], datasets: [] };
  }

  switch (type) {
    case 'line':
      return transformLineChartData(data, xKey, yKey);
    case 'bar':
      return transformBarChartData(data, xKey, yKey);
    case 'pie':
      return transformPieChartData(data, labelKey || xKey, valueKey || yKey);
    default:
      console.warn(`Unsupported chart type: ${type}`);
      return { labels: [], datasets: [] };
  }
};

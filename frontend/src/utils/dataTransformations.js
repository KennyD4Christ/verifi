import { format, isValid, parseISO } from 'date-fns';
import { useCallback } from 'react';

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
 * Generates a consistent color hash from a string
 * @param {string} str - Input string to generate color from
 * @returns {string} - Hex color code
 */
const stringToColor = (str) => {
  if (!str || typeof str !== 'string') {
    return '#666666'; // Default color for invalid inputs
  }

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }

  return color;
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

export const adjustColorBrightness = (color, amount) => {
  return '#' + color.replace(/^#/, '').replace(/../g, color =>
    ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2)
  );
};

export const generateColorPalette = (baseColor, count) => {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const adjustment = Math.floor((i - count / 2) * (255 / count));
    colors.push(adjustColorBrightness(baseColor, adjustment));
  }
  return colors;
};

export const extractNumericValue = (currencyString) => {
  // Handle direct numeric input
  if (typeof currencyString === 'number') {
    return currencyString;
  }

  // Handle null, undefined, or empty string
  if (!currencyString) {
    return 0;
  }

  try {
    // Convert to string if not already
    const valueString = currencyString.toString();
    
    // Remove the Naira symbol, commas, and any whitespace
    const cleanedString = valueString.replace(/[₦,\s]/g, '');
    
    // Parse the numeric value
    const numericValue = parseFloat(cleanedString);
    
    // Log the transformation for debugging
    console.log('Currency transformation:', {
      original: currencyString,
      cleaned: cleanedString,
      final: numericValue
    });

    return isNaN(numericValue) ? 0 : numericValue;
  } catch (error) {
    console.error('Error processing currency value:', error);
    return 0;
  }
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
  if (!salesData.length) return 0;
  const total = salesData.reduce((sum, sale) => sum + sale.amount, 0);
  return total / salesData.length;
};

/**
 * Formats a number as currency
 * @param {number} value - The value to format
 * @param {string} currency - The currency code (default: 'NGN')
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, currency = 'NGN', locale = 'en-NG') => {
  if (value === null || value === undefined) {
    return '₦0.00';
  }

  try {
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numericValue)) {
      return '₦0.00';
    }

    if (currency === 'NGN') {
      // Custom formatting for Naira to ensure consistency with backend
      const formattedNumber = numericValue.toLocaleString('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      return `₦${formattedNumber}`;
    }

    // For other currencies, use Intl.NumberFormat
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(numericValue);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return '₦0.00';
  }
};

/**
 * Main function to transform data based on chart type
 * @param {Array} data - The data to transform
 * @param {string} type - The type of chart ('line', 'bar', 'pie')
 * @param {Object} options - Additional options (e.g., keys for x and y axes)
 * @returns {Object} Transformed data for Chart.js
 */
export const transformChartData = (data, chartType, { xKey, yKey, colorKey }) => {
  console.log('transformChartData input:', { data, chartType, xKey, yKey, colorKey });

  // Validate input data
  if (!Array.isArray(data) || data.length === 0) {
    console.warn('No data available for chart');
    return {
      labels: [],
      datasets: [{
        label: yKey.charAt(0).toUpperCase() + yKey.slice(1),
        data: [],
        backgroundColor: [],
        borderColor: []
      }]
    };
  }

  // Filter out invalid data points first
  const validData = data.filter(item => 
    item && typeof item === 'object' &&
    item[xKey] !== undefined &&
    item[yKey] !== undefined
  );

  if (validData.length === 0) {
    console.warn('No valid data points after filtering');
    return {
      labels: [],
      datasets: [{
        label: yKey.charAt(0).toUpperCase() + yKey.slice(1),
        data: [],
        backgroundColor: [],
        borderColor: []
      }]
    };
  }

  const labels = validData.map(item => {
    if (xKey === 'date' && item[xKey]) {
      const date = typeof item[xKey] === 'string' ? parseISO(item[xKey]) : new Date(item[xKey]);
      return isValid(date) ? format(date, 'yyyy-MM-dd') : null;
    }
    return String(item[xKey] || '');
  }).filter(Boolean);

  const values = validData.map(item => {
    const value = Number(item[yKey]);
    return isNaN(value) ? 0 : value;
  });

  const colors = colorKey
    ? validData.map(item => stringToColor(String(item[colorKey] || '')))
    : labels.map(label => stringToColor(label));

  switch (chartType) {
    case 'line':
    case 'bar':
      return {
        labels,
        datasets: [{
          label: yKey.charAt(0).toUpperCase() + yKey.slice(1),
          data: values,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1
        }]
      };
    case 'pie':
      return {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
        }]
      };
    default:
      console.warn('Unsupported chart type:', chartType);
      return {
        labels: [],
        datasets: [{
          label: yKey.charAt(0).toUpperCase() + yKey.slice(1),
          data: [],
          backgroundColor: [],
          borderColor: []
        }]
      };
  }
};

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled, { ThemeProvider } from 'styled-components';
import { useDashboardDate } from '../context/DashboardDateContext';
import { ErrorBoundary } from 'react-error-boundary';
import { useOrders } from '../context/OrderContext';
import { Alert, Spin, Select, DatePicker, Input, Button } from 'antd';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { format, parseISO, isValid, subDays } from 'date-fns';
import moment from 'moment-timezone';
import { dateUtils } from '../utils/dateUtils';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import { enUS } from 'date-fns/locale';
import { FixedSizeList as List } from 'react-window';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { debounce } from 'lodash';
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  fetchCustomers,
  fetchSummaryData,
  fetchSalesData,
  fetchTopProducts,
  fetchRecentTransactions,
  fetchUserPreferences,
  updateUserPreferences,
  fetchInventoryLevels,
  fetchCashFlow,
  fetchNetProfitData,
  fetchConversionRateData,
} from '../services/api';
import { subscribeToUpdates } from '../services/websocket';
import {
  calculateGrowthRate,
  formatCurrency,
  validateSearchInput,
  calculateAverageSales,
  transformChartData,
} from '../utils/dataTransformations';

import 'chartjs-adapter-date-fns';

ChartJS.register(
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
  annotationPlugin
);

const { RangePicker } = DatePicker;
const { Option } = Select;

const lightTheme = {
  backgroundColor: '#FFFFFF',
  textColor: '#333333',
  cardBackground: '#F5F5F5',
};

const darkTheme = {
  backgroundColor: '#1E1E1E',
  textColor: '#FFFFFF',
  cardBackground: '#2D2D2D',
};

const DateRangePickerContainer = styled.div`
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const DateRangePicker = styled(DateRangePickerContainer)`
  background-color: #87CEEB;
  padding: 10px;
  border-radius: 8px;
`;

const ChartDateRangePicker = styled(DateRangePickerContainer)`
  background-color: #87CEEB;
  padding: 10px;
  border-radius: 8px;
`;

const DashboardContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 20px;
  background-color: ${props => props.theme.backgroundColor};
  color: ${props => props.theme.textColor};
  min-height: 100vh;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 20px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const LoadingIndicatorContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 20px;
  background-color: ${props => props.theme.backgroundColor};
  color: ${props => props.theme.textColor};
  min-height: 100vh;
  justify-content: center;
  align-items: center;
`;


const Card = styled.div`
  background-color: ${props => props.theme.cardBackground};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 20px;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-size: 24px;
`;

const ErrorMessage = styled.div`
  color: #ff4444;
  background-color: #ffe5e5;
  border: 1px solid #ff4444;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 20px;
`;

const PreferencesPanel = styled.div`
  margin-bottom: 20px;
`;

const ToggleButton = styled.button`
  margin-right: 10px;
  padding: 5px 10px;
  background-color: ${props => props.active ? '#007bff' : '#f8f9fa'};
  color: ${props => props.active ? '#fff' : '#000'};
  border: 1px solid #007bff;
  border-radius: 4px;
  cursor: pointer;
`;

const ThemeToggle = styled.button`
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 10px;
  background-color: ${props => props.theme.cardBackground};
  color: ${props => props.theme.textColor};
  border: none;
  border-radius: 4px;
  cursor: pointer;
`;

const SearchInput = styled.input`
  width: 30%;
  padding: 10px;
  margin-bottom: 20px;
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const AdvancedSearchContainer = styled.div`
  display: flex;
  padding: 10px;
  gap: 30px;
  margin-bottom: 20px;
  background-color: #87CEEB;
`;

const StyledSelect = styled(Select)`
  min-width: 120px;
`;

const SafeMetricDisplay = ({ value, formatter = (v) => v, defaultValue = 'N/A' }) => {
  if (value === undefined || value === null || isNaN(value)) {
    return defaultValue;
  }
  try {
    return formatter(value);
  } catch (error) {
    console.error('Error formatting metric:', error);
    return defaultValue;
  }
};

const Dashboard = () => {
  const [inventoryLevels, setInventoryLevels] = useState([]);
  const [cashFlow, setCashFlow] = useState([]);
  const { dateRange, updateDateRange } = useDashboardDate();
  const [searchCategory, setSearchCategory] = useState('id');
  const [chartType, setChartType] = useState('line');
  const [selectedMetric, setSelectedMetric] = useState('revenue');
  const [summaryData, setSummaryData] = useState({});
  const [salesData, setSalesData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { orders, fetchOrders } = useOrders();
  const [widgetOrder, setWidgetOrder] = useState(['revenue', 'orders', 'customers', 'aov', 'netProfit', 'conversionRate']);
  const [userPreferences, setUserPreferences] = useState({
    showRevenue: true,
    showOrders: true,
    showCustomers: true,
    showAOV: true,
    showNetProfit: true,
    showConversionRate: true,
  });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [filter, setFilter] = useState('');
  const [metricData, setMetricData] = useState({});
  const [netProfit, setNetProfit] = useState(null);
  const [conversionRate, setConversionRate] = useState(null);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const fetchDashboardData = useCallback(async (startDate, endDate) => {
    if (!dateRange[0] || !dateRange[1]) {
      console.log('Date range not set, skipping data fetch');
      const defaultRange = dateUtils.getPresetDateRange('30days');
      updateDateRange([defaultRange.startDate, defaultRange.endDate]);
      return;
    }

    console.log('fetchDashboardData triggered with dateRange:', dateRange);
    setLoading(true);
    setError(null);

    try {
      // Process date range using our utility
      const { formattedStartDate, formattedEndDate } = dateUtils.processDateRange(
        dateRange[0],
        dateRange[1]
      );

      console.log('Processed dates for API:', {
        formattedStartDate,
        formattedEndDate
      });

      // Fetch all data in parallel with proper error handling
      const [
        summary,
        sales,
        products,
        transactions,
        netProfitData,
        conversionRateData,
        preferences,
        inventory,
        cashFlowData
      ] = await Promise.all([
        fetchSummaryData(formattedStartDate, formattedEndDate),
        fetchSalesData(formattedStartDate, formattedEndDate),
        fetchTopProducts(formattedStartDate, formattedEndDate),
        fetchRecentTransactions(formattedStartDate, formattedEndDate),
        fetchNetProfitData(formattedStartDate, formattedEndDate),
        fetchConversionRateData(formattedStartDate, formattedEndDate),
        fetchUserPreferences(),
        fetchInventoryLevels(formattedStartDate, formattedEndDate),
        fetchCashFlow(formattedStartDate, formattedEndDate)
      ]);

      // Update all states with proper null checks
      if (summary) setSummaryData(summary);
      if (Array.isArray(sales)) setSalesData(sales);
      if (Array.isArray(products)) setTopProducts(products);
      if (Array.isArray(transactions)) setRecentTransactions(transactions);
      if (netProfitData) setNetProfit(netProfitData);
      if (conversionRateData) setConversionRate(conversionRateData);
      if (preferences) setUserPreferences(preferences);
      if (Array.isArray(inventory)) setInventoryLevels(inventory);
      if (Array.isArray(cashFlowData)) setCashFlow(cashFlowData);

      // Update metric data state
      setMetricData({
        ...summary,
        netProfit: netProfitData?.value || 0,
        conversionRate: conversionRateData?.value || 0
      });

    } catch (err) {
      console.error('Error in fetchDashboardData:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateRange, updateDateRange]);

  // Effect to trigger data fetch when date range changes
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (orders && orders.length > 0) {
      setSalesData(orders.map(order => ({
        date: order.order_date,
        amount: order.total_price
      })));
    }
  }, [orders]);

  useEffect(() => {
    fetchDashboardData();

    const unsubscribe = subscribeToUpdates((data) => {
      switch(data.type) {
        case 'summary':
          setSummaryData(prev => ({ ...prev, ...data.payload }));
          break;
        case 'sales':
          setSalesData(prev => [...prev, data.payload]);
          break;
        case 'products':
          setTopProducts(prev => [...prev, data.payload]);
          break;
        case 'transactions':
          setRecentTransactions(prev => [data.payload, ...prev].slice(0, 100));
          break;
        default:
          console.log('Unhandled update type:', data.type);
      }
    });

    return () => unsubscribe();
  }, [fetchDashboardData]);

  const togglePreference = async (key) => {
    const newPreferences = { ...userPreferences, [key]: !userPreferences[key] };
    setUserPreferences(newPreferences);
    await updateUserPreferences(newPreferences);
  };

  const fetchMetricData = useCallback(async (startDate, endDate) => {
    console.log('fetchMetricData input:', { startDate, endDate });
    setLoading(true);
    setError(null);

    try {
      const [summary, orderData, productData, customerData, transactionData, netProfitData] = 
        await Promise.all([
          fetchSummaryData(startDate, endDate),
          fetchOrders(startDate, endDate),
          fetchTopProducts(startDate, endDate),
          fetchCustomers(startDate, endDate),
          fetchRecentTransactions(startDate, endDate),
          fetchNetProfitData(startDate, endDate)
        ]);

      setMetricData(summary);
      setNetProfit(netProfitData);
    } catch (err) {
      console.error('Error in fetchMetricData:', err);
      setError(`Error fetching data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchAdditionalData = async () => {
      try {
        const [inventory, cash] = await Promise.all([
          fetchInventoryLevels(),
          fetchCashFlow(),
        ]);
        setInventoryLevels(inventory);
        setCashFlow(cash);
      } catch (err) {
        setError((prevError) => prevError + ' ' + err.message);
      }
    };

    fetchAdditionalData();
  }, []);

  const handleDateRangeChange = useCallback((dates, dateStrings) => {
    console.log('Date Range Picker Change:', {
      dates,
      dateStrings
    });

    if (!dates) {
      console.log('Date picker cleared');
      updateDateRange(null);
      return;
    }

    if (dates.length === 2) {
      const [start, end] = dateStrings;
      console.log('Selected date range:', { start, end });
      
      if (start && end) {
        const startDate = moment(start);
        const endDate = moment(end);
        updateDateRange([startDate, endDate]);
      }
    }
  }, [updateDateRange]);

  useEffect(() => {
    console.log('Current date range:', {
      range: dateRange,
      formatted: dateRange.map(d => d?.format('YYYY-MM-DD'))
    });
  }, [dateRange]);

  const currentDateRange = useMemo(() => {
    return dateRange.map(date => moment(date));
  }, [dateRange]);

  const handleSearchCategoryChange = (value) => {
    setSearchCategory(value);
    setFilter(''); // Reset filter when changing category
  };

  const handleFilterChange = debounce((e) => {
    const value = e.target.value;
    if (validateSearchInput(value, searchCategory)) {
      setFilter(value);
    }
  }, 300);

  const filteredTransactions = useMemo(() =>
    recentTransactions.filter(t => {
      const searchValue = filter.toLowerCase();
      switch(searchCategory) {
        case 'id':
          return t.id.toString().includes(searchValue);
        case 'amount':
          return t.amount.toString().includes(searchValue);
        case 'customer':
          return t.customerName.toLowerCase().includes(searchValue);
        case 'product':
          return t.productName.toLowerCase().includes(searchValue);
        default:
          return true;
      }
    }),
    [recentTransactions, filter, searchCategory]
  );

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(widgetOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setWidgetOrder(items);
  };

  const RecentTransactionsList = useCallback(({ transactions }) => (
    <List
      height={400}
      itemCount={transactions.length}
      itemSize={50}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          ID: {transactions[index].id} -
          Customer: {transactions[index].customerName} -
          Product: {transactions[index].productName} -
          Amount: {formatCurrency(transactions[index].amount)}
        </div>
      )}
    </List>
  ), []);

  const ErrorFallback = ({ error, resetErrorBoundary }) => (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );

  const handleErrorReset = () => {
    // If you have states like error or data, you can reset them here
    setError(null);
    setData([]);
    // You can also trigger a re-fetch or refresh the component state
  };

  const getChartOptions = useCallback((type, metric) => {
    const baseOptions = {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: `${metric.toUpperCase()} Chart` },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (context) => `${context.label}: ${formatCurrency(context.raw)}`,
          },
        },
        zoom: {
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'xy',
          },
          pan: { enabled: true },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => formatCurrency(value),
          },
        },
      },
    };

    switch (type) {
      case 'line':
        return {
          ...baseOptions,
          scales: {
            ...baseOptions.scales,
            x: {
              type: 'time',
              time: {
                unit: 'day',
                displayFormats: {
                  day: 'MMM d'
                }
              },
              adapters: {
                date: {
                  locale: enUS,
                },
              },
            },
          },
        };
      case 'bar':
        return {
          ...baseOptions,
          scales: {
            ...baseOptions.scales,
            x: { type: 'category' },
          },
        };
      case 'pie':
        return {
          ...baseOptions,
          plugins: {
            ...baseOptions.plugins,
            legend: { position: 'right' },
          },
        };
      default:
        return baseOptions;
    }
  }, []);

  const LoadingIndicator = () => {
    return (
      <div className="loading-indicator">
        Loading...
      </div>
    );
  };

  // Memoized date values for different components
  const formattedDates = useMemo(() => {
    if (!dateRange[0] || !dateRange[1]) return null;
    return dateUtils.processDateRange(dateRange[0], dateRange[1]);
  }, [dateRange]);

  const aggregateRevenueData = useMemo(() => {
    if (!Array.isArray(salesData) || salesData.length === 0) {
      console.log('No sales data available for revenue calculation');
      return [];
    }

    try {
      const { startDate, endDate } = formattedDates || dateUtils.getDateRangeParams(30);

      const aggregated = salesData.reduce((acc, sale) => {
        // Validate sale object
        if (!sale || typeof sale !== 'object') {
          console.warn('Invalid sale object encountered');
          return acc;
        }

        const saleDate = moment(sale.date);
        if (!saleDate.isValid()) {
          console.warn(`Invalid date in sale object: ${sale.date}`);
          return acc;
        }

        // Parse amount with fallback
        const amount = parseFloat(sale.amount) || 0;
        if (amount === 0) {
          console.warn(`Invalid amount in sale object: ${sale.amount}`);
        }

        // Format date consistently
        const formattedDate = dateUtils.formatDateForAPI(saleDate);
      
        // Check if date is within range
        if (saleDate.isBetween(startDate, endDate, 'day', '[]')) {
          acc[formattedDate] = (acc[formattedDate] || 0) + amount;
        }

        return acc;
      }, {});

      return Object.entries(aggregated)
        .map(([date, amount]) => ({
          date,
          amount: Number(amount.toFixed(2))
        }))
        .sort((a, b) => moment(a.date).valueOf() - moment(b.date).valueOf());
    } catch (error) {
      console.error('Error in revenue aggregation:', error);
      return [];
    }
  }, [salesData, formattedDates]);

  const formatTopProductsData = useMemo(() => {
    console.log('Raw top products data:', topProducts);

    if (!Array.isArray(topProducts) || topProducts.length === 0) {
      console.warn('No top products data available');
      return [];
    }

    return topProducts.map(product => {
      // Add detailed logging for each product
      console.log('Processing product:', {
        name: product.name,
        sales: product.total_sales,
        revenue: product.total_revenue
      });

      return {
        name: product.name || 'Unnamed Product',
        sku: product.sku || 'N/A',
        sales: parseInt(product.total_sales) || 0,
        revenue: parseFloat(product.total_revenue) || 0,
        // Add debugging information
        _debug: {
          rawSales: product.total_sales,
          rawRevenue: product.total_revenue
        }
      };
    });
  }, [topProducts]);

  const formatInventoryData = useMemo(() => {
    console.log('Raw inventory data:', inventoryLevels);

    if (!Array.isArray(inventoryLevels) || inventoryLevels.length === 0) {
      console.warn('No inventory data available');
      return [];
    }

    const formattedData = inventoryLevels
      .map(item => {
        if (!item.name || item.stock === undefined) {
          console.warn('Invalid inventory item:', item);
          return null;
        }

        return {
          product: item.name,
          quantity: parseInt(item.stock) || 0,
          sku: item.sku || '',
          price: parseFloat(item.price) || 0,
          id: item.id
        };
      })
      .filter(item => item !== null);

    console.log('Formatted inventory data:', formattedData);
    return formattedData;
  }, [inventoryLevels]);

  const formatCashFlowData = useMemo(() => {
    console.log('Raw cash flow data:', cashFlow);

    if (!Array.isArray(cashFlow) || cashFlow.length === 0) {
      console.warn('No cash flow data available');
      return [];
    }

    const { startDate, endDate } = formattedDates || dateUtils.getDateRangeParams(30);

    return cashFlow
      .map(item => ({
        date: dateUtils.formatDateForAPI(item.date || item.trunc_date || item.created_at),
        balance: parseFloat(item.balance || item.amount || 0),
        cumulative_balance: parseFloat(item.cumulative_balance || item.total || 0)
      }))
      .filter(item => {
        if (!startDate || !endDate || !item.date) return true;
        const itemDate = moment(item.date);
        return itemDate.isBetween(startDate, endDate, 'day', '[]');
      })
      .sort((a, b) => moment(a.date).valueOf() - moment(b.date).valueOf());
  }, [cashFlow, formattedDates]);

  const renderChart = useCallback(() => {
    let data;
    let chartConfig;

    const getRandomColor = () => {
      return `hsl(${Math.random() * 360}, 70%, 50%)`;
    };

    const createEmptyChartData = () => ({
      labels: [],
      datasets: [{
        label: selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1),
        data: [],
        backgroundColor: [],
        borderColor: []
      }]
    });

    try {
      switch (selectedMetric) {
        case 'revenue':
          if (!aggregateRevenueData || aggregateRevenueData.length === 0) {
            data = createEmptyChartData();
          } else {
            data = transformChartData(aggregateRevenueData, chartType, {
              xKey: 'date',
              yKey: 'amount',
              colorKey: 'date'
            });

            if (data?.datasets?.[0]) {
              data.datasets[0].backgroundColor = data.labels.map(() => getRandomColor());
              data.datasets[0].borderColor = data.datasets[0].backgroundColor;
            }
          }
          chartConfig = getChartOptions(chartType, 'Revenue');
          break;
        case 'inventory':
          const inventoryData = formatInventoryData;

          if (inventoryData.length === 0) {
            throw new Error('No valid inventory data available');
          }

          if (chartType === 'pie') {
            data = {
              labels: inventoryData.map(item => `${item.product} (${item.sku})`),
              datasets: [{
                data: inventoryData.map(item => item.quantity),
                backgroundColor: inventoryData.map(() => getRandomColor()),
                borderColor: inventoryData.map(() => getRandomColor()),
                borderWidth: 1
              }]
            };
          } else if (chartType === 'bar') {
            data = {
              labels: inventoryData.map(item => item.product),
              datasets: [{
                label: 'Current Stock Level',
                data: inventoryData.map(item => item.quantity),
                backgroundColor: getRandomColor(),
                borderColor: getRandomColor(),
                borderWidth: 1
              }]
            };
          } else { // line chart - show as bar since we don't have time series data
            data = {
              labels: inventoryData.map(item => item.product),
              datasets: [{
                label: 'Current Stock Level',
                data: inventoryData.map(item => item.quantity),
                backgroundColor: getRandomColor(),
                borderColor: getRandomColor(),
                borderWidth: 2,
                tension: 0.1
              }]
            };
          }

          chartConfig = {
            responsive: true,
            plugins: {
              legend: {
                position: 'top',
              },
              title: {
                display: true,
                text: 'Inventory Levels'
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const item = inventoryData[context.dataIndex];
                    return `Stock: ${item.quantity} units | SKU: ${item.sku}`;
                  }
                }
              }
            },
            scales: chartType !== 'pie' ? {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Stock Level'
                }
              },
              x: {
                title: {
                  display: true,
                  text: 'Products'
                }
              }
            } : undefined
          };
          break;
        case 'cashFlow':
          data = transformChartData(
            formatCashFlowData,
            chartType,
            {
              xKey: 'date',
              yKey: chartType === 'line' ? 'cumulative_balance' : 'balance',
              colorKey: 'date'
            }
          );
          chartConfig = getChartOptions(chartType, 'Cash Flow');
          break;
        case 'topProducts':
          const productsData = formatTopProductsData;

          if (productsData.length === 0) {
            throw new Error('No top products data available');
          }

          if (chartType === 'pie') {
            data = {
              labels: productsData.map(item => item.name),
              datasets: [{
                data: productsData.map(item => item.sales),
                backgroundColor: productsData.map(() => getRandomColor()),
                borderColor: productsData.map(() => getRandomColor()),
                borderWidth: 1
              }]
            };
          } else {
            // For bar or line chart
            data = {
              labels: productsData.map(item => item.name),
              datasets: [{
                label: 'Total Sales',
                data: productsData.map(item => item.sales),
                backgroundColor: getRandomColor(),
                borderColor: getRandomColor(),
                borderWidth: 1
              }, {
                label: 'Revenue',
                data: productsData.map(item => item.revenue),
                backgroundColor: getRandomColor(),
                borderColor: getRandomColor(),
                borderWidth: 1,
                yAxisID: 'revenue'
              }]
            };
          }

          chartConfig = {
            responsive: true,
            plugins: {
              legend: {
                position: 'top',
              },
              title: {
                display: true,
                text: 'Top Products'
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const item = productsData[context.dataIndex];
                    const metric = context.dataset.label;
                    const value = context.raw;

                    if (metric === 'Revenue') {
                      return `${metric}: $${value.toLocaleString()}`;
                    }
                    return `${metric}: ${value.toLocaleString()} units`;
                  }
                }
              }
            },
            scales: chartType !== 'pie' ? {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Units Sold'
                }
              },
              revenue: {
                beginAtZero: true,
                position: 'right',
                title: {
                  display: true,
                  text: 'Revenue ($)'
                },
                grid: {
                  drawOnChartArea: false
                }
              },
              x: {
                title: {
                  display: true,
                  text: 'Products'
                }
              }
            } : undefined
          };
          break;
        case 'conversionRate':
          data = transformChartData(conversionRate, chartType, { xKey: 'date', yKey: 'conversion_rate', colorKey: 'date' });
          chartConfig = getChartOptions(chartType, 'Conversion Rate')
          break;
        default:
          data = { labels: [], datasets: [] };
          chartConfig = getChartOptions(chartType, selectedMetric);
      }

      if (!data.labels.length) {
        console.warn(`No data available for ${selectedMetric}`);
        return <Alert message={`No data available for ${selectedMetric}`} type="warning" />;
      }

      if (chartType !== 'pie') {
        data.labels.sort((a, b) => new Date(a) - new Date(b));
        const sortedData = data.labels.map(label =>
          data.datasets[0].data[data.labels.indexOf(label)]
        );
        data.datasets[0].data = sortedData;
      }

    } catch (error) {
      console.error(`Error transforming ${selectedMetric} data:`, error);
      return { data: createEmptyChartData(), config: getChartOptions(chartType, 'Revenue') };
    }

    switch (chartType) {
      case 'line':
        return <Line options={chartConfig} data={data} />;
      case 'bar':
        return <Bar options={chartConfig} data={data} />;
      case 'pie':
        return <Pie options={chartConfig} data={data} />;
      default:
        return <Alert message={`Unsupported chart type: ${chartType}`} type="error" />;
    }
  }, [selectedMetric, chartType, aggregateRevenueData, formatInventoryData, formatTopProductsData, formatCashFlowData, conversionRate, getChartOptions]);

  // Format dates for DatePicker value prop
  const formattedDateRange = useMemo(() => {
    return [
      dateRange[0] ? moment(dateRange[0]) : null,
      dateRange[1] ? moment(dateRange[1]) : null
    ];
  }, [dateRange]);

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <ErrorBoundary FallbackComponent={ErrorFallback} onReset={handleErrorReset}>
        <DashboardContainer>
          <ThemeToggle onClick={toggleTheme}>
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </ThemeToggle>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <PreferencesPanel>
            <ToggleButton
              active={userPreferences.showRevenue}
              onClick={() => togglePreference('showRevenue')}
              aria-label="Toggle revenue widget visibility"
            >
              Revenue
            </ToggleButton>
            <ToggleButton
              active={userPreferences.showOrders}
              onClick={() => togglePreference('showOrders')}
              aria-label="Toggle orders widget visibility"
            >
              Orders
            </ToggleButton>
            <ToggleButton
              active={userPreferences.showCustomers}
              onClick={() => togglePreference('showCustomers')}
              aria-label="Toggle customers widget visibility"
            >
              Customers
            </ToggleButton>
            <ToggleButton
              active={userPreferences.showAOV}
              onClick={() => togglePreference('showAOV')}
              aria-label="Toggle average order value widget visibility"
            >
              AOV
            </ToggleButton>
            <ToggleButton
              active={userPreferences.showNetProfit}
              onClick={() => togglePreference('showNetProfit')}
              aria-label="Toggle net profit widget visibility"
            >
              Net Profit
            </ToggleButton>
            <ToggleButton
              active={userPreferences.showConversionRate}
              onClick={() => togglePreference('showConversionRate')}
              aria-label="Toggle conversion rate widget visibility"
            >
              Conversion Rate
            </ToggleButton>
          </PreferencesPanel>

          <DateRangePicker>
            <h3>Date Range</h3>
            <DatePicker.RangePicker
              value={currentDateRange}
              onChange={handleDateRangeChange}
              format="YYYY-MM-DD"
              picker="date"
              showTime={false}
              allowClear={true}
	    />
          </DateRangePicker>

          {loading && <LoadingIndicator />}
          {error && <ErrorMessage>{error}</ErrorMessage>}

          <Card>
            <h3>Metric Summary</h3>
            {loading ? (
              <p>Loading metric data...</p>
            ) : (
              <>
                {userPreferences.showRevenue && (
                  <p>Revenue: {formatCurrency(metricData.totalRevenue || 0)}</p>
                )}
                {userPreferences.showOrders && (
                  <p>Orders: {metricData.totalOrders || 0}</p>
                )}
                {userPreferences.showCustomers && (
                  <p>Customers: {metricData.totalCustomers || 0}</p>
                )}
                {userPreferences.showAOV && (
                  <p>Average Order Value: {formatCurrency(metricData.averageOrderValue || 0)}</p>
                )}
                {netProfit && (
                  <p>Net Profit: {formatCurrency(netProfit.net_profit || 0)}</p>
                )}
              </>
            )}
          </Card>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="widgets">
              {(provided) => (
                <Grid {...provided.droppableProps} ref={provided.innerRef}>
                  {widgetOrder.map((widgetId, index) => (
                    <Draggable key={widgetId} draggableId={widgetId} index={index}>
                      {(provided) => (
                        <Card
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          {widgetId === 'revenue' && userPreferences.showRevenue && (
                            <>
                              <h3>Total Revenue</h3>
                              <p>
                                <SafeMetricDisplay
                                  value={summaryData?.totalRevenue}
                                  formatter={formatCurrency}
                                />
                              </p>
                            </>
                          )}
                          {widgetId === 'orders' && userPreferences.showOrders && (
                            <>
                              <h3>Total Orders</h3>
                              <p>
                                <SafeMetricDisplay value={summaryData?.totalOrders} />
                              </p>
                            </>
                          )}
                          {widgetId === 'customers' && userPreferences.showCustomers && (
                            <>
                              <h3>Total Customers</h3>
                              <p>
                                <SafeMetricDisplay value={summaryData?.totalCustomers} />
                              </p>
                            </>
                          )}
                          {widgetId === 'aov' && userPreferences.showAOV && (
                            <>
                              <h3>Average Order Value</h3>
                              <p>
                                <SafeMetricDisplay
                                  value={summaryData?.averageOrderValue}
                                  formatter={formatCurrency}
                                />
                              </p>
                            </>
                          )}
                          {widgetId === 'netProfit' && userPreferences.showNetProfit && (
                            <>
                              <h3>Net Profit</h3>
                              <p>
                                <SafeMetricDisplay
                                  value={netProfit?.net_profit}
                                  formatter={formatCurrency}
                                />
                              </p>
                            </>
                          )}
                          {widgetId === 'conversionRate' && userPreferences.showConversionRate && (
                            <>
                              <h3>Conversion Rate</h3>
                              <p>
                                <SafeMetricDisplay
                                  value={conversionRate?.conversion_rate}
                                  formatter={(value) => `${value.toFixed(2)}%`}
                                />
                              </p>
                            </>
                          )}
                        </Card>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </Grid>
              )}
            </Droppable>
          </DragDropContext>

          <AdvancedSearchContainer>
            <StyledSelect defaultValue="id" onChange={handleSearchCategoryChange}>
              <Option value="id">ID</Option>
              <Option value="amount">Amount</Option>
            </StyledSelect>
            <Input
              placeholder="Search transactions..."
              onChange={handleFilterChange}
              aria-label="Search transactions"
            />
          </AdvancedSearchContainer>

          <Card>
            <h3>Data Visualization</h3>
            <StyledSelect defaultValue="revenue" onChange={(value) => setSelectedMetric(value)}>
              <Option value="revenue">Revenue</Option>
              <Option value="inventory">Inventory Levels</Option>
              <Option value="cashFlow">Cash Flow</Option>
              <Option value="conversionRate">Conversion Rate</Option>
              <Option value="topProducts">Top Products</Option>
            </StyledSelect>
            <StyledSelect defaultValue="line" onChange={(value) => setChartType(value)}>
              <Option value="line">Line Chart</Option>
              <Option value="bar">Bar Chart</Option>
              <Option value="pie">Pie Chart</Option>
            </StyledSelect>
            {renderChart()}
          </Card>

          <Card>
            <h3>Conversion Rate Details</h3>
            {loading ? (
              <p>Loading conversion rate data...</p>
            ) : (
              <>
                <p>Total Visitors: {conversionRate?.total_visitors || 'N/A'}</p>
                <p>Conversions: {conversionRate?.conversions || 'N/A'}</p>
                <p>Conversion Rate: {conversionRate?.conversion_rate ? `${conversionRate.conversion_rate.toFixed(2)}%` : 'N/A'}</p>
              </>
            )}
          </Card>

          <Card>
            <h3>Sales Trend</h3>
            <Line
              options={getChartOptions('line', 'sales')}
              data={transformChartData(salesData, 'line', { xKey: 'date', yKey: 'amount', colorKey: 'date' })}
            />
          </Card>

          <Card>
            <h3>Recent Transactions</h3>
            <SearchInput
              type="text"
              placeholder="Search transactions..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              aria-label="Search transactions"
            />
            <RecentTransactionsList transactions={filteredTransactions} />
          </Card>
        </DashboardContainer>
      </ErrorBoundary>
    </ThemeProvider>
  );
};

export default Dashboard;

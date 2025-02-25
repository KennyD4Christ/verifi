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
import { transparentize, rgba, darken, lighten } from 'polished';
import TopProductsChart from './TopProductsChart';
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
  extractNumericValue,
} from '../utils/dataTransformations';

import 'chartjs-adapter-date-fns';
import Sidebar from './common/Sidebar';

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

const getThemeValue = (path, fallback) => props => {
  const value = path.split('.').reduce((acc, part) => {
    if (acc && acc[part] !== undefined) return acc[part];
    return undefined;
  }, props.theme);

  return value !== undefined ? value : fallback;
};

export const lightTheme = {
  primary: '#0066CC',
  secondary: '#4A5568',
  background: '#FFFFFF',
  surface: '#F8FAFC',
  text: {
    primary: '#1A202C',
    secondary: '#4A5568',
  },
  border: '#E2E8F0',
  shadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  card: {
    background: '#FFFFFF',
    shadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
  },
};

export const darkTheme = {
  primary: '#60A5FA',
  secondary: '#A0AEC0',
  background: '#1A202C',
  surface: '#2D3748',
  text: {
    primary: '#F7FAFC',
    secondary: '#A0AEC0',
  },
  border: '#4A5568',
  shadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  card: {
    background: '#2D3748',
    shadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
  },
};

const SIDEBAR_WIDTHS = {
  expanded: '270px',
  collapsed: '72px',
  mobile: '280px',
};

const BREAKPOINTS = {
  mobile: '768px',
  tablet: '1024px',
};

// Root Layout Components
export const DashboardRoot = styled.div`
  width: 100%;
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
  background-color: ${props => props.theme.background};
  color: ${props => props.theme.text.primary};
  transition: background-color 0.3s ease, color 0.3s ease;
`;

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

const FixedElementsWrapper = styled.div`
  position: sticky;
  top: 0;
  z-index: 1000;
  background-color: ${props => rgba(props.theme.background, 0.95)};
  backdrop-filter: blur(8px);
  padding: clamp(16px, 2vw, 24px);
  border-bottom: 1px solid ${props => props.theme.border};
  width: 100%;
  max-width: 1920px;
  min-width: 300px;
  margin: 0 auto;
  padding-right: clamp(80px, 10vw, 120px);
`;

const ContentWrapper = styled.div`
  width: 100%;
  max-width: 1920px;
  margin: 0 auto;
  padding: clamp(16px, 3vw, 32px);
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};
  
  @media (max-width: 768px) {
    padding: 16px;
  }
`;

const DashboardContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: clamp(10px, 2vw, 20px);
  background-color: ${props => props.theme.backgroundColor};
  color: ${props => props.theme.textColor};
  min-height: 100vh;
  width: 100%;
  min-width: 32px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch; // Smooth scrolling on iOS

  & > * {
    max-width: 100%;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 350px), 1fr));
  gap: clamp(16px, 2.5vw, 32px);
  margin-bottom: clamp(24px, 3vw, 40px);
  width: 100%;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 16px;
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
  border-radius: 12px;
  box-shadow: ${props => props.theme.card.shadow};
  padding: clamp(16px, 2.5vw, 24px);
  width: 100%;
  min-width: 0;
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.elevated ? 
      '0 8px 16px rgba(0, 0, 0, 0.1)' : 
      props.theme.card.shadow};
  }

  .scrollable-content {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    width: 100%;
    scrollbar-width: thin;
    
    &::-webkit-scrollbar {
      height: 6px;
    }
    
    &::-webkit-scrollbar-thumb {
      background-color: ${props => props.theme.secondary};
      border-radius: 3px;
    }
  }
`;


const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 200px;
  color: ${props => props.theme.primary};
  font-size: clamp(16px, 2vw, 24px);
`;

export const ErrorMessage = styled.div`
  color: #DC2626;
  background-color: ${props => rgba('#DC2626', 0.1)};
  border: 1.5px solid ${props => rgba('#DC2626', 0.2)};
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  font-weight: 500;
`;

const PageWrapper = styled.div`
  width: 100%;
  max-width: 1920px;
  margin: 0 auto;
`;

const PreferencesPanel = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: clamp(1px, 0.5vw, 4px);
  margin-bottom: clamp(16px, 2.5vw, 32px);
  width: 100%;
  max-width: 1920px;
  min-width: 300px;
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};
`;

const ToggleButton = styled.button`
  /* Core styles */
  padding: clamp(8px, 1.5vw, 16px) clamp(12px, 2vw, 24px);
  font-size: clamp(14px, 1.2vw, 16px);
  line-height: 1.5;
  font-weight: 500;
  white-space: nowrap;
  
  /* Colors and transitions */
  background-color: ${props => props.active ? 
    props.theme.primary || '#0066CC' : 
    props.theme.background || '#FFFFFF'};
  color: ${props => props.active ? 
    props.theme.primaryText || '#FFFFFF' : 
    props.theme.textColor || '#2C3E50'};
  border: 1.5px solid ${props => props.active ?
    props.theme.primary || '#0066CC' :
    props.theme.border || '#E2E8F0'};
  border-radius: 6px;
  
  /* Interactive states */
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  
  &:hover {
    background-color: ${props => props.active ?
      transparentize(0.1, props.theme.primary || '#0066CC') :
      props.theme.hoverBackground || '#F8FAFC'};
    transform: translateY(-1px);
  }
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px ${props => 
      transparentize(0.6, props.theme.primary || '#0066CC')};
  }
  
  &:active {
    transform: translateY(1px);
  }
  
  /* Disabled state */
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    padding: 10px 16px;
    font-size: 14px;
  }
`;

export const ThemeToggle = styled.button`
  position: fixed;
  top: clamp(16px, 2vw, 24px);
  right: clamp(16px, 2vw, 24px);
  padding: 12px 16px;
  background-color: ${props => props.theme.surface};
  color: ${props => props.theme.text.primary};
  border: 1.5px solid ${props => props.theme.border};
  border-radius: 8px;
  cursor: pointer;
  z-index: 1001;
  font-size: clamp(14px, 1.2vw, 16px);
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${props => props.theme.card.background};
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(1px);
  }
  
  @media (max-width: 768px) {
    position: static;
    width: 100%;
    margin-bottom: 16px;
  }
`;

export const SearchInput = styled.input`
  width: 100%;
  max-width: 400px;
  padding: 12px 16px;
  border: 1.5px solid ${getThemeValue('colors.border', '#e2e8f0')};
  border-radius: 8px;
  font-size: clamp(14px, 1.2vw, 16px);
  color: ${props => props.theme.text.primary};
  background-color: ${props => props.theme.surface};
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
    box-shadow: 0 0 0 3px ${props => rgba(props.theme.primary, 0.2)};
  }

  &::placeholder {
    color: ${props => props.theme.text.secondary};
  }
`;

const AdvancedSearchContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  padding: clamp(10px, 2vw, 20px);
  gap: clamp(10px, 2vw, 30px);
  margin-bottom: clamp(10px, 2vw, 20px);
  background-color: #87CEEB;
  border-radius: 8px;
  width: 100%;
  min-width: min-content;
  overflow-x: auto;

  & > * {
    flex: 1 1 auto;
    min-width: 200px; // Minimum width before wrapping
  }
`;

export const StyledSelect = styled(Select)`
  min-width: 160px;
  width: 100%;
  max-width: 300px;
  font-size: clamp(14px, 1.2vw, 16px);

  .select__control {
    border: 1.5px solid ${props => props.theme.border};
    border-radius: 8px;
    background-color: ${props => props.theme.surface};
    min-height: 42px;
    
    &:hover {
      border-color: ${props => props.theme.primary};
    }
    
    &--is-focused {
      border-color: ${props => props.theme.primary};
      box-shadow: 0 0 0 3px ${props => rgba(props.theme.primary, 0.2)};
    }
  }

  .select__menu {
    background-color: ${props => props.theme.card.background};
    border: 1px solid ${props => props.theme.border};
    border-radius: 8px;
    box-shadow: ${props => props.theme.card.shadow};
  }

  .select__option {
    padding: 10px 16px;
    
    &--is-selected {
      background-color: ${props => props.theme.primary};
    }
    
    &--is-focused {
      background-color: ${props => rgba(props.theme.primary, 0.1)};
    }
  }
`;

const DateRangeContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: clamp(10px, 2vw, 20px);
  width: 100%;

  h3 {
    width: 100%;
    font-size: clamp(1rem, 1.5vw, 1.25rem);
  }

  .date-picker {
    flex: 1;
    min-width: 200px;
  }
`;

export const TransactionList = styled.div`
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;

  table {
    width: 100%;
    min-width: 700px;
    border-collapse: separate;
    border-spacing: 0;
    
    th {
      background-color: ${props => props.theme.surface};
      padding: 12px 16px;
      font-weight: 600;
      text-align: left;
      border: 1.5px solid ${getThemeValue('colors.border', '#e2e8f0')};
    }
    
    td {
      padding: 12px 16px;
      border-bottom: 1px solid ${props => props.theme.border};
      transition: background-color 0.2s ease;
    }
    
    tbody tr:hover td {
      background-color: ${props => rgba(props.theme.primary, 0.05)};
    }
  }
`;

export const ChartContainer = styled.div`
  width: 100%;
  min-height: 350px;
  padding: 16px;
  background-color: ${props => props.theme.card.background};
  border-radius: 12px;
  border: 1px solid ${props => props.theme.border};
  
  .recharts-responsive-container {
    min-height: inherit;
  }
  
  .recharts-text {
    fill: ${props => props.theme.text.primary};
  }
  
  .recharts-cartesian-grid line {
    stroke: ${props => rgba(props.theme.border, 0.5)};
  }
`;

const SafeMetricDisplay = ({ value, formatter = (v) => v, defaultValue = 'N/A' }) => {
  try {
    // Handle empty values
    if (value === undefined || value === null) {
      return defaultValue;
    }

    // If formatter is formatCurrency, first ensure we have a clean numeric value
    if (formatter.name === 'formatCurrency') {
      const numericValue = extractNumericValue(value);
      return formatter(numericValue);
    }

    // For other formatters, process value directly
    return formatter(value);
  } catch (error) {
    console.error('Error in SafeMetricDisplay:', error);
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
    console.group('🔍 Dashboard Data Fetch Comprehensive Debug');
    console.log('📅 Initial Date Range:', dateRange);

    if (!dateRange[0] || !dateRange[1]) {
      console.warn('⚠️ Date range not set');
      const defaultRange = dateUtils.getPresetDateRange('30days');
      updateDateRange([defaultRange.startDate, defaultRange.endDate]);
      console.log('🔄 Applied Default Date Range:', defaultRange);
      console.groupEnd();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { formattedStartDate, formattedEndDate } = dateUtils.processDateRange(
        dateRange[0],
        dateRange[1]
      );
      console.log('🕒 Processed Dates:', { formattedStartDate, formattedEndDate });

      const fetchResults = await Promise.allSettled([
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

      const summary = fetchResults[0].status === 'fulfilled' ? fetchResults[0].value : null;
      const sales = fetchResults[1].status === 'fulfilled' ? fetchResults[1].value : null;
      const products = fetchResults[2].status === 'fulfilled' ? fetchResults[2].value : null;
      const transactions = fetchResults[3].status === 'fulfilled' ? fetchResults[3].value : null;
      const netProfitData = fetchResults[4].status === 'fulfilled' ? fetchResults[4].value : null;
      const conversionRateData = fetchResults[5].status === 'fulfilled' ? fetchResults[5].value : null;
      const preferences = fetchResults[6].status === 'fulfilled' ? fetchResults[6].value : null;
      const cashFlowData = fetchResults[8].status === 'fulfilled' ? fetchResults[8].value : null;

      // Inventory error handling
      const inventoryResult = fetchResults[7];
      if (inventoryResult.status === 'fulfilled') {
        const inventoryData = inventoryResult.value;
        if (Array.isArray(inventoryData) && inventoryData.length > 0) {
          setInventoryLevels(inventoryData);
          console.log('✅ Inventory Levels Set Successfully:', inventoryData);
        } else {
          console.warn('⚠️ No inventory data available');
          setInventoryLevels([]);
          setError('No inventory data available for the selected date range');
        }
      } else {
        console.error('❌ Inventory fetch failed:', inventoryResult.reason);
        setInventoryLevels([]);
        setError(`Failed to load inventory data: ${inventoryResult.reason.message || 'Unknown error'}`);
      }

      // State updates for other data
      if (summary) setSummaryData(summary);
      if (Array.isArray(sales)) setSalesData(sales);
      if (Array.isArray(products)) setTopProducts(products);
      if (Array.isArray(transactions)) setRecentTransactions(transactions);
      if (netProfitData) setNetProfit(netProfitData);
      if (conversionRateData) setConversionRate(conversionRateData);
      if (preferences) setUserPreferences(preferences);
      if (Array.isArray(cashFlowData)) setCashFlow(cashFlowData);

      setMetricData({
        ...summary,
        netProfit: netProfitData?.value || 0,
        conversionRate: conversionRateData?.value || 0
      });

      console.log('🎉 Dashboard Data Fetch Completed Successfully');
    } catch (err) {
      console.error('❌ Dashboard Data Fetch Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      console.groupEnd();
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

        // Handle currency-formatted amounts by extracting numeric value
        let amount = sale.amount;
        if (typeof amount === 'string' && amount.includes('₦')) {
          amount = extractNumericValue(amount);
        } else {
          amount = parseFloat(amount) || 0;
        }

        if (amount === 0) {
          console.warn(`Invalid or zero amount in sale object: ${sale.amount}`);
        }

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
          amount: Number(amount.toFixed(2))  // Maintain numeric value
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
      const revenue = typeof product.total_revenue === 'string' 
        ? extractNumericValue(product.total_revenue)
        : parseFloat(product.total_revenue) || 0;

      return {
        name: product.name || 'Unnamed Product',
        sku: product.sku || 'N/A',
        sales: parseInt(product.total_sales) || 0,
        revenue: revenue, // Keep as numeric for Chart.js
        revenueFormatted: formatCurrency(revenue, 'NGN', 'en-NG'), // Formatted version for display
        _debug: {
          rawSales: product.total_sales,
          rawRevenue: product.total_revenue
        }
      };
    });
  }, [topProducts]);

  const formatInventoryData = useMemo(() => {
    console.group('Inventory Data Debugging');
    console.log('Raw inventoryLevels:', inventoryLevels);
    console.log('inventoryLevels type:', typeof inventoryLevels);
    console.log('inventoryLevels length:', inventoryLevels?.length);

    if (!Array.isArray(inventoryLevels) || inventoryLevels.length === 0) {
      console.warn('❌ No inventory data available');
      console.trace('Stack trace for empty inventory');
      console.groupEnd();
      return [];
    }

    const processedData = inventoryLevels
      .map(item => {
        console.log('Processing item:', item);
        if (!item.name || item.stock === undefined) {
          console.warn('❌ Invalid inventory item:', item);
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

    console.log('Processed inventory data:', processedData);
    console.groupEnd();
    return processedData;
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
          const transformConfig = {
            xKey: 'name',
    	    yKey: 'stock',
            colorKey: 'sku'
          };

          const chartData = transformChartData(inventoryLevels, chartType, transformConfig);

          // Select the appropriate chart component based on type
          const ChartComponent = {
            'line': Line,
            'bar': Bar,
            'pie': Pie
          }[chartType];

          if (!ChartComponent) {
            return <div>Unsupported chart type</div>;
          }

          return (
            <ChartComponent
              data={chartData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: chartType === 'pie' ? 'right' : 'top'
                  },
                  title: {
                    display: true,
                    text: 'Inventory Levels'
                  },
                  tooltip: {
                    callbacks: {
                      label: function(context) {
                        const dataPoint = inventoryLevels[context.dataIndex];
                        return dataPoint ? `${dataPoint.name}: ${dataPoint.stock} units` : '';
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
              }}
            />
          );
          return <Chart type={chartType} data={chartData} options={chartOptions} />;
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
          return (
            <TopProductsChart 
              chartType={chartType}
              productsData={productsData}
              getRandomColor={getRandomColor}
            />
          );

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
                    const metric = context.dataset.label;
                    const value = context.raw;

                    if (metric === 'Revenue') {
                      return `${metric}: ₦${value.toLocaleString()}`;
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
                  text: 'Revenue (₦)'
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
	<DashboardRoot>
        <DashboardContainer>
	  <PageWrapper>
	  <FixedElementsWrapper>
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
	  </FixedElementsWrapper>

          <ContentWrapper>
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
                  <p>Revenue: {typeof metricData.totalRevenue === 'string' ? 
                    metricData.totalRevenue : 
                    formatCurrency(metricData.totalRevenue || 0)}
                  </p>
                )}
                {userPreferences.showOrders && (
                  <p>Orders: {metricData.totalOrders || 0}</p>
                )}
                {userPreferences.showCustomers && (
                  <p>Customers: {metricData.totalCustomers || 0}</p>
                )}
                {userPreferences.showAOV && (
                  <p>Average Order Value: {typeof metricData.averageOrderValue === 'string' ? 
                    metricData.averageOrderValue : 
                    formatCurrency(metricData.averageOrderValue || 0)}
                  </p>
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
	    <div className="scrollable-content">
            <h3>Data Visualization</h3>
	    <ChartContainer>
            <StyledSelect defaultValue="revenue" onChange={(value) => setSelectedMetric(value)}>
              <Option value="revenue">Revenue</Option>
              <Option value="inventory">Inventory Levels</Option>
              <Option value="cashFlow">Cash Flow</Option>
              <Option value="topProducts">Top Products</Option>
            </StyledSelect>
            <StyledSelect defaultValue="line" onChange={(value) => setChartType(value)}>
              <Option value="line">Line Chart</Option>
              <Option value="bar">Bar Chart</Option>
              <Option value="pie">Pie Chart</Option>
            </StyledSelect>
            {renderChart()}
	  </ChartContainer>
          </div>
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
            <TransactionList>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map(transaction => (
                    <tr key={transaction.id}>
                      <td>{transaction.date}</td>
                      <td>{transaction.description}</td>
                      <td>{transaction.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TransactionList>
          </Card>
	  </ContentWrapper>
	  </PageWrapper>
        </DashboardContainer>
      </DashboardRoot>
      </ErrorBoundary>
    </ThemeProvider>
  );
};

export default Dashboard;

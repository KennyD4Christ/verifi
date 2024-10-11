import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled, { ThemeProvider } from 'styled-components';
import { ErrorBoundary } from 'react-error-boundary';
import { useOrders } from '../context/OrderContext';
import { Alert, Spin, Select, DatePicker, Input, Button } from 'antd';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import moment from 'moment-timezone';
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

const MetricDateRangePicker = styled(DateRangePickerContainer)`
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

const Dashboard = () => {
  const [inventoryLevels, setInventoryLevels] = useState([]);
  const [cashFlow, setCashFlow] = useState([]);
  const [dateRange, setDateRange] = useState([null, null]);
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
  const [userPreferences, setUserPreferences] = useState({
    showRevenue: true,
    showOrders: true,
    showCustomers: true,
    showAOV: true,
  });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState(['revenue', 'orders', 'customers', 'aov']);
  const [filter, setFilter] = useState('');
  const [chartDateRange, setChartDateRange] = useState([null, null]);
  const [metricDateRange, setMetricDateRange] = useState([null, null]);
  const [metricData, setMetricData] = useState({});

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const formatDateForAPI = (date) => {
    return moment(date).format('YYYY-MM-DD');
  };

  const fetchDashboardData = useCallback(async (startDate, endDate) => {
    console.log('fetchDashboardData called with:', { startDate, endDate });
    setLoading(true);
    setError(null);
    try {
      const formattedStartDate = formatDateForAPI(startDate);
      const formattedEndDate = formatDateForAPI(endDate);
      console.log('Formatted dates:', { formattedStartDate, formattedEndDate });

      const [summary, sales, products, transactions, preferences] = await Promise.all([
        fetchSummaryData(startDate, endDate),
        fetchSalesData(startDate, endDate),
        fetchTopProducts(startDate, endDate),
        fetchRecentTransactions(startDate, endDate),
        fetchUserPreferences(),
      ]);

      console.log('Fetched data:', { summary, sales, products, transactions, preferences });

      setSummaryData(summary);
      setSalesData(Array.isArray(sales) ? sales : []);
      setTopProducts(products);
      setRecentTransactions(transactions);
      setUserPreferences(preferences);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
    console.log('fetchMetricData called with:', { startDate, endDate });
    setLoading(true);
    setError(null);
    try {
      // Format dates to YYYY-MM-DD
      const formattedStartDate = formatDateForAPI(startDate);
      const formattedEndDate = formatDateForAPI(endDate);
      console.log('Formatted dates for metrics:', { formattedStartDate, formattedEndDate });

      const [summary, orderData, productData, customerData, transactionData] = await Promise.all([
        fetchSummaryData(formattedStartDate, formattedEndDate),
        fetchOrders(formattedStartDate, formattedEndDate),
	fetchTopProducts(formattedStartDate, formattedEndDate),
        fetchCustomers(formattedStartDate, formattedEndDate),
        fetchRecentTransactions(formattedStartDate, formattedEndDate)
      ]);

      console.log('Fetched metric data:', { summary, orderData, productData, customerData, transactionData });

      setMetricData(summary);
      
    } catch (err) {
      setError(`Error fetching data: ${err.message}`);
      console.error('Error details:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('useEffect for orders update triggered', { ordersLength: orders?.length });
    if (orders && orders.length > 0) {
      const mappedSalesData = orders.map(order => ({
        date: order.order_date,
        amount: order.total_price
      }));
      console.log('Mapped sales data:', mappedSalesData);
      setSalesData(mappedSalesData);
    }
  }, [orders]);

  useEffect(() => {
    console.log('useEffect for chartDateRange triggered', { chartDateRange });
    if (chartDateRange[0] && chartDateRange[1]) {
      fetchDashboardData(chartDateRange[0], chartDateRange[1]);
    }
  }, [chartDateRange, fetchDashboardData]);

  useEffect(() => {
    console.log('useEffect for metricDateRange triggered', { metricDateRange });
    if (metricDateRange[0] && metricDateRange[1]) {
      fetchMetricData(metricDateRange[0], metricDateRange[1]);
    }
  }, [metricDateRange, fetchMetricData]);

  const handleChartDateRangeChange = (dates) => {
    console.log('handleChartDateRangeChange called with:', dates);
    setChartDateRange(dates);
  };

  const handleMetricDateRangeChange = (dates) => {
    console.log('handleMetricDateRangeChange called with:', dates);
    if (dates && dates.length === 2) {
      setMetricDateRange(dates.map(date => date.toDate()));
    } else {
      setMetricDateRange([null, null]);
    }
  };

  // When passing data to transformChartData, ensure it's an array
  const chartData = useMemo(() => {
    if (salesData.length === 0) {
      return { labels: [], datasets: [] };
    }
    return transformChartData(salesData, 'line', { xKey: 'date', yKey: 'amount' });
  }, [salesData]);

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

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    // Trigger data refresh with new date range
    fetchDashboardData(dates[0], dates[1]);
  };

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
      case 'doughnut':
        return {
          ...baseOptions,
          plugins: {
            ...baseOptions.plugins,
            legend: { position: 'right' },
          },
	  cutout: '50%',
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

  const renderChart = useCallback(() => {
    let data;
    let chartConfig;

    const handleTransformError = (metricName, error) => {
      console.error(`Error transforming ${metricName} data:`, error);
      return { labels: [], datasets: [] };
    };

    const aggregateRevenueData = (salesData) => {
      const aggregated = salesData.reduce((acc, sale) => {
        // Aggregate by month for this example. Adjust as needed.
        const month = new Date(sale.date).toLocaleString('default', { month: 'long' });
        acc[month] = (acc[month] || 0) + sale.amount;
        return acc;
      }, {});
      return Object.entries(aggregated).map(([label, value]) => ({ label, value }));
    };

    try {
      switch (selectedMetric) {
        case 'revenue':
          if (chartType === 'doughnut') {
            const aggregatedData = aggregateRevenueData(salesData);
            data = transformChartData(aggregatedData, chartType, { xKey: 'label', yKey: 'value' });
          } else {
            data = transformChartData(salesData, chartType, { xKey: 'date', yKey: 'amount' });
          }
          chartConfig = getChartOptions(chartType, 'revenue');
          break;
        case 'inventory':
          data = transformChartData(inventoryLevels, 'bar', { xKey: 'product', yKey: 'quantity' });
          chartConfig = getChartOptions('bar', 'inventory');
          break;
        case 'cashFlow':
          data = transformChartData(cashFlow, 'line', { xKey: 'date', yKey: 'balance' });
          chartConfig = getChartOptions('line', 'cashFlow');
          break;
        default:
          data = { labels: [], datasets: [] };
          chartConfig = getChartOptions(chartType, selectedMetric);
      }

      if (!data.labels.length) {
        console.warn(`No data available for ${selectedMetric}`);
        return <Alert message={`No data available for ${selectedMetric}`} type="warning" />;
      }

    } catch (error) {
      console.error(`Error transforming ${selectedMetric} data:`, error);
      return <Alert message={`Error loading ${selectedMetric} chart`} type="error" />;
    }

    switch (chartType) {
      case 'line':
        return <Line options={chartConfig} data={data} />;
      case 'bar':
        return <Bar options={chartConfig} data={data} />;
      case 'doughnut':
        return <Doughnut options={chartConfig} data={data} />;
      default:
        return <Alert message={`Unsupported chart type: ${chartType}`} type="error" />;
    }
  }, [selectedMetric, chartType, salesData, inventoryLevels, cashFlow, getChartOptions, transformChartData]);

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
          </PreferencesPanel>

          <MetricDateRangePicker>
            <h3>Metric Date Range</h3>
            <DatePicker.RangePicker
	      onChange={handleMetricDateRangeChange}
	      value={metricDateRange.map(date => date ? moment(date) : null)}
	    />
          </MetricDateRangePicker>

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
                              <p>{formatCurrency(summaryData.totalRevenue || 0)}</p>
                            </>
                          )}
                          {widgetId === 'orders' && userPreferences.showOrders && (
                            <>
                              <h3>Total Orders</h3>
                              <p>{summaryData.totalOrders}</p>
                            </>
                          )}
                          {widgetId === 'customers' && userPreferences.showCustomers && (
                            <>
                              <h3>Total Customers</h3>
                              <p>{summaryData.totalCustomers}</p>
                            </>
                          )}
                          {widgetId === 'aov' && userPreferences.showAOV && (
                            <>
                              <h3>Average Order Value</h3>
                              <p>{formatCurrency(summaryData.averageOrderValue || 0)}</p>
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

          <ChartDateRangePicker>
            <h3>Chart Date Range</h3>
            <RangePicker onChange={handleChartDateRangeChange} />
          </ChartDateRangePicker>

          <AdvancedSearchContainer>
	    <h3>Data Range</h3>
            <RangePicker onChange={handleDateRangeChange} />
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
            </StyledSelect>
            <StyledSelect defaultValue="line" onChange={(value) => setChartType(value)}>
              <Option value="line">Line Chart</Option>
              <Option value="bar">Bar Chart</Option>
              <Option value="doughnut">Doughnut Chart</Option>
            </StyledSelect>
            {renderChart()}
          </Card>

          <Card>
            <h3>Sales Trend</h3>
            <Line
              options={getChartOptions('line', 'sales')}
              data={transformChartData(salesData, 'line', { xKey: 'date', yKey: 'amount' })}
            />
          </Card>

          <Card>
            <h3>Top Products</h3>
            <Bar
              options={getChartOptions('bar', 'topProducts')}
              data={transformChartData(topProducts, 'bar', { xKey: 'product', yKey: 'sales' })}
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

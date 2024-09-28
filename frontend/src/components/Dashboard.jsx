import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled, { ThemeProvider } from 'styled-components';
import { ErrorBoundary } from 'react-error-boundary';
import { useOrders } from '../context/OrderContext';
import { Alert, Spin } from 'antd';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { FixedSizeList as List } from 'react-window';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import {
  fetchSummaryData,
  fetchSalesData,
  fetchTopProducts,
  fetchRecentTransactions,
  fetchUserPreferences,
  updateUserPreferences,
} from '../services/api';
import { subscribeToUpdates } from '../services/websocket';
import { transformChartData } from '../utils/dataTransformations';

ChartJS.register(...registerables, zoomPlugin);

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
  width: 100%;
  padding: 10px;
  margin-bottom: 20px;
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const Dashboard = () => {
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

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summary, sales, products, transactions, preferences] = await Promise.all([
        fetchSummaryData(),
        fetchSalesData(),
        fetchTopProducts(),
        fetchRecentTransactions(),
        fetchUserPreferences(),
      ]);

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

  // When passing data to transformChartData, ensure it's an array
  const chartData = useMemo(() => {
    if (salesData.length === 0) {
      return { labels: [], datasets: [] };
    }
    return transformChartData(salesData, 'line', { xKey: 'date', yKey: 'amount' });
  }, [salesData]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Chart Title' },
      tooltip: { mode: 'index', intersect: false },
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'xy',
        },
        pan: { enabled: true },
      },
    },
  }), []);

  const filteredTransactions = useMemo(() => 
    recentTransactions.filter(t => 
      t.id.toString().includes(filter) || 
      t.amount.toString().includes(filter)
    ),
    [recentTransactions, filter]
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
          ID: {transactions[index].id} - Amount: ${transactions[index].amount}
        </div>
      )}
    </List>
  ), []);

  if (loading) {
    return <Spin size="large" />;
  }

  if (error) {
    return <Alert message="Error" description={error} type="error" showIcon />;
  }

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => {
          setError(null);
          fetchDashboardData();
        }}
      >
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
                              <p>${summaryData.totalRevenue}</p>
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
                              <p>${summaryData.averageOrderValue}</p>
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

          <Card>
            <h3>Sales Trend</h3>
            <Line 
              options={chartOptions} 
              data={transformChartData(salesData, 'line')} 
            />
          </Card>

          <Card>
            <h3>Top Products</h3>
            <Bar 
              options={chartOptions} 
              data={transformChartData(topProducts, 'bar')} 
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

const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div role="alert">
    <p>Something went wrong:</p>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

export default Dashboard;

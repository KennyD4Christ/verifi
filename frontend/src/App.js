import React, { useContext, useEffect } from 'react';
import Modal from 'react-modal';
import styled from 'styled-components';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider, { AuthContext, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Products from './components/ProductsPage';
import Customers from './components/CustomersPage';
import Orders from './components/OrdersPage';
import Invoices from './components/InvoicesPage';
import Transactions from './components/TransactionsPage';
import StockLevels from './components/StockLevelsPage';
import Reports from './components/ReportsPage';
import UserRoles from './components/UserRolesPage';
import DetailView from './components/DetailView';
import UserPreferences from './components/UserPreferences';
import GlobalStyles from './assets/styles/globalStyles';
import Navbar from './components/common/Navbar';
import Sidebar from './components/common/Sidebar';
import Footer from './components/common/Footer';
import ProductDetails from './components/ProductDetails';


Modal.setAppElement('#root');

const AppContainer = styled.div`
  display: flex;
  min-height: 100vh;
`;

const MainContent = styled.main`
  flex-grow: 1;
  padding: 20px;
  margin-left: 250px;
  @media (max-width: 768px) {
    margin-left: 0;
  }
`;

const App = () => {
  const { isAuthenticated, loading, user } = useAuth();

  useEffect(() => {
    console.log('App rerendered. isAuthenticated:', isAuthenticated(), 'User:', user);
  }, [isAuthenticated, user]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthProvider>
      <Router>
	<AppContainer>
	  <GlobalStyles />
	  <div className="app">
	  <Navbar />
	  <Sidebar />
	  <MainContent>
	    <Routes>
	      <Route path="/login" element={<Login />} />
	      <Route path="/register" element={<Register />} />
	      <Route path="/forgot-password" element={<ForgotPassword />} />
	      <Route path="/reset-password" element={<ResetPassword />} />
	      <Route element={<ProtectedRoute />}>
	        <Route path="/" element={<Navigate to="/dashboard" replace />} />
	        <Route path="/dashboard" element={<Dashboard />} />
	        <Route path="/products" element={<Products />} />
	        <Route path="/customers" element={<Customers />} />
	        <Route path="/orders" element={<Orders />} />
	        <Route path="/invoices" element={<Invoices />} />
	        <Route path="/transactions" element={<Transactions />} />
	        <Route path="/stock-levels" element={<StockLevels />} />
	        <Route path="/reports" element={<Reports />} />
	        <Route path="/user-roles" element={<UserRoles />} />
	        <Route path="/preferences" element={<UserPreferences />} />
	        <Route path="/:type/:id" element={<DetailView />} />
	        <Route path="/products/:id" element={<ProductDetails />} />
	      </Route>
	      <Route path="*" element={<AuthRedirect />} />
	    </Routes>
	  </MainContent>
	  <Footer />
	</div>
	</AppContainer>
      </Router>
    </AuthProvider>
  );
};

const AuthRedirect = () => {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated() ? "/dashboard" : "/login"} replace />;
};

export default App;

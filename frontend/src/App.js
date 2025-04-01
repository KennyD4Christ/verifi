import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider, { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Dashboard from './components/Dashboard';
import Products from './components/ProductsPage';
import Customers from './components/CustomersPage';
import Orders from './components/OrdersPage';
import Invoices from './components/InvoicesPage';
import Receipts from './components/ReceiptsPage';
import Transactions from './components/TransactionsPage';
import StockLevels from './components/StockLevelsPage';
import Reports from './components/ReportsPage';
import UserRoles from './components/UserRolesPage';
import UserManagementLayout from './components/UserManagement/UserManagementLayout';
import DetailView from './components/DetailView';
import UserPreferences from './components/UserPreferences';
import ProductDetails from './components/ProductDetails';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import Layout from './components/Layout';
import GlobalStyles from './assets/styles/globalStyles';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ThemeProvider } from 'styled-components';
import { theme } from './theme';
import { ReceiptProvider } from './context/ReceiptContext';
import EnhancedChatWidget from './components/EnhancedChatWidget';
import TwoFactorSettings from './components/TwoFactorSettings';
import AccountSettings from './pages/AccountSettings';

const App = () => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <ReceiptProvider>
          <Router>
            <GlobalStyles />
            <Layout>
              <ToastContainer position="top-right" />
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route element={<ProtectedRoute />}>
	          <Route path="/account" element={<AccountSettings />} />
	          <Route path="/security/two-factor" element={<TwoFactorSettings />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/receipts" element={<Receipts />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/stock-levels" element={<StockLevels />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/user-roles" element={<UserRoles />} />
                  <Route path="/user-management/*" element={<UserManagementLayout />} />
                  <Route path="/preferences" element={<UserPreferences />} />
                  <Route path="/:type/:id" element={<DetailView />} />
                  <Route path="/products/:id" element={<ProductDetails />} />
                </Route>
                <Route path="*" element={<Navigate to={isAuthenticated() ? "/dashboard" : "/"} replace />} />
              </Routes>
	      {isAuthenticated() && <EnhancedChatWidget />}
            </Layout>
          </Router>
        </ReceiptProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;

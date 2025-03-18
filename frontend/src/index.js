import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AuthProvider from './context/AuthContext';
import TransactionProvider from './context/TransactionContext';
import InvoiceProvider from './context/InvoiceContext';
import UserProvider from './context/UserContext';
import ProductProvider from './context/ProductContext';
import CustomerProvider from './context/CustomerContext';
import ReportProvider from './context/ReportContext';
import { OrderProvider } from './context/OrderContext';
import './assets/styles/main.scss';

// Root component
const Root = () => (
    <AuthProvider>
      <TransactionProvider>
	<InvoiceProvider>
	  <UserProvider>
	    <ProductProvider>
	      <CustomerProvider>
	        <ReportProvider>
	          <OrderProvider>
	            <App />
	          </OrderProvider>
	        </ReportProvider>
	      </CustomerProvider>
	    </ProductProvider>
	  </UserProvider>
	</InvoiceProvider>
      </TransactionProvider>
    </AuthProvider>
);

// Rendering the root component
const root = createRoot(document.getElementById('root'));
root.render(<Root />);

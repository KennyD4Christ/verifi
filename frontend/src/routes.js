import Dashboard from './components/Dashboard';
import TransactionsPage from './components/TransactionsPage';
import InvoicesPage from './components/InvoicesPage';
import ReceiptsPage from './components/ReceiptsPage';
import ProductsPage from './components/ProductsPage';
import StockLevelsPage from './components/StockLevelsPage';
import OrdersPage from './components/OrdersPage';
import CustomersPage from './components/CustomersPage';
import UserManagementLayout from './components/UserManagement/UserManagementLayout';
import UserRolesPage from './components/UserRolesPage';
import ReportsPage from './components/ReportsPage';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';

const routes = [
  {
    path: '/',
    component: Dashboard,
    exact: true,
  },
  {
    path: '/dashboard',
    component: Dashboard,
  },
  {
    path: '/transactions',
    component: TransactionsPage,
  },
  {
    path: '/invoices',
    component: InvoicesPage,
  },
  {
    path: '/receipts',
    component: ReceiptsPage,
  },
  {
    path: '/products',
    component: ProductsPage,
  },
  {
    path: '/stock-levels',
    component: StockLevelsPage,
  },
  {
    path: '/orders',
    component: OrdersPage,
  },
  {
    path: '/customers',
    component: CustomersPage,
  },
  {
    path: '/user-roles',
    component: UserRolesPage,
  },
  {
    path: '/user-management',
    component: UserManagementLayout,
  },
  {
    path: '/reports',
    component: ReportsPage,
  },
  {
    path: '/login',
    component: Login,
  },
  {
    path: '/register',
    component: Register,
  },
  {
    path: '/forgot-password',
    component: ForgotPassword,
  },
  {
    path: '/products/:id',
    component: ProductDetails,
  },
  {
    path: '/reset-password/:uidb64/:token',
    component: ResetPassword,
  },
];

export default routes;

import React, { useEffect, useRef, forwardRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../context/AuthContext';
import VerifiLogo from './VerifiLogo';
import { FaBars, FaTimes, FaHome, FaReceipt, FaExchangeAlt, FaFileInvoiceDollar, FaBox, 
         FaLayerGroup, FaShoppingCart, FaUsers, FaUserShield, FaCog, FaChartBar } from 'react-icons/fa';


const SIDEBAR_WIDTHS = {
  expanded: '270px',
  collapsed: '75px',
  mobile: '280px',
};

const BREAKPOINTS = {
  mobile: '768px',
  tablet: '1024px',
};

const NavbarContainer = styled.header`
  position: fixed;
  top: 0;
  right: 0;
  z-index: 990;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  width: ${props =>
    props.isMobile
      ? '100%'
      : `calc(100% - ${props.collapsed ? SIDEBAR_WIDTHS.collapsed : SIDEBAR_WIDTHS.expanded})`};
  left: ${props =>
    props.isMobile
      ? '0'
      : props.collapsed
      ? SIDEBAR_WIDTHS.collapsed
      : SIDEBAR_WIDTHS.expanded};
`;

const NavbarInner = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  height: 64px;
  transition: all 0.3s ease;
`;

const NavbarContent = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
`;

const MenuButton = styled.button`
  background: none;
  border: none;
  color: #4a5568;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.3s ease;
  margin-right: 1rem;

  &:hover {
    background-color: rgba(74, 85, 104, 0.1);
  }

  svg {
    width: 24px;
    height: 24px;
  }
`;

const MobileNavigation = styled.div`
  position: fixed;
  top: ${props => props.headerHeight}px;
  left: ${props => props.isOpen ? '0' : '-100%'};
  width: 280px;
  height: calc(100vh - ${props => props.headerHeight}px);
  background-color: white;
  box-shadow: 2px 0 5px rgba(0,0,0,0.1);
  transition: left 0.3s ease;
  overflow-y: auto;
  z-index: 997;
  padding: 1rem 0;
  display: flex;
  flex-direction: column;
`;

const NavigationLink = styled(Link)`
  display: flex;
  align-items: center;
  padding: 0.75rem 1.5rem;
  color: #4a5568;
  text-decoration: none;
  transition: all 0.2s ease;

  svg {
    margin-right: 0.75rem;
    font-size: 1.25rem;
  }

  &:hover, &.active {
    background-color: #ebf8ff;
    color: #2b6cb0;
  }
`;

const Overlay = styled.div`
  position: fixed;
  top: ${props => props.headerHeight}px;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  opacity: ${props => props.isOpen ? 1 : 0};
  visibility: ${props => props.isOpen ? 'visible' : 'hidden'};
  transition: opacity 0.3s ease, visibility 0.3s ease;
  z-index: 996;
`;

const AuthSection = styled.div`
  margin-top: auto;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
`;

const LogoutButton = styled.button`
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: #2b6cb0;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #2c5282;
  }
`;

const navigationItems = [
  { path: '/dashboard', label: 'Dashboard', icon: FaHome },
  { path: '/transactions', label: 'Transactions', icon: FaExchangeAlt },
  { path: '/invoices', label: 'Invoices', icon: FaFileInvoiceDollar },
  { path: '/receipts', label: 'Receipts', icon: FaReceipt },
  { path: '/stock-levels', label: 'Stock Levels', icon: FaLayerGroup },
  { path: '/user-roles', label: 'User Roles', icon: FaUserShield },
  { path: '/user-management', label: 'User Management', icon: FaUsers },
  { path: '/reports', label: 'Reports', icon: FaChartBar },
  { path: '/products', label: 'Products', icon: FaBox },
  { path: '/customers', label: 'Customers', icon: FaUsers },
  { path: '/orders', label: 'Orders', icon: FaShoppingCart },
  { path: '/account', label: 'Account Settings', icon: FaCog },
];

const Navbar = forwardRef(({ onMenuClick, isMobile, collapsed, setHeaderHeight, setIsSidebarOpen }, ref) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const headerRef = useRef(null);
  const [isNavOpen, setIsNavOpen] = useState(false);

  useEffect(() => {
    if (headerRef.current && setHeaderHeight) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, [setHeaderHeight]);

  useEffect(() => {
    setIsNavOpen(false);
  }, [location.pathname]);

  const handleMenuClick = () => {
    setIsNavOpen(!isNavOpen);
    if (isMobile) {
      setIsSidebarOpen(true); // Open the sidebar when menu is clicked on mobile
    }
    if (onMenuClick) {
      onMenuClick();
    }
  };

  const handleLogout = () => {
    setIsNavOpen(false);
    logout();
    navigate('/');
  };

  return (
    <>
      <NavbarContainer 
        ref={ref} 
        isMobile={isMobile}
        collapsed={collapsed}
      >
        <NavbarInner sidebarOpen={!collapsed}>
          {isAuthenticated() && (
            <MenuButton onClick={handleMenuClick} aria-label="Toggle navigation">
              {isNavOpen ? <FaTimes /> : <FaBars />}
            </MenuButton>
          )}
          <Link to="/">
            <VerifiLogo src="/Logo 10.png" alt="Verifi Logo" />
          </Link>
          {!isAuthenticated() && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link to="/login" className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                Log In
              </Link>
              <Link to="/register" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Sign Up
              </Link>
            </div>
          )}
        </NavbarInner>
      </NavbarContainer>

      {isAuthenticated() && (
        <>
          <MobileNavigation headerHeight={headerRef.current?.offsetHeight || 0} isOpen={isNavOpen}>
            {navigationItems.map((item) => (
              <NavigationLink
                key={item.path}
                to={item.path}
                className={location.pathname === item.path ? 'active' : ''}
              >
                <item.icon />
                {item.label}
              </NavigationLink>
            ))}
            <AuthSection>
              <LogoutButton onClick={handleLogout}>
                Logout
              </LogoutButton>
            </AuthSection>
          </MobileNavigation>
          <Overlay
            headerHeight={headerRef.current?.offsetHeight || 0}
            isOpen={isNavOpen}
            onClick={() => setIsNavOpen(false)}
          />
        </>
      )}
    </>
  );
});

export default Navbar;

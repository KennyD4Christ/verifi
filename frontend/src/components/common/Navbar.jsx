import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../context/AuthContext';
import VerifiLogo from './VerifiLogo';

const NavbarContainer = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
`;

const NavLink = styled(Link)`
  color: #4a5568;
  text-decoration: none;
  margin: 0 1rem;
  font-weight: 500;

  &:hover {
    color: #2b6cb0;
  }
`;

const AuthButtons = styled.div`
  display: flex;
  align-items: center;
`;

const AuthButton = styled(Link)`
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  font-weight: 500;
  text-decoration: none;

  &:first-child {
    color: #4a5568;
    margin-right: 1rem;

    &:hover {
      background-color: #edf2f7;
    }
  }

  &:last-child {
    background-color: #2b6cb0;
    color: white;

    &:hover {
      background-color: #2c5282;
    }
  }
`;

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const renderAuthLinks = () => {
    if (isAuthenticated()) {
      return (
        <>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/transactions">Transactions</NavLink>
          <NavLink to="/stock-levels">Stock Levels</NavLink>
          <NavLink to="/user-roles">User Roles</NavLink>
          <NavLink to="/user-management">User Management</NavLink>
          <NavLink to="/reports">Reports</NavLink>
          <NavLink to="/products">Products</NavLink>
          <NavLink to="/customers">Customers</NavLink>
          <NavLink to="/orders">Orders</NavLink>
          <NavLink to="/invoices">Invoices</NavLink>
          <AuthButton as="button" onClick={handleLogout}>Logout</AuthButton>
        </>
      );
    } else if (location.pathname !== '/login' && location.pathname !== '/register') {
      return (
        <AuthButtons>
          <AuthButton to="/login">Log In</AuthButton>
          <AuthButton to="/register">Sign Up</AuthButton>
        </AuthButtons>
      );
    }
    return null;
  };

  return (
    <NavbarContainer>
      <NavLinks>
        <Link to="/">
          <VerifiLogo 
            src="/Logo 10.png" 
            alt="Verifi Logo" 
            className="mr-4" // Margin to separate logo from other nav items
          />
        </Link>
        {!isAuthenticated() && (
          <>
            <NavLink to="/about">About</NavLink>
            <NavLink to="/pricing">Pricing</NavLink>
            <NavLink to="/contact">Contact</NavLink>
          </>
        )}
      </NavLinks>
      {renderAuthLinks()}
    </NavbarContainer>
  );
};

export default Navbar;

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../context/AuthContext';

const NavbarContainer = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background-color: #1034a6;
  color: white;
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
`;

const NavLink = styled(Link)`
  color: white;
  text-decoration: none;
  margin: 0 10px;

  &:hover {
    text-decoration: underline;
  }
`;

const ProfileMenu = styled.div`
  position: relative;
  display: inline-block;
`;

const ProfileButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 16px;
`;

const DropdownContent = styled.div`
  display: none;
  position: absolute;
  background-color: white;
  color: black;
  min-width: 160px;
  box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
  z-index: 1;

  ${ProfileMenu}:hover & {
    display: block;
  }
`;

const DropdownItem = styled.a`
  color: black;
  padding: 12px 16px;
  text-decoration: none;
  display: block;

  &:hover {
    background-color: #f1f1f1;
  }
`;

const Navbar = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <NavbarContainer>
      <NavLinks>
        <NavLink to="/">Dashboard</NavLink>
	<NavLink to="/transactions">Transactions</NavLink>
	<NavLink to="/invoices">Invoices</NavLink>
	<NavLink to="/products">Products</NavLink>
	<NavLink to="/stock-levels">Stock Levels</NavLink>
	<NavLink to="/orders">Orders</NavLink>
	<NavLink to="/customers">Customers</NavLink>
	<NavLink to="/user-roles">User Roles</NavLink>
	<NavLink to="/reports">Reports</NavLink>
      </NavLinks>
      <ProfileMenu>
	<ProfileButton>User Profile</ProfileButton>
	<DropdownContent>
	  <DropdownItem href="#" onClick={handleLogout}>Logout</DropdownItem>
	</DropdownContent>
      </ProfileMenu>
    </NavbarContainer>
  );
};

export default Navbar;

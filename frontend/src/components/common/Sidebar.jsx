import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled, { ThemeProvider } from 'styled-components';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../../context/AuthContext';
import {
  FaHome,
  FaExchangeAlt,
  FaFileInvoiceDollar,
  FaBox,
  FaLayerGroup,
  FaShoppingCart,
  FaUsers,
  FaUserShield,
  FaChartBar,
  FaChevronLeft,
  FaChevronRight
} from 'react-icons/fa';

// Default Theme
const defaultTheme = {
  textColor: '#FFFFFF',
  backgroundColor: '#283747',
  activeTextColor: '#FFFFFF',
  activeBackgroundColor: '#336699',
  hoverBackgroundColor: '#4073A2',
  accentColor: '#FFC107',
  fontWeight: 700,
  iconSize: '20px',
};

// Sidebar Container
const SidebarContainer = styled.div`
  width: ${(props) => (props.collapsed ? '80px' : '200px')};
  transition: all 0.3s;
  color: ${(props) => props.theme.textColor};
  background-color: ${(props) => props.theme.backgroundColor};
  height: 100vh;
  position: fixed;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  z-index: 1000;
`;

// Sidebar Header
const SidebarHeader = styled.div`
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${(props) => props.theme.textColor};
`;

// Sidebar Toggle Button
const SidebarToggle = styled.button`
  background: none;
  border: none;
  color: ${(props) => props.theme.textColor};
  cursor: pointer;
  font-size: 1.2rem;
  transition: transform 0.3s;

  &:hover {
    transform: scale(1.1);
  }
`;

// Sortable Item Component
const SortableItem = ({ id, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
};

// Sidebar Link Styling
const SidebarLink = styled(Link)`
  color: ${(props) => (props.$active ? props.theme.activeTextColor : props.theme.textColor)};
  text-decoration: none;
  display: flex;
  align-items: center;
  padding: 10px 15px;
  background-color: ${(props) => (props.$active ? props.theme.activeBackgroundColor : 'transparent')};
  transition: background-color 0.2s ease, margin-right 0.2s ease;
  outline: none;

  &:hover,
  &:focus,
  &.$active {
    background-color: ${(props) => props.theme.activeBackgroundColor};
    border-left: 4px solid ${(props) => props.theme.activeTextColor}; // Border for active state
    font-weight: bold;  // Bold on hover
  }

  svg {
    margin-right: ${(props) => (props.collapsed ? '0' : '10px')};
    font-size: ${(props) => props.theme.iconSize};
  }
`;

// Sidebar Component
const Sidebar = ({ theme, collapse, onToggle }) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [menuItems, setMenuItems] = useState([
    { id: '1', label: 'Dashboard', path: '/', icon: FaHome, visible: true },
    { id: '2', label: 'Transactions', path: '/transactions', icon: FaExchangeAlt, visible: true },
    { id: '3', label: 'Invoices', path: '/invoices', icon: FaFileInvoiceDollar, visible: true },
    { id: '4', label: 'Products', path: '/products', icon: FaBox, visible: true },
    { id: '5', label: 'Stock Levels', path: '/stock-levels', icon: FaLayerGroup, visible: true },
    { id: '6', label: 'Orders', path: '/orders', icon: FaShoppingCart, visible: true },
    { id: '7', label: 'Customers', path: '/customers', icon: FaUsers, visible: true },
    { id: '8', label: 'User Roles', path: '/user-roles', icon: FaUserShield, visible: true },
    { id: '9', label: 'User Management', path: '/user-management', icon: FaUsers, visible: true },
    { id: '10', label: 'Reports', path: '/reports', icon: FaChartBar, visible: true },
  ]);

  const visibleMenuItems = menuItems.filter(item => item.visible);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setMenuItems((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleKeyDown = (event, index) => {
    if (event.key === 'ArrowDown') {
      document.getElementById(`sidebar-link-${index + 1}`)?.focus();
    } else if (event.key === 'ArrowUp') {
      document.getElementById(`sidebar-link-${index - 1}`)?.focus();
    }
  };

  return (
    <ThemeProvider theme={theme || defaultTheme}>
      <SidebarContainer collapsed={collapsed}>
        <SidebarHeader>
          <h3>{collapsed ? 'M' : 'Menu'}</h3>
          <SidebarToggle onClick={onToggle}>
            {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </SidebarToggle>
        </SidebarHeader>
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleMenuItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
            {visibleMenuItems.map((item, index) => (
              <SortableItem
                key={item.id}
                id={item.id}
              >
                <SidebarLink
                  to={item.path}
                  id={`sidebar-link-${index}`}
                  $active={location.pathname === item.path}
                  collapsed={collapsed.toString()}
                  tabIndex={0}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                >
                  <item.icon />
                  {!collapsed && <span>{item.label}</span>}
                </SidebarLink>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
      </SidebarContainer>
    </ThemeProvider>
  );
};

export default Sidebar;

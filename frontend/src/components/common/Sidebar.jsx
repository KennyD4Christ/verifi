import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled, { ThemeProvider, css } from 'styled-components';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FaHome, FaExchangeAlt, FaFileInvoiceDollar, FaBox,
  FaLayerGroup, FaShoppingCart, FaUsers, FaUserShield,
  FaChartBar, FaChevronLeft, FaChevronRight, FaTimes
} from 'react-icons/fa';

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

const mobileStyles = css`
  @media (max-width: 768px) {
    position: fixed;
    left: ${props => props.isOpen ? '0' : '-100%'};
    width: 280px !important;
    z-index: 1001;
    transition: left 0.3s ease;
  }
`;

const SidebarContainer = styled.div`
  width: ${props => props.collapsed ? '80px' : '240px'};
  height: 100vh;
  position: fixed;
  display: flex;
  flex-direction: column;
  background-color: ${props => props.theme.backgroundColor};
  color: ${props => props.theme.textColor};
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  transition: width 0.3s ease;
  ${mobileStyles}
`;

const SidebarHeader = styled.div`
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
`;

const CloseButton = styled.button`
  display: none;
  position: absolute;
  right: 1rem;
  top: 1rem;
  background: none;
  border: none;
  color: ${props => props.theme.textColor};
  cursor: pointer;
  font-size: 1.2rem;
  
  @media (max-width: 768px) {
    display: ${props => props.isOpen ? 'block' : 'none'};
  }
`;

const SidebarToggle = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.textColor};
  cursor: pointer;
  padding: 0.5rem;
  transition: transform 0.2s;
  
  &:hover {
    transform: scale(1.1);
  }
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const ScrollableContent = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
`;

const SidebarLink = styled(Link)`
  color: ${props => props.$active ? props.theme.activeTextColor : props.theme.textColor};
  text-decoration: none;
  display: flex;
  align-items: center;
  padding: 0.875rem 1rem;
  background-color: ${props => props.$active ? props.theme.activeBackgroundColor : 'transparent'};
  transition: all 0.2s ease;
  position: relative;
  
  &:hover,
  &:focus {
    background-color: ${props => props.theme.hoverBackgroundColor};
    border-left: 4px solid ${props => props.theme.accentColor};
  }
  
  svg {
    min-width: ${props => props.theme.iconSize};
    margin-right: ${props => props.collapsed ? '0' : '0.75rem'};
    transition: margin 0.3s ease;
  }
  
  span {
    white-space: nowrap;
    opacity: ${props => props.collapsed ? '0' : '1'};
    transition: opacity 0.2s ease;
  }
`;

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

const Sidebar = ({ 
  theme, 
  collapsed, 
  onToggle, 
  isMobile, 
  isOpen, 
  width 
}) => {
  const location = useLocation();
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
      <SidebarContainer 
        collapsed={collapsed} 
        isOpen={isOpen}
        role="navigation"
        aria-label="Main navigation"
      >
        <SidebarHeader>
          <h3>{collapsed && !isMobile ? 'M' : 'Menu'}</h3>
          <SidebarToggle 
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </SidebarToggle>
          <CloseButton 
            onClick={onToggle} 
            isOpen={isOpen}
            aria-label="Close sidebar"
          >
            <FaTimes />
          </CloseButton>
        </SidebarHeader>
        
        <ScrollableContent>
          <DndContext 
            collisionDetection={closestCenter} 
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={menuItems.filter(item => item.visible).map(item => item.id)} 
              strategy={verticalListSortingStrategy}
            >
              {menuItems
                .filter(item => item.visible)
                .map((item, index) => (
                  <SortableItem key={item.id} id={item.id}>
                    <SidebarLink
                      to={item.path}
                      id={`sidebar-link-${index}`}
                      $active={location.pathname === item.path}
                      collapsed={collapsed && !isMobile}
                      tabIndex={0}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      aria-current={location.pathname === item.path ? 'page' : undefined}
                    >
                      <item.icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </SidebarLink>
                  </SortableItem>
                ))}
            </SortableContext>
          </DndContext>
        </ScrollableContent>
      </SidebarContainer>
    </ThemeProvider>
  );
};

export default Sidebar;

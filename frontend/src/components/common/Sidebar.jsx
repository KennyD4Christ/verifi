import React, { useState, useEffect, useCallback, memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled, { ThemeProvider, css } from 'styled-components';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { rgba, darken, lighten } from 'polished';
import {
  FaHome, FaExchangeAlt, FaFileInvoiceDollar, FaBox,
  FaLayerGroup, FaShoppingCart, FaUsers, FaUserShield,
  FaChartBar, FaChevronLeft, FaChevronRight, FaTimes, FaReceipt, FaCog
} from 'react-icons/fa';

const defaultTheme = {
  primary: {
    main: '#336699',
    light: '#4073A2',
    dark: '#245180',
    contrast: '#FFFFFF',
  },
  background: {
    main: '#283747',
    light: '#34465A',
    dark: '#1C2834',
  },
  text: {
    primary: '#FFFFFF',
    secondary: rgba('#FFFFFF', 0.7),
  },
  accent: '#FFC107',
  border: rgba('#FFFFFF', 0.1),
  shadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
  transition: {
    default: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    slower: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

const SIDEBAR_WIDTHS = {
  expanded: '270px',
  collapsed: '75px',
  mobile: '280px',
};

const BREAKPOINTS = {
  mobile: '768px',
  tablet: '1024px',
};

const mobileStyles = css`
  @media (max-width: ${BREAKPOINTS.mobile}) {
    position: fixed;
    left: ${props => props.isOpen ? '0' : '-100%'};
    width: ${SIDEBAR_WIDTHS.mobile} !important;
    z-index: 1001;
    transition: left ${props => props.theme.transition.slower};
    box-shadow: ${props => props.isOpen ? props.theme.shadow : 'none'};
  }
`;

const SidebarContainer = styled.aside`
  width: ${props =>
    props.isMobile
      ? SIDEBAR_WIDTHS.mobile
      : props.collapsed
        ? SIDEBAR_WIDTHS.collapsed
        : SIDEBAR_WIDTHS.expanded};
  position: fixed;
  top: 0; // Changed from headerHeight
  height: 100vh; // Changed to full viewport height
  left: ${props => props.isOpen ? '0' : `-${SIDEBAR_WIDTHS.expanded}`};
  background-color: ${props => props.theme.background.main};
  color: ${props => props.theme.text.primary};
  box-shadow: ${props => props.theme.shadow};
  transition: all ${props => props.theme.transition?.slower || '0.3s'};
  overflow-y: auto;
  z-index: 990;

  // Add padding-top to account for header
  padding-top: ${props => props.headerHeight}px;
  
  @media (max-width: ${BREAKPOINTS.mobile}) {
    width: ${SIDEBAR_WIDTHS.mobile};
    transform: translateX(${props => props.isOpen ? '0' : '-100%'});
  }
`;

const SidebarHeader = styled.div`
  padding: 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid ${props => props.theme.border};
  background-color: ${props => props.theme.background.dark};
  min-height: 64px;

  h3 {
    font-size: 1.25rem;
    font-weight: ${props => props.theme.fontWeights.semibold};
    margin: 0;
    transition: opacity ${props => props.theme.transition.default};
    opacity: ${props => props.collapsed && !props.isMobile ? 0.5 : 1};
  }
`;

const IconButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.text.primary};
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all ${props => props.theme.transition.default};
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover, &:focus-visible {
    background-color: ${props => rgba(props.theme.text.primary, 0.1)};
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

const CloseButton = styled(IconButton)`
  display: none;
  position: absolute;
  right: 1rem;
  top: 1rem;

  @media (max-width: ${BREAKPOINTS.mobile}) {
    display: ${props => props.isOpen ? 'flex' : 'none'};
  }
`;

const SidebarToggle = styled(IconButton)`
  @media (max-width: ${BREAKPOINTS.mobile}) {
    display: none;
  }
`;

const ScrollableContent = styled.nav`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: ${props => rgba(props.theme.text.primary, 0.2)} transparent;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: ${props => rgba(props.theme.text.primary, 0.2)};
    border-radius: 3px;
    
    &:hover {
      background: ${props => rgba(props.theme.text.primary, 0.3)};
    }
  }
`;

const SidebarLink = styled(Link)`
  color: ${props => props.$active ? props.theme.primary.contrast : props.theme.text.primary};
  text-decoration: none;
  display: flex;
  align-items: center;
  padding: 1rem 1.25rem;
  background-color: ${props => props.$active ? props.theme.primary.main : 'transparent'};
  transition: all ${props => props.theme.transition.default};
  position: relative;
  font-weight: ${props => props.theme.fontWeights.medium};
  border-left: 4px solid ${props => props.$active ? props.theme.accent : 'transparent'};

  &:hover, &:focus-visible {
    background-color: ${props => props.$active ? 
      props.theme.primary.light : 
      props.theme.background.light};
    outline: none;
  }

  &:active {
    background-color: ${props => props.$active ?
      props.theme.primary.dark :
      props.theme.background.dark};
  }

  svg {
    min-width: 20px;
    width: 20px;
    height: 20px;
    margin-right: ${props => props.collapsed ? '0' : '1rem'};
    transition: margin ${props => props.theme.transition.default};
  }

  span {
    white-space: nowrap;
    opacity: ${props => props.collapsed ? '0' : '1'};
    transition: opacity ${props => props.theme.transition.default};
    font-size: 0.9375rem;
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
    cursor: 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
};

const Sidebar = ({
  onToggle,
  collapsed = false,
  isOpen = false,
  theme = defaultTheme,
  onReorder
}) => {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [menuItems, setMenuItems] = useState([
    { id: '1', label: 'Dashboard', path: '/', icon: FaHome, visible: true },
    { id: '2', label: 'Transactions', path: '/transactions', icon: FaExchangeAlt, visible: true },
    { id: '3', label: 'Invoices', path: '/invoices', icon: FaFileInvoiceDollar, visible: true },
    { id: '4', label: 'Receipts', path: '/receipts', icon: FaReceipt, visible: true },
    { id: '5', label: 'Products', path: '/products', icon: FaBox, visible: true },
    { id: '6', label: 'Stock Levels', path: '/stock-levels', icon: FaLayerGroup, visible: true },
    { id: '7', label: 'Orders', path: '/orders', icon: FaShoppingCart, visible: true },
    { id: '8', label: 'Customers', path: '/customers', icon: FaUsers, visible: true },
    { id: '9', label: 'User Roles', path: '/user-roles', icon: FaUserShield, visible: true },
    { id: '10', label: 'User Management', path: '/user-management', icon: FaUsers, visible: true },
    { id: '11', label: 'Reports', path: '/reports', icon: FaChartBar, visible: true },
    { id: '12', label: 'Account Settings', path: '/account', icon: FaCog, visible: true },
  ]);

  const handleWindowResize = useCallback(() => {
    setIsMobile(window.innerWidth <= 768);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [handleWindowResize]);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = menuItems.findIndex(item => item.id === active.id);
      const newIndex = menuItems.findIndex(item => item.id === over.id);

      onReorder?.(arrayMove(menuItems, oldIndex, newIndex));
    }
  }, [menuItems, onReorder]);

  const handleKeyDown = useCallback((e, index) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const targetIndex = e.key === 'ArrowDown' ?
        Math.min(index + 1, menuItems.length - 1) :
        Math.max(index - 1, 0);
      document.getElementById(`sidebar-link-${targetIndex}`)?.focus();
    }
  }, [menuItems.length]);

  return (
    <ThemeProvider theme={theme}>
      <SidebarContainer
        collapsed={collapsed}
        isOpen={isOpen}
        role="navigation"
        aria-label="Main navigation"
      >
        <SidebarHeader collapsed={collapsed} isMobile={isMobile}>
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
                      $collapsed={collapsed && !isMobile}
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

export default memo(Sidebar);

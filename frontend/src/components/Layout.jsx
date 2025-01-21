import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { useLocation } from 'react-router-dom';
import Navbar from './common/Navbar';
import Sidebar from './common/Sidebar';
import Footer from './common/Footer';
import { debounce } from 'lodash';

// Breakpoints for consistent responsive design
const breakpoints = {
  mobile: '480px',
  tablet: '768px',
  laptop: '1024px',
  desktop: '1200px'
};

const SIDEBAR_WIDTHS = {
  expanded: '270px',
  collapsed: '72px',
  mobile: '280px',
};


const LayoutWrapper = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
`;

const ContentWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
  padding-top: ${props => props.headerHeight}px;
  transition: margin-left 0.3s ease, width 0.3s ease;

  @media (min-width: ${breakpoints.tablet}) {
    margin-left: ${props => (props.isSidebarOpen ? props.sidebarWidth : '0')};
    width: ${props => (props.isSidebarOpen ? `calc(100% - ${props.sidebarWidth})` : '100%')};
  }
`;

const MainContent = styled.main`
  flex: 1;
  padding: clamp(1rem, 3vw, 2rem);
  overflow-y: auto;

  @media (max-width: ${breakpoints.mobile}) {
    padding: 0.75rem;
  }
`;

const Overlay = styled.div`
  display: ${props => (props.show ? 'block' : 'none')};
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 998;
  transition: opacity 0.3s ease;
  opacity: ${props => (props.show ? 1 : 0)};
`;

const Layout = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(0);
  const location = useLocation();
  const headerRef = useRef(null);

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_WIDTHS.collapsed : SIDEBAR_WIDTHS.expanded;

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setIsSidebarOpen(prev => !prev);
    } else {
      setSidebarCollapsed(prev => !prev);
    }
  }, [isMobile]);

  useEffect(() => {
    const updateComponentHeights = () => {
      const mobile = window.innerWidth < parseInt(breakpoints.tablet);
      setIsMobile(mobile);

      if (mobile && isSidebarOpen) {
        setIsSidebarOpen(false);
      } else {
	setIsSidebarOpen(!sidebarCollapsed);
      }

      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight);
      }
    };

    updateComponentHeights();
    const resizeHandler = debounce(updateComponentHeights, 250);
    window.addEventListener('resize', resizeHandler);
    return () => window.removeEventListener('resize', resizeHandler);
  }, [sidebarCollapsed]);

  return (
    <LayoutWrapper>
      <Navbar
        ref={headerRef}
        onMenuClick={toggleSidebar}
        isMobile={isMobile}
        collapsed={sidebarCollapsed}
        setHeaderHeight={setHeaderHeight}
	setIsSidebarOpen={setIsSidebarOpen}
      />

      <Overlay show={isMobile && isSidebarOpen} />

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        isMobile={isMobile}
        isOpen={isSidebarOpen}
        width={sidebarWidth}
        headerHeight={headerHeight}
      />

      <ContentWrapper
        headerHeight={headerHeight}
        sidebarWidth={sidebarWidth}
        isSidebarOpen={isSidebarOpen && !isMobile}
      >
        <MainContent 
          headerHeight={headerHeight}
        >
          {children}
        </MainContent>
        <Footer
          isSidebarOpen={isSidebarOpen && !isMobile}
          sidebarWidth={sidebarWidth}
        />
      </ContentWrapper>
    </LayoutWrapper>
  );
};

export default Layout;

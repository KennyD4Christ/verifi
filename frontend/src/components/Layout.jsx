import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useLocation } from 'react-router-dom';
import Navbar from './common/Navbar';
import Sidebar from './common/Sidebar';
import Footer from './common/Footer';
import { DashboardDateProvider } from '../context/DashboardDateContext';
import Dashboard from './Dashboard';

// Breakpoints for consistent responsive design
const breakpoints = {
  mobile: '480px',
  tablet: '768px',
  laptop: '1024px',
  desktop: '1200px'
};

const LayoutWrapper = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;

  @media (min-width: ${breakpoints.tablet}) {
    flex-direction: row;
  }
`;

const ContentWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
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
  margin-top: ${props => props.headerHeight}px;

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
  z-index: 999;
  transition: opacity 0.3s ease;
  opacity: ${props => (props.show ? 1 : 0)};
`;

const Layout = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(0);
  const location = useLocation();

  const sidebarWidth = sidebarCollapsed ? '80px' : '240px';

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < parseInt(breakpoints.tablet);
      setIsMobile(mobile);

      if (mobile && isSidebarOpen) {
        setIsSidebarOpen(false);
      }

      // Update header height for main content positioning
      const header = document.querySelector('header');
      if (header) {
        setHeaderHeight(header.offsetHeight);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [location, isMobile]);

  const toggleSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(!isSidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  return (
    <LayoutWrapper>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        isMobile={isMobile}
        isOpen={isSidebarOpen}
        width={sidebarWidth}
      />

      <Overlay
        show={isMobile && isSidebarOpen}
        onClick={() => setIsSidebarOpen(false)}
      />

      <ContentWrapper
        sidebarWidth={sidebarWidth}
        isSidebarOpen={isSidebarOpen && !isMobile}
      >
        <Navbar
          onMenuClick={toggleSidebar}
          isMobile={isMobile}
          collapsed={sidebarCollapsed}
          setHeaderHeight={setHeaderHeight}
          setIsSidebarOpen={setIsSidebarOpen}
        />
        <MainContent headerHeight={headerHeight}>
          {children}
        </MainContent>
        <Footer
          isSidebarOpen={isSidebarOpen && !isMobile}
          sidebarWidth={sidebarWidth}
          breakpoints={breakpoints}
        />
      </ContentWrapper>
    </LayoutWrapper>
  );
};

export default Layout;

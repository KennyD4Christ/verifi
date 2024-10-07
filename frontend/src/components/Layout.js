import React, { useState } from 'react';
import styled from 'styled-components';
import Navbar from './common/Navbar';
import Sidebar from './common/Sidebar';
import Footer from './common/Footer';

const LayoutWrapper = styled.div`
  display: flex;
  min-height: 100vh;
`;

const ContentWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: ${props => props.sidebarWidth};
  transition: margin-left 0.3s;
`;

const MainContent = styled.main`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
`;

const Layout = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? '80px' : '200px';

  return (
    <LayoutWrapper>
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <ContentWrapper sidebarWidth={sidebarWidth}>
        <Navbar />
        <MainContent>
          {children}
        </MainContent>
        <Footer />
      </ContentWrapper>
    </LayoutWrapper>
  );
};

export default Layout;

import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';


const SIDEBAR_WIDTHS = {
  expanded: '270px',
  collapsed: '72px',
  mobile: '280px',
};

const breakpoints = {
  mobile: '480px',
  tablet: '768px',
  laptop: '1024px',
  desktop: '1200px'
};

const FooterContainer = styled.footer`
  background-color: #2d3748;
  color: #a0aec0;
  padding: 3rem 1rem;
  width: 100%;
  margin-top: auto;
  margin-bottom: 0px

  @media (min-width: ${breakpoints.tablet}) {
    width: 100%;
  }

  @media (max-width: 768px) {
    padding: 2rem 1rem;
  }
`;

const FooterContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const FooterSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const FooterTitle = styled.h3`
  color: #fff;
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
`;

const FooterLink = styled(Link)`
  color: #a0aec0;
  text-decoration: none;
  transition: color 0.2s ease;
  
  &:hover {
    color: #fff;
  }
`;

const Copyright = styled.div`
  text-align: center;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #4a5568;
  font-size: 0.875rem;
`;

const Footer = () => (
  <FooterContainer>
    <FooterContent>
      <FooterSection>
        <FooterTitle>Verifi</FooterTitle>
        <p>Streamlining your business with powerful accounting and inventory management.</p>
      </FooterSection>
      
      <FooterSection>
        <FooterTitle>Product</FooterTitle>
        <FooterLink to="/features">Features</FooterLink>
        <FooterLink to="/pricing">Pricing</FooterLink>
        <FooterLink to="/integrations">Integrations</FooterLink>
      </FooterSection>
      
      <FooterSection>
        <FooterTitle>Company</FooterTitle>
        <FooterLink to="/about">About Us</FooterLink>
        <FooterLink to="/careers">Careers</FooterLink>
        <FooterLink to="/contact">Contact</FooterLink>
      </FooterSection>
      
      <FooterSection>
        <FooterTitle>Resources</FooterTitle>
        <FooterLink to="/blog">Blog</FooterLink>
        <FooterLink to="/help-center">Help Center</FooterLink>
        <FooterLink to="/api-docs">API Documentation</FooterLink>
      </FooterSection>
    </FooterContent>
    
    <Copyright>
      <p>&copy; {new Date().getFullYear()} Verifi. All rights reserved.</p>
    </Copyright>
  </FooterContainer>
);

export default Footer;

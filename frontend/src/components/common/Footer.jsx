import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';

const FooterContainer = styled.footer`
  background-color: #2d3748;
  color: #a0aec0;
  padding: 3rem 2rem;
`;

const FooterContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
`;

const FooterSection = styled.div`
  flex: 1;
  min-width: 200px;
  margin-bottom: 2rem;
`;

const FooterTitle = styled.h3`
  color: #fff;
  font-size: 1.2rem;
  margin-bottom: 1rem;
`;

const FooterLink = styled(Link)`
  color: #a0aec0;
  text-decoration: none;
  display: block;
  margin-bottom: 0.5rem;

  &:hover {
    color: #fff;
  }
`;

const Copyright = styled.div`
  text-align: center;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #4a5568;
`;

const Footer = () => (
  <FooterContainer>
    <FooterContent>
      <FooterSection>
        <FooterTitle>Finstock</FooterTitle>
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
      <p>&copy; {new Date().getFullYear()} Finstock. All rights reserved.</p>
    </Copyright>
  </FooterContainer>
);

export default Footer;

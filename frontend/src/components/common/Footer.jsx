import React from 'react';
import styled from 'styled-components';

const FooterContainer = styled.footer`
  background-color: #343a40;
  color: #fff;
  text-align: center;
  padding: 20px;
  position: fixed;
  width: 100%;
  bottom: 0;
`;

const Footer = () => (
  <FooterContainer>
    <p>&copy; {new Date().getFullYear()} Finstock. All rights reserved.</p>
  </FooterContainer>
);

export default Footer;

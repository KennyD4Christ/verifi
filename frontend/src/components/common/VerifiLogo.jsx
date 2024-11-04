import React from 'react';
import styled from 'styled-components';

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LogoImage = styled.img`
  height: 2.5rem;
  width: auto;
  object-fit: contain;
  transition: transform 0.3s ease;

  &:hover {
    transform: scale(1.05);
  }
`;

const VerifiLogo = ({ 
  src = "/Logo 4.png", 
  alt = "Verifi Logo", 
  className = "" 
}) => {
  return (
    <LogoContainer className={className}>
      <LogoImage 
        src={src} 
        alt={alt}
        onError={(e) => {
          // Fallback SVG if image fails to load
          e.target.style.display = 'none';
          const fallbackIcon = document.createElement('div');
          fallbackIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" 
              fill="none" stroke="#2b6cb0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="20" height="20" x="2" y="2" rx="2" ry="2"/>
              <path d="M16 8.9V6.3c0-.5-.3-.9-.8-1L13 4.1c-.4-.2-.9-.2-1.3 0L4.8 8.1c-.4.2-.8.6-.8 1.1v6.6c0 .5.3.9.8 1l7 4c.4.2.9.2 1.3 0l7-4c.4-.2.8-.6.8-1.1v-1.4"/>
            </svg>
          `;
          e.target.parentNode.insertBefore(fallbackIcon.firstChild, e.target);
        }}
      />
    </LogoContainer>
  );
};

export default VerifiLogo;

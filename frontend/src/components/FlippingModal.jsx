import React, { useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import PropTypes from 'prop-types';
import { CSSTransition } from 'react-transition-group';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const flipIn = keyframes`
  from {
    transform: rotateX(-90deg);
    opacity: 0;
  }
  to {
    transform: rotateX(0);
    opacity: 1;
  }
`;

const ModalWrapper = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  perspective: 2000px;
  z-index: 1000;
  animation: ${fadeIn} 0.3s ease-out;
`;

const ModalContent = styled.div`
  background-color: white;
  width: 90%;
  max-width: 800px;
  height: 90%;
  max-height: 600px;
  border-radius: 10px;
  transform-style: preserve-3d;
  overflow-y: auto;
  padding: 20px;
  animation: ${flipIn} 0.6s ease-out;
`;

const FlippingModal = ({ isOpen, onClose, children }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'visible';
    }
    return () => {
      document.body.style.overflow = 'visible';
    };
  }, [isOpen]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  return (
    <CSSTransition
      in={isOpen}
      timeout={600}
      classNames="flipping-modal"
      unmountOnExit
    >
      <ModalWrapper 
        onClick={onClose}
        aria-modal="true"
        role="dialog"
      >
        <ModalContent onClick={e => e.stopPropagation()}>
          {children}
        </ModalContent>
      </ModalWrapper>
    </CSSTransition>
  );
};

FlippingModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

export default FlippingModal;

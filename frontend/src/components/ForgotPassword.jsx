import React, { useState } from 'react';
import passwordService from '../services/passwordService';
import styled from 'styled-components';
import { ThemeProvider } from "styled-components";
import { Container, Button } from 'react-bootstrap';


const getThemeValue = (path, fallback) => props => {
  const value = path.split('.').reduce((acc, part) => {
    if (acc && acc[part] !== undefined) return acc[part];
    return undefined;
  }, props.theme);

  return value !== undefined ? value : fallback;
};

const ForgotPasswordContainer = styled(Container)`
  padding: clamp(10px, 3vw, 20px);
  min-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  background-color: ${getThemeValue('colors.background', '#ffffff')};
  color: ${getThemeValue('colors.text.primary', '#2d3748')};
  width: 100%;
  max-width: 100%;

  @media (max-width: 768px) {
    padding: 10px;
  }
`;

const Heading = styled.h1`
  color: ${getThemeValue('colors.text.primary', '#2d3748')};
  margin-bottom: 2.5rem;
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  border-bottom: 2px solid ${getThemeValue('colors.border', '#e2e8f0')};
  padding-bottom: 1rem;
`;

const ActionButton = styled(Button)`
  background-color: ${getThemeValue('colors.primary', '#1a365d')};
  color: white;
  border: none;
  padding: 10px;
  font-weight: bold;
  transition: all 0.3s ease;
  width: 20%;
  white-space: nowrap;
  font-size: clamp(0.875rem, 2vw, 1rem);
  border-radius: 12px;
  margin-top: 20px;
  margin-left: 30px;

  &:hover {
    background-color: #04296a;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  &:disabled {
    opacity: 0.5;
    transform: none;
    box-shadow: none;
  }
`;

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setIsLoading(true);

    try {
      const response = await passwordService.requestPasswordReset(email);
      setMessage('Password reset link has been sent to your email.');
    } catch (error) {
      setError(error.message || 'Failed to send password reset link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ForgotPasswordContainer>
    <div className="forgot-password-container">
      <Heading>Forgot Password</Heading>
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <ActionButton type="submit" disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </ActionButton>
      </form>
    </div>
    </ForgotPasswordContainer>	  
  );
};

export default ForgotPassword;

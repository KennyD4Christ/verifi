import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import styled from 'styled-components';
import { Container, Row, Col, Form, Button, Alert, Card } from 'react-bootstrap';
import { QRCodeSVG } from "qrcode.react";

// Styled Components
const StyledCard = styled(Card)`
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: none;
  border-radius: 8px;
  margin-top: 2rem;
  margin-bottom: 2rem;
`;

const PageContainer = styled(Container)`
  min-height: 100vh;
  padding: 2rem 1rem;
  background-color: #f8f9fa;
`;

const StyledForm = styled(Form)`
  padding: 1rem;
`;

const FormTitle = styled.h2`
  color: #2c3e50;
  text-align: center;
  margin-bottom: 2rem;
  font-weight: 600;
`;

const StyledButton = styled(Button)`
  width: 100%;
  padding: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 1rem;
  
  &:disabled {
    cursor: not-allowed;
  }
`;

const StyledLink = styled(Link)`
  color: #007bff;
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
`;

const LinkContainer = styled.p`
  text-align: center;
  margin-top: 1.5rem;
  color: #6c757d;
`;

const Register = () => {
  // Original form state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // New 2FA setup state
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [setupStep, setSetupStep] = useState(0); // 0: not started, 1: QR code, 2: verification
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);

  const { login, setUser } = useAuth();
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    if (!username) newErrors.username = "Username is required";
    if (!email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Email is invalid";
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 8) newErrors.password = "Password must be at least 8 characters";
    if (!firstName) newErrors.firstName = "First name is required";
    if (!lastName) newErrors.lastName = "Last name is required";
    if (!phoneNumber) newErrors.phoneNumber = "Phone number is required";
    else if (!/^\+?1?\d{9,15}$/.test(phoneNumber)) newErrors.phoneNumber = "Phone number is invalid";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validate2FAForm = () => {
    const newErrors = {};
    if (!verificationCode) newErrors.verificationCode = "Verification code is required";
    else if (!/^\d{6}$/.test(verificationCode)) newErrors.verificationCode = "Verification code must be 6 digits";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrors({});
    setIsLoading(true);

    if (!validateForm()) {
      setIsLoading(false);
      return;
    }

    try {
      const registerResponse = await authService.register(
        username, email, password, firstName, lastName, phoneNumber
      );

      const loginResponse = await login(username, password);
      setUser(loginResponse.user);

      // Instead of navigating to dashboard, show 2FA setup option
      setRegistrationComplete(true);
      setIsLoading(false);
    } catch (error) {
      setError(error.message || 'Registration failed. Please try again.');
      if (error.response?.data) {
        setErrors(error.response.data);
      }
      setIsLoading(false);
    }
  };

  const initiate2FASetup = async () => {
    setIsLoading(true);
    try {
      // This would be your API call to get the 2FA setup information
      const response = await authService.get2FASetupInfo();

      setQrCodeUrl(response.qrCodeUrl);
      setSecret(response.secret);
      setSetupStep(1);
    } catch (error) {
      setError('Failed to initialize 2FA setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const verify2FASetup = async (e) => {
    e.preventDefault();

    if (!validate2FAForm()) {
      return;
    }

    setIsLoading(true);
    try {
      // Verify the code and enable 2FA
      const response = await authService.enable2FA(verificationCode);

      // Store recovery codes
      setRecoveryCodes(response.recoveryCodes);
      setSetupStep(2);
    } catch (error) {
      setError('Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const complete2FASetup = () => {
    // User has seen their recovery codes and completed setup
    setShowRecoveryCodes(false);
    navigate('/dashboard');
  };

  const skipSetup = () => {
    // User chooses to skip 2FA setup
    navigate('/dashboard');
  };

  // Initial registration form
  if (!registrationComplete) {
    return (
      <PageContainer>
        <Row className="justify-content-center">
          <Col xs={12} sm={10} md={8} lg={6}>
            <StyledCard>
              <Card.Body>
                <FormTitle>Create an Account</FormTitle>
                {error && <Alert variant="danger">{error}</Alert>}

                <StyledForm onSubmit={handleSubmit}>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>First Name</Form.Label>
                        <Form.Control
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          isInvalid={!!errors.firstName}
                        />
                        <Form.Control.Feedback type="invalid">
                          {errors.firstName}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Last Name</Form.Label>
                        <Form.Control
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          isInvalid={!!errors.lastName}
                        />
                        <Form.Control.Feedback type="invalid">
                          {errors.lastName}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Group className="mb-3">
                    <Form.Label>Username</Form.Label>
                    <Form.Control
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      isInvalid={!!errors.username}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.username}
                    </Form.Control.Feedback>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      isInvalid={!!errors.email}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.email}
                    </Form.Control.Feedback>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Phone Number</Form.Label>
                    <Form.Control
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      isInvalid={!!errors.phoneNumber}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.phoneNumber}
                    </Form.Control.Feedback>
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label>Password</Form.Label>
                    <Form.Control
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      isInvalid={!!errors.password}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.password}
                    </Form.Control.Feedback>
                    <Form.Text className="text-muted">
                      Password must be at least 8 characters long
                    </Form.Text>
                  </Form.Group>

                  <StyledButton
                    variant="primary"
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </StyledButton>
                </StyledForm>

                <LinkContainer>
                  Already have an account? <StyledLink to="/login">Sign in</StyledLink>
                </LinkContainer>
              </Card.Body>
            </StyledCard>
          </Col>
        </Row>
      </PageContainer>
    );
  }

  // 2FA Setup Process
  return (
    <PageContainer>
      <Row className="justify-content-center">
        <Col xs={12} sm={10} md={8} lg={6}>
          <StyledCard>
            <Card.Body>
              {setupStep === 0 && (
                <>
                  <FormTitle>Enhance Your Account Security</FormTitle>
                  <div className="text-center mb-4">
                    <Alert variant="success">
                      Your account was created successfully!
                    </Alert>
                    <p className="mb-4">
                      Would you like to set up two-factor authentication (2FA) to protect your account?
                    </p>
                    <div className="d-flex justify-content-center gap-3">
                      <StyledButton
                        variant="primary"
                        onClick={initiate2FASetup}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Loading...' : 'Set Up 2FA'}
                      </StyledButton>
                      <StyledButton
                        variant="outline-secondary"
                        onClick={skipSetup}
                      >
                        Skip for Now
                      </StyledButton>
                    </div>
                    <p className="mt-3 text-muted small">
                      You can always set up 2FA later from your account settings.
                    </p>
                  </div>
                </>
              )}

              {setupStep === 1 && (
                <>
                  <FormTitle>Set Up Two-Factor Authentication</FormTitle>
                  {error && <Alert variant="danger">{error}</Alert>}
                  <div className="mb-4">
                    <p>
                      Scan this QR code with your authenticator app (like Google Authenticator,
                      Authy, or Microsoft Authenticator).
                    </p>
                    <div className="d-flex justify-content-center my-4">
                      <QRCodeSVG value={qrCodeUrl} size={200} />
                    </div>
                    <div className="mb-4">
                      <p className="fw-bold">Can't scan the QR code?</p>
                      <p>Manually enter this secret key in your app:</p>
                      <Alert variant="secondary" className="text-center">
                        <code className="fs-5">{secret}</code>
                      </Alert>
                    </div>
                    <StyledForm onSubmit={verify2FASetup}>
                      <Form.Group className="mb-3">
                        <Form.Label>Enter the 6-digit verification code from your app</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="000000"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          isInvalid={!!errors.verificationCode}
                          maxLength={6}
                        />
                        <Form.Control.Feedback type="invalid">
                          {errors.verificationCode}
                        </Form.Control.Feedback>
                      </Form.Group>
                      <div className="d-flex justify-content-between">
                        <StyledButton
                          variant="outline-secondary"
                          onClick={() => {
                            setSetupStep(0);
                            setError('');
                          }}
                          type="button"
                        >
                          Back
                        </StyledButton>
                        <StyledButton
                          variant="primary"
                          type="submit"
                          disabled={isLoading}
                        >
                          {isLoading ? 'Verifying...' : 'Verify and Continue'}
                        </StyledButton>
                      </div>
                    </StyledForm>
                  </div>
                </>
              )}

              {setupStep === 2 && (
                <>
                  <FormTitle>Two-Factor Authentication Enabled</FormTitle>
                  <Alert variant="success" className="mb-4">
                    <div className="d-flex align-items-center">
                      <div className="me-3">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div>Two-factor authentication has been successfully enabled for your account.</div>
                    </div>
                  </Alert>

                  <div className="mb-4">
                    <p className="fw-bold">Important: Save Your Recovery Codes</p>
                    <p>
                      If you lose access to your authenticator app, you'll need these recovery codes to log in.
                      Each code can only be used once.
                    </p>

                    <div className="text-center mb-3">
                      <StyledButton
                        variant="outline-primary"
                        onClick={() => setShowRecoveryCodes(true)}
                        className="mb-2"
                      >
                        {showRecoveryCodes ? 'Hide Recovery Codes' : 'Show Recovery Codes'}
                      </StyledButton>
                    </div>

                    {showRecoveryCodes && (
                      <div className="mb-4">
                        <Alert variant="secondary">
                          <div className="d-flex flex-wrap justify-content-center gap-2">
                            {recoveryCodes.map((code, index) => (
                              <code key={index} className="p-2 bg-light rounded">{code}</code>
                            ))}
                          </div>
                        </Alert>
                        <div className="d-flex justify-content-center mt-2">
                          <StyledButton
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(recoveryCodes.join('\n'));
                              // Optionally show a copy success message
                            }}
                          >
                            Copy All Codes
                          </StyledButton>
                        </div>
                        <p className="text-center mt-3 text-danger small">
                          Make sure to save these codes in a secure location.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="d-flex justify-content-center">
                    <StyledButton
                      variant="primary"
                      onClick={complete2FASetup}
                    >
                      Continue to Dashboard
                    </StyledButton>
                  </div>
                </>
              )}
            </Card.Body>
          </StyledCard>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default Register;

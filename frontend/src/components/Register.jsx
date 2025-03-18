import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import styled from 'styled-components';
import { Container, Row, Col, Form, Button, Alert, Card } from 'react-bootstrap';

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
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

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
      navigate('/dashboard');
    } catch (error) {
      setError(error.message || 'Registration failed. Please try again.');
      if (error.response?.data) {
        setErrors(error.response.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

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
};

export default Register;

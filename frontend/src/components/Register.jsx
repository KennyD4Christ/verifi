import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';

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
      console.log('Starting registration process');
      console.log('Registration data:', { username, email, password, firstName, lastName, phoneNumber });
      // Register the use
      const registerResponse = await authService.register(username, email, password, firstName, lastName, phoneNumber);
      console.log('Registration successful:', registerResponse);

      // Log in the user after successful registration
      console.log('Starting login process');
      const loginResponse = await login(username, password);
      console.log('Login successful:', loginResponse);

      // Set the user in the auth context
      setUser(loginResponse.user);
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Registration/Login failed:', error);
      setError(error.message || 'Registration failed. Please try again.');
      if (error.response && error.response.data) {
        setErrors(error.response.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2>Register</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
	<div>
	  <label htmlFor="username">Username:</label>
	  <input
	    type="text"
	    id="username"
	    value={username}
	    onChange={(e) => setUsername(e.target.value)}
	    required
	  />
	  {errors.username && <p style={{ color: 'red' }}>{errors.username}</p>}
	</div>
	<div>
	  <label htmlFor="email">Email:</label>
	  <input
	    type="email"
	    id="email"
	    value={email}
	    onChange={(e) => setEmail(e.target.value)}
	    required
	  />
	  {errors.email && <p style={{ color: 'red' }}>{errors.email}</p>}
	</div>
	<div>
	  <label htmlFor="password">Password:</label>
	  <input
	    type="password"
	    id="password"
	    value={password}
	    onChange={(e) => setPassword(e.target.value)}
	    required
	  />
	  {errors.password && <p style={{ color: 'red' }}>{errors.password}</p>}
	</div>
	<div>
	  <label htmlFor="firstName">First Name:</label>
	  <input
	    type="text"
	    id="firstName"
	    value={firstName}
	    onChange={(e) => setFirstName(e.target.value)}
	    required
	  />
	  {errors.firstName && <p style={{ color: 'red' }}>{errors.firstName}</p>}
	</div>
	<div>
	  <label htmlFor="lastName">Last Name:</label>
	  <input
	    type="text"
	    id="lastName"
	    value={lastName}
	    onChange={(e) => setLastName(e.target.value)}
	    required
	  />
	  {errors.lastName && <p style={{ color: 'red' }}>{errors.lastName}</p>}
	</div>
	<div>
	  <label htmlFor="phoneNumber">Phone Number:</label>
	  <input
	    type="tel"
	    id="phoneNumber"
	    value={phoneNumber}
	    onChange={(e) => setPhoneNumber(e.target.value)}
	    required
	  />
	  {errors.phoneNumber && <p style={{ color: 'red' }}>{errors.phoneNumber}</p>}
	</div>
	<button type="submit" disabled={isLoading}>
	  {isLoading ? 'Registering...' : 'Register'}
	</button>
      </form>
      <p>
	Already have an account? <Link to="/login">Login here</Link>
      </p>
    </div>
  );
};

export default Register;

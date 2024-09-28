import React, { useState } from 'react';
import axios from 'axios';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const response = await axios.post('/api/send-password-reset-email/', { email });
      setMessage('Password reset link has been sent to your email.');
    } catch (error) {
      setError('Failed to send password reset link. Please try again.');
      console.error('Forgot Password error:', error);
    }
  };

  return (
    <div className="forgot-password-container">
      <h2>Forgot Password</h2>
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
	  />
	</div>
	<button type="submit">Send Reset Link</button>
      </form>
    </div>
  );
};

export default ForgotPassword;

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { uidb64, token } = useParams();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const response = await axios.post(`/api/reset-password/${uidb64}/${token}/`, { new_password: newPassword });
      setMessage('Password has been reset. You can now log in.');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      setError('Failed to reset password. Please try again.');
      console.error('Reset Password error:', error);
    }
  };

  return (
    <div className="reset-password-container">
      <h2>Reset Password</h2>
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
	<div className="form-group">
	  <label htmlFor="new-password">New Password:</label>
	  <input
	    type="password"
	    id="new-password"
	    value={newPassword}
	    onChange={(e) => setNewPassword(e.target.value)}
	    required
	  />
	</div>
	<button type="submit">Reset Password</button>
      </form>
    </div>
  );
};

export default ResetPassword;
      

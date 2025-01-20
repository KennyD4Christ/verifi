import axiosInstance from './api';

const USERS_URL = '/users/';

const passwordService = {
  // Request password reset email
  requestPasswordReset: async (email) => {
    try {
      const response = await axiosInstance.post('/users/password-reset-request/', { email });
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(error.response.data.error || 'Failed to send reset email');
      }
      throw new Error('Network error occurred');
    }
  },

  // Reset password with token
  resetPassword: async (uidb64, token, newPassword) => {
    try {
      if (!newPassword) {
        throw new Error('Password is required');
      }
    
      const response = await axiosInstance.post(
        `/users/reset-password/${uidb64}/${token}/`,
        { new_password: newPassword }
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 400) {
        throw new Error('Invalid password reset request');
      } else if (error.response?.status === 404) {
        throw new Error('Password reset link is invalid or has expired');
      }
      throw new Error(error.response?.data?.error || 'Failed to reset password');
    }
  }
};

export default passwordService;

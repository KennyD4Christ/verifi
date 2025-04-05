import axiosInstance from './api';

const USERS_URL = '/users/';

const authService = {
  // Login user
  login: async (username, password, code = null, backupCode = null) => {
    try {
      console.log('Auth service login called with:', { 
        username, 
        passwordProvided: !!password, 
        codeProvided: !!code, 
        backupCodeProvided: !!backupCode 
      });
      
      const payload = { username };
      
      // Always include password if provided
      if (password) {
        payload.password = password;
      }
      
      // Add 2FA verification codes if provided
      if (code) {
        payload.code = code;
      }
      
      if (backupCode) {
        payload.backup_code = backupCode;
      }

      // Make sure we're using the correct API endpoint
      const endpoint = '/users/auth/login/';
      console.log(`Making login request to ${endpoint} with payload:`, payload);
      
      const response = await axiosInstance.post(endpoint, payload);
      console.log('Login response:', response.data);
    
      // Check if 2FA is required
      if (response.data.requires_2fa) {
        // Return response in the format expected by AuthContext
        return {
          requires_2fa: true, // Use underscore to match backend
          username,
          message: response.data.message || '2FA verification required'
        };
      }
    
      // Normal login success with token
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      
        // Set the token for subsequent requests
        axiosInstance.defaults.headers.common['Authorization'] = `Token ${response.data.token}`;
      
        return {
          token: response.data.token,
          user: response.data.user,
          roles: response.data.roles || [],
          permissions: response.data.permissions || []
        };
      }

      throw new Error('Login failed: Invalid response format');
    } catch (error) {
      console.error('Login error:', error);
      console.error('Response data:', error.response?.data);

      // More specific error handling
      if (error.response?.status === 400) {
        if (error.response?.data?.error === "Invalid 2FA code") {
          throw new Error('Invalid verification code. Please try again.');
        }
        // Check for password validation error
        if (error.response?.data?.password) {
          throw new Error(`Password error: ${error.response.data.password}`);
        }
        // General validation errors
        if (error.response?.data?.errors) {
          throw new Error(JSON.stringify(error.response.data.errors));
        }
      }

      throw new Error(error.response?.data?.error || error.response?.data?.detail || error.message || 'Login failed');
    }
  },

  // Add 2FA specific methods
  setup2FA: async (password) => {
    try {
      const response = await axiosInstance.post('/users/users/enable_2fa/', { password });
      return response.data;
    } catch (error) {
      console.error('2FA setup error:', error);
      throw new Error(error.response?.data?.detail || 'Failed to setup 2FA');
    }
  },

  verify2FA: async (code) => {
    try {
      const response = await axiosInstance.post('/users/users/verify_2fa/', { code });
      return response.data;
    } catch (error) {
      console.error('2FA verification error:', error);
      throw new Error(error.response?.data?.detail || 'Failed to verify 2FA');
    }
  },

  disable2FA: async (password) => {
    try {
      const response = await axiosInstance.post('/users/users/disable_2fa/', { password });
      return response.data;
    } catch (error) {
      console.error('2FA disable error:', error);
      throw new Error(error.response?.data?.detail || 'Failed to disable 2FA');
    }
  },

  regenerateBackupCodes: async (password) => {
    try {
      const response = await axiosInstance.post('/users/users/regenerate_backup_codes/', { password });
      return response.data;
    } catch (error) {
      console.error('Regenerate backup codes error:', error);
      throw new Error(error.response?.data?.detail || 'Failed to regenerate backup codes');
    }
  },

  // Logout user
  logout: async () => {
    try {
      await axiosInstance.post('/users/auth/logout/');
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      localStorage.removeItem('token');
      // Also remove the Authorization header
      delete axiosInstance.defaults.headers.common['Authorization'];
    }
  },

  // Register user
  register: async (username, email, password, firstName, lastName, phoneNumber) => {
    try {
      const response = await axiosInstance.post(`/users/register/`, {
        username,
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber
      });
      return response.data;
    } catch (error) {
      console.error('Registration error:', error);
      if (error.response) {
        console.error('Server response:', error.response.data);
        throw new Error(error.response.data.detail || JSON.stringify(error.response.data));
      } else if (error.request) {
        throw new Error('No response received from server');
      } else {
        throw new Error('Error setting up request');
      }
    }
  },

  // Get All user
  getAllUsers: async () => {
    try {
      const response = await axiosInstance.get(`${USERS_URL}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch users');
    }
  },

  // Get user by Id
  getUser: async (id) => {
    try {
      const response = await axiosInstance.get(`${USERS_URL}${id}/`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        throw new Error('Not authenticated');
      }
      throw new Error(error.response?.data?.detail || 'Failed to fetch user data');
    }
  },

  //Get current user data
  getCurrentUser: async () => {
    console.log('getCurrentUser called');
    try {
      const response = await axiosInstance.get('/users/me/');
      console.log('getCurrentUser response:', response.data);
      return response.data;
    } catch (error) {
      console.error('getCurrentUser error:', error);
      throw error;
    }
  }
};

export default authService;

import axiosInstance from './api';

const USERS_URL = '/users/';

const authService = {
  // Login user
  login: async (username, password, code = null, backupCode = null) => {
    try {
      const payload = { 
        username, 
        password,
        ...(code && { code }),
        ...(backupCode && { backup_code: backupCode })
      };

      const response = await axiosInstance.post('/users/auth/login/', payload);

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);

        // Fetch user data after successful login
        const userResponse = await axiosInstance.get('/users/me/');
        return { token: response.data.token, user: userResponse.data };
      }

      throw new Error('Login failed: No token received');
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  },

  // Add 2FA specific methods
  setup2FA: async (password) => {
    const response = await axiosInstance.post('/users/users/enable_2fa/', { password });
    return response.data;
  },
  
  verify2FA: async (code) => {
    const response = await axiosInstance.post('/users/users/verify_2fa/', { code });
    return response.data;
  },
  
  disable2FA: async (password) => {
    const response = await axiosInstance.post('/users/users/disable_2fa/', { password });
    return response.data;
  },
  
  regenerateBackupCodes: async (password) => {
    const response = await axiosInstance.post('/users/users/regenerate_backup_codes/', { password });
    return response.data;
  },

  // Logout user
  logout: async () => {
    try {
      await axiosInstance.post('/users/auth/logout/');
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      localStorage.removeItem('token');
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
      const response = await axiosInstance.get(USERS_URL);
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

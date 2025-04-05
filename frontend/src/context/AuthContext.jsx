import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import authService from '../services/authService';
import { isTokenPresent, getAuthHeader } from '../utils/auth';
import fetchUserPermissions from '../services/api';


export const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [tempPassword, setTempPassword] = useState(''); // Added for 2FA flow

  // Set token in localStorage
  const setToken = (token, rememberMe = false) => {
    if (token) {
      localStorage.setItem('token', token);
      console.log('Token set in localStorage');
    } else {
      localStorage.removeItem('token');
      console.log('Token removed from localStorage');
    }
  };

  const isAuthenticated = useCallback(() => {
    console.log('isAuthenticated called. Token present:', isTokenPresent());
    return isTokenPresent();
  }, []);

  // Load user permissions after authentication
  const loadUserPermissions = async () => {
    try {
      console.log('Loading user permissions...');
      setIsLoadingPermissions(true);
      const { permissions } = await fetchUserPermissions();
      setPermissions(permissions);
      console.log('Permissions loaded successfully');
    } catch (error) {
      console.error('Failed to load user permissions:', error);
      setPermissions([]);
    } finally {
      setIsLoadingPermissions(false);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      console.log('Fetching user...');
      if (!isTokenPresent()) {
        console.log('No token present, setting states');
        setLoading(false);
        setUser(null);
        setAuthChecked(true);
        setIsInitialized(true);
        console.log('isInitialized set to true (no token)');
        return;
      }

      try {
        console.log('Token present, fetching current user');
        const currentUser = await authService.getCurrentUser();
        console.log('Current user fetched:', currentUser);
        setUser(currentUser);

        // Load permissions after user is fetched
        await loadUserPermissions();
      } catch (error) {
        console.error('Failed to fetch user:', error);
        setError(error.message || 'An error occurred while fetching user data');
        // Handle authentication errors
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        console.log('Setting authChecked to true');
        setLoading(false);
        setIsInitialized(true);
        setAuthChecked(true);
        console.log('isInitialized set to true (after fetch)');
      }
    };

    fetchUser();
  }, []);

  const login = async (username, password, rememberMe = false, code = null, backupCode = null) => {
    try {
      console.log('Login attempt initiated with:', {
        username,
        passwordProvided: !!password,
        codeProvided: !!code,
        backupCodeProvided: !!backupCode
      });

      setLoading(true);
      setError(null); // Clear previous errors

      // Call authService with credentials
      const response = await authService.login(username, password, code, backupCode);
      console.log('Login response received:', response);

      // If 2FA is required (note: use requires_2fa to match backend)
      if (response.requires_2fa) {
        console.log('2FA required, storing credentials temporarily');
        setRequires2FA(true);
        setTempUsername(username);
        setTempPassword(password); // Store password for later use
        return { requires2FA: true, data: response };
      }

      // Normal login flow
      console.log('Login successful, storing token and user data');
      const { token, user } = response;
      setToken(token, rememberMe);
      setUser(user);

      // Reset 2FA state if any
      setRequires2FA(false);
      setTempUsername('');
      setTempPassword('');

      // Load user permissions
      await loadUserPermissions();

      return response;
    } catch (error) {
      console.error('Login failed:', error);
      setError(error.message || 'Login failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Complete 2FA verification
  const complete2FALogin = async (code, useBackupCode = false) => {
    try {
      console.log('Completing 2FA login with:', {
        username: tempUsername,
        passwordStored: !!tempPassword,
        code: useBackupCode ? null : code,
        backupCode: useBackupCode ? code : null
      });

      // Make sure we have the required credentials
      if (!tempUsername || !tempPassword) {
        const errorMsg = 'Missing credentials for 2FA completion';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Call login again with saved credentials and 2FA code
      const response = await authService.login(
        tempUsername,
        tempPassword,
        useBackupCode ? null : code,
        useBackupCode ? code : null
      );

      console.log('2FA completion response:', response);

      // Process successful login
      const { token, user } = response;
      setToken(token);
      setUser(user);

      // Clear temporary data
      setRequires2FA(false);
      setTempUsername('');
      setTempPassword('');

      // Load user permissions
      await loadUserPermissions();

      return response;
    } catch (error) {
      console.error('2FA completion failed:', error);
      throw error;
    }
  };

  // Add 2FA setup methods
  const setup2FA = async (password) => {
    try {
      return await authService.setup2FA(password);
    } catch (error) {
      console.error('Setup 2FA failed:', error);
      throw error;
    }
  };

  const verify2FA = async (code) => {
    try {
      const response = await authService.verify2FA(code);

      // Update user state to reflect 2FA is now enabled
      setUser(prev => ({
        ...prev,
        two_factor_enabled: true
      }));

      return response;
    } catch (error) {
      console.error('Verify 2FA failed:', error);
      throw error;
    }
  };

  const disable2FA = async (password) => {
    try {
      const response = await authService.disable2FA(password);

      // Update user state to reflect 2FA is now disabled
      setUser(prev => ({
        ...prev,
        two_factor_enabled: false
      }));

      return response;
    } catch (error) {
      console.error('Disable 2FA failed:', error);
      throw error;
    }
  };

  const regenerateBackupCodes = async (password) => {
    try {
      return await authService.regenerateBackupCodes(password);
    } catch (error) {
      console.error('Regenerate backup codes failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('Logging out...');
      await authService.logout();
      setUser(null);
      console.log('Logout successful');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      // Even if the server-side logout fails, we should clear the local auth state
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  // Method to check if user has a specific permission
  const hasPermission = (requiredPermission) => {
    return permissions.some(permission =>
      permission.name === requiredPermission || permission.id === requiredPermission
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        error,
        login,
        complete2FALogin,
        requires2FA,
        setup2FA,
        verify2FA,
        disable2FA,
        regenerateBackupCodes,
        logout,
        hasPermission,
        isLoadingPermissions,
        permissions,
        isAuthenticated,
        isInitialized,
        authChecked
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;

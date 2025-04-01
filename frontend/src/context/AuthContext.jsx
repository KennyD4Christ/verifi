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

  // Add the missing setToken function
  const setToken = (token, rememberMe = false) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  };

  const isAuthenticated = useCallback(() => {
    console.log('isAuthenticated called. Token present:', isTokenPresent());
    return isTokenPresent();
  }, []);

  // Load user permissions after authentication
  const loadUserPermissions = async () => {
    try {
      setIsLoadingPermissions(true);
      const { permissions } = await fetchUserPermissions();
      setPermissions(permissions);
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
      setLoading(true);

      // Call authService with 2FA credentials if available
      const response = await authService.login(username, password, code, backupCode);

      // If 2FA is required, update state and return early
      if (response.requires_2fa) {
        setRequires2FA(true);
        setTempUsername(username);
        return { requires2FA: true };
      }

      // Normal login flow
      const { token, user } = response;
      setToken(token, rememberMe);
      setUser(user);

      // Load user permissions
      await loadUserPermissions();

      // Reset 2FA state variables in case they were previously set
      setRequires2FA(false);
      setTempUsername('');

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
      const response = await authService.login(
        tempUsername,
        null,
        useBackupCode ? null : code,
        useBackupCode ? code : null
      );

      const { token, user } = response;
      setToken(token);
      setUser(user);
      setRequires2FA(false);
      setTempUsername('');

      return response;
    } catch (error) {
      throw error;
    }
  };

  // Add 2FA setup methods
  const setup2FA = async (password) => {
    try {
      return await authService.setup2FA(password);
    } catch (error) {
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
      throw error;
    }
  };

  const regenerateBackupCodes = async (password) => {
    try {
      return await authService.regenerateBackupCodes(password);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
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
    return permissions.includes(requiredPermission);
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

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

  const login = async (username, password) => {
    try {
      setLoading(true);
      const userData = await authService.login(username, password);
      if (userData && userData.token) {
        localStorage.setItem('token', userData.token);
        setUser(userData.user);
	await loadUserPermissions();
        return userData;
      } else {
        throw new Error('Invalid user data received');
      }
    } catch (error) {
      console.error('Login failed:', error);
      setError(error.message || 'Login failed');
      throw error;
    } finally {
      setLoading(false);
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

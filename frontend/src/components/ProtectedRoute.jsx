import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DashboardDateProvider } from '../context/DashboardDateContext';

const ProtectedRoute = () => {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated()) {
    console.log('Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  return (
    <DashboardDateProvider>
      <Outlet />
    </DashboardDateProvider>
  );
};

export default ProtectedRoute;

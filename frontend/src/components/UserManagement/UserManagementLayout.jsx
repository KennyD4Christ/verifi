import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import UserListPage from './UserListPage';
import UserRolesPage from '../UserRolesPage';
import PermissionsPage from './PermissionsPage';
import { Navigate } from 'react-router-dom';

const UserManagementLayout = () => {
  const location = useLocation();

  return (
    <div className="flex">
      <div className="w-64 bg-gray-100 p-4 min-h-screen">
        <h2 className="text-xl font-bold mb-6">User Management</h2>
        <nav>
          <ul className="space-y-2">
            <li>
              <Link
                to="/user-management/users"
                className={`block py-2 px-4 rounded ${
                  location.pathname.includes('/users') ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'
                }`}
              >
                User List
              </Link>
            </li>
            <li>
              <Link
                to="/user-management/roles"
                className={`block py-2 px-4 rounded ${
                  location.pathname.includes('/roles') ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'
                }`}
              >
                Roles
              </Link>
            </li>
            <li>
              <Link
                to="/user-management/permissions"
                className={`block py-2 px-4 rounded ${
                  location.pathname.includes('/permissions') ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'
                }`}
              >
                Permissions
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="flex-1 p-6">
        <Routes>
          <Route path="users" element={<UserListPage />} />
          <Route path="roles" element={<UserRolesPage />} />
          <Route path="permissions" element={<PermissionsPage />} />
          <Route path="*" element={<Navigate to="users" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default UserManagementLayout;

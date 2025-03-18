import React, { createContext, useState, useEffect, useContext } from 'react';
import { fetchUsers, createUser, updateUser, deleteUser } from '../services/api';
import { useAuth } from './AuthContext';

export const UserContext = createContext();

const UserProvider = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUsers = async () => {
      if (!isAuthenticated()) {
	setLoading(false);
	return;
      }

      try {
	const data = await fetchUsers();
	setUsers(data);
      } catch (error) {
	console.error('Failed to fetch users:', error);
      } finally {
	setLoading(false);
      }
    };

    loadUsers();
  }, [isAuthenticated]);

  const addUser = async (user) => {
    try {
      const newUser = await createUser(user);
      setUsers((prevUsers) => [...prevUsers, newUser]);
    } catch (error) {
      throw new Error('Failed to create user');
    }
  };

  const editUser = async (id, user) => {
    try {
      const updatedUser = await updateUser(id, user);
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === id ? updatedUser : u))
      );
    } catch (error) {
      throw new Error('Failed to update user');
    }
  };

  const removeUser = async (id) => {
    try {
      await deleteUser(id);
      setUsers((prevUsers) => prevUsers.filter((u) => u.id !== id));
    } catch (error) {
      throw new Error('Failed to delete user');
    }
  };

  return (
    <UserContext.Provider value={{ users, loading, addUser, editUser, removeUser }}>
      {children}
    </UserContext.Provider>
  );
};

export default UserProvider;

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Table, Modal, Button, Spinner, Alert, Form } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { fetchUsers, fetchRoles, updateUser, updateUserRoles } from '../../services/api';
import { getUsersPagination } from '../../services/api';

const UserListWrapper = styled.div`
  padding: 20px;
`;

const TableHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const UserListPage = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [usersResponse, rolesData] = await Promise.all([
          fetchUsers(currentPage),
          fetchRoles()
        ]);

	console.group('User List Page Data Fetch');
        console.log('Users Response:', usersResponse);
        console.log('Roles Data:', rolesData);
        console.groupEnd();

        // Normalize users data
        const userArray = Array.isArray(usersResponse)
          ? usersResponse
          : usersResponse?.results
            ? usersResponse.results
            : [usersResponse];

        // Normalize roles data
        const normalizedUsers = userArray.map((user, index) => ({
          ...user,
          // Ensure roles is always an array and have a stable unique identifier
          tempId: user.id || `temp-${index}`,
          roleIds: user.roles
            ? (Array.isArray(user.roles)
                ? user.roles.map(role => role.id || role)
                : [user.roles])
            : []
        }));

        setUsers(normalizedUsers);
        setRoles(rolesData);

        // Check for pagination in usersResponse
        if (usersResponse.count !== undefined) {
          setPagination(getUsersPagination(usersResponse));
        } else if (usersResponse.pagination) {
          setPagination(usersResponse.pagination);
        }
      } catch (err) {
        console.error('Comprehensive Fetch Data Error:', err);
        setError(`Failed to fetch data: ${err.message}`);
        toast.error(`Failed to fetch data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPage]);

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setSelectedUser(null);
    setShowEditModal(false);
  };

  const handleRoleChange = async (user, roleId, isChecked) => {
    // Ensure we have a valid user identifier
    if (!user || (!user.id && !user.tempId)) {
      toast.error('Cannot update roles for an undefined user');
      return;
    }

    try {
      setUpdating(true);

      // Standardize user ID extraction
      const userId = user.id || user.tempId;
      const cleanUserId = userId.toString().replace(/^(user-|temp-)/, '').split('-')[0];

      // Find the current user
      const currentUser = users.find(u => 
        u.id === userId || u.tempId === user.tempId
      );

      // Ensure roleIds is always an array of numbers
      const currentRoleIds = currentUser.roleIds 
        ? Array.isArray(currentUser.roleIds)
          ? currentUser.roleIds.map(id => 
              typeof id === 'string' ? parseInt(id, 10) : 
              typeof id === 'number' ? id : null
            ).filter(id => id !== null)
          : []
        : [];

      // Ensure roleId is a number
      const numericRoleId = typeof roleId === 'string' 
        ? parseInt(roleId, 10) 
        : roleId;

      // Compute new role IDs
      const newRoleIds = isChecked
        ? [...new Set([...currentRoleIds, numericRoleId])]
        : currentRoleIds.filter(existingId => existingId !== numericRoleId);

      console.log('Role Update Details:', {
        userId: cleanUserId,
        currentRoleIds,
        newRoleIds,
        roleId: numericRoleId,
        isChecked
      });

      // Always proceed with update, even if removing last role
      await updateUserRoles(cleanUserId, { role_ids: newRoleIds });
      
      // Update local state
      setUsers(prevUsers =>
        prevUsers.map(u =>
          (u.id === userId || u.tempId === user.tempId)
            ? {
                ...u,
                roleIds: newRoleIds,
                roles: roles.filter(r => newRoleIds.includes(r.id))
              }
            : u
        )
      );

      toast.success('User roles updated successfully');

    } catch (err) {
      console.error('Detailed Role Update Error:', err);
      toast.error(`Failed to update roles: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  // Validation function
  const validateUserUpdate = (userData) => {
    const errors = {};

    // Username validation
    if (!userData.username) {
      errors.username = 'Username is required';
    } else if (userData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters long';
    }

    // Email validation
    if (!userData.email) {
      errors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        errors.email = 'Please enter a valid email address';
      }
    }

    return errors;
  };

  const handleSaveUser = async () => {
    // Validate input before submission
    const validationErrors = validateUserUpdate(selectedUser);
  
    // If there are validation errors, show them and prevent submission
    if (Object.keys(validationErrors).length > 0) {
      Object.values(validationErrors).forEach(error => 
        toast.error(error, { 
          position: "top-right",
          closeOnClick: true,
          pauseOnHover: true 
        })
      );
      return;
    }

    try {
      // Start updating state
      setUpdating(true);

      // Prepare user data for update
      const userUpdatePayload = {
        username: selectedUser.username.trim(),
        email: selectedUser.email.trim(),
      
        // Include any additional fields supported by your backend
        ...(selectedUser.first_name && { first_name: selectedUser.first_name }),
        ...(selectedUser.last_name && { last_name: selectedUser.last_name }),
      
        // Role update specifically using the backend's update_roles endpoint
        ...(selectedUser.roleIds && { 
          roles: selectedUser.roleIds 
        })
      };

      // Call API to update user
      const updatedUser = await updateUser(selectedUser.id, userUpdatePayload);

      // If roles need separate update (based on your backend's update_roles action)
      if (selectedUser.roleIds) {
        await updateUserRoles(selectedUser.id, { role_ids: selectedUser.roleIds });
      }

      // Update local state to reflect changes
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === selectedUser.id 
            ? { 
                ...user, 
                ...updatedUser,
                // Preserve or update critical fields
                roleIds: selectedUser.roleIds || user.roleIds 
              }
            : user
        )
      );

      // Success notification
      toast.success('User updated successfully', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true
      });

      // Close the modal
      handleCloseEditModal();

    } catch (error) {
      // Comprehensive error handling
      console.error('User update error:', error);

      // Different toast messages based on error type
      if (error.response) {
        // The request was made and the server responded with a status code
        const errorData = error.response.data;
      
        // Handle specific field validation errors
        if (errorData.username) {
          toast.error(Array.isArray(errorData.username) 
            ? errorData.username[0] 
            : errorData.username, 
            { type: "error" }
          );
        }
        if (errorData.email) {
          toast.error(Array.isArray(errorData.email) 
            ? errorData.email[0] 
            : errorData.email, 
            { type: "error" }
          );
        }

        // Generic error handling
        switch (error.response.status) {
          case 400:
            toast.error('Invalid user data. Please check your input.', {
              position: "top-right",
              type: "error"
            });
            break;
          case 403:
            toast.error('You do not have permission to update this user.', {
              position: "top-right",
              type: "error"
            });
            break;
          case 404:
            toast.error('User not found. They may have been deleted.', {
              position: "top-right",
              type: "error"
            });
            break;
          default:
            toast.error(`Update failed: ${errorData.detail || 'Server error'}`, {
              position: "top-right",
              type: "error"
            });
        }
      } else if (error.request) {
        // The request was made but no response was received
        toast.error('No response from server. Please check your network connection.', {
          position: "top-right",
          type: "error"
        });
      } else {
        // Something happened in setting up the request
        toast.error('An unexpected error occurred during update.', {
          position: "top-right",
          type: "error"
        });
      }
    } finally {
      // Always reset updating state
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <UserListWrapper>
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      </UserListWrapper>
    );
  }

  if (error) {
    return (
      <UserListWrapper>
        <Alert variant="danger">{error}</Alert>
      </UserListWrapper>
    );
  }

  return (
    <UserListWrapper>
      <TableHeader>
        <h1>User Management</h1>
        <div>Total Users: {users.length}</div>
      </TableHeader>

      {users.length === 0 ? (
        <Alert variant="info">No users found</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr key={`user-${user.id || user.tempId}`}>
                <td>
                  {console.log('Individual User in Render:', user)}
                  {user.username || user.displayName || `User-${index}`}
                </td>
                <td>{user.email || 'No Email'}</td>
                <td>
                  <div className="d-flex flex-wrap gap-2">
                    {roles.map(role => (
                      <Form.Check
                        key={`role-${user.id || user.tempId}-${role.id}`}
                        type="checkbox"
                        id={`role-${user.id || user.tempId}-${role.id}`}
                        label={role.name}
                        checked={
                          user.roleIds
                            ? user.roleIds.includes(role.id)
                            : false
                        }
                        onChange={(e) => handleRoleChange(user, role.id, e.target.checked)}
                        disabled={updating || !user.id}
                      />
                    ))}
                  </div>
                </td>
                <td>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={updating}
		    onClick={() => handleEditUser(user)}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Modal show={showEditModal} onHide={handleCloseEditModal}>
        <Modal.Header closeButton>
          <Modal.Title>Edit User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Username</Form.Label>
                <Form.Control
                  type="text"
                  value={selectedUser.username || ''}
                  onChange={(e) => setSelectedUser(prev => ({
                    ...prev, 
                    username: e.target.value
                  }))}
                  disabled={updating}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={selectedUser.email || ''}
                  onChange={(e) => setSelectedUser(prev => ({
                    ...prev, 
                    email: e.target.value
                  }))}
                  disabled={updating}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Roles</Form.Label>
                <div>
                  {roles.map(role => (
                    <Form.Check 
                      key={role.id}
                      type="checkbox"
                      label={role.name}
                      checked={selectedUser.roleIds?.includes(role.id) || false}
                      onChange={(e) => {
                        const roleId = role.id;
                        setSelectedUser(prev => ({
                          ...prev,
                          roleIds: e.target.checked
                            ? [...(prev.roleIds || []), roleId]
                            : (prev.roleIds || []).filter(id => id !== roleId)
                        }));
                      }}
                      disabled={updating}
                    />
                  ))}
                </div>
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={handleCloseEditModal}
            disabled={updating}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSaveUser}
            disabled={updating}
          >
            {updating ? 'Updating...' : 'Save Changes'}
          </Button>
        </Modal.Footer>
      </Modal>
    </UserListWrapper>
  );
};

export default UserListPage;

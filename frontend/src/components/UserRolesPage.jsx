import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import styled from 'styled-components';
import { fetchRoles, createRole, updateRole, deleteRole } from '../services/api';

const UserRolesContainer = styled.div`
  padding: 20px;
`;

const Heading = styled.h1`
  font-size: 2em;
  margin-bottom: 20px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
`;

const Th = styled.th`
  background-color: #f5f5f5;
  padding: 10px;
  border: 1px solid #ddd;
`;

const Td = styled.td`
  padding: 10px;
  border: 1px solid #ddd;
`;

const AddRoleForm = styled.form`
  margin-bottom: 20px;
  display: flex;
  align-items: center;
`;

const Input = styled.input`
  padding: 10px;
  margin-right: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const Button = styled.button`
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const UserRolesPage = () => {
  const { isAuthenticated } = useAuth();
  const [roles, setRoles] = useState([]);
  const [roleName, setRoleName] = useState('');
  const [editingRole, setEditingRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (isAuthenticated()) {
	try {
	  const data = await fetchRoles();
	  setRoles(data);
	} catch (error) {
	  console.error('Error fetching roles:', error);
	  setError('Failed to fetch roles');
	} finally {
          setLoading(false);
	}
      } else {
	setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated()) {
    return <div>Please log in to manage user roles.</div>;
  }

  const handleAddRole = async (event) => {
    event.preventDefault();
    try {
      const newRole = await createRole({ name: roleName });
      setRoles([...roles, newRole]);
      setRoleName('');
    } catch (error) {
      console.error('Error creating role:', error);
      setError('Failed to create role');
    }
  };

  const handleUpdateRole = async (role) => {
    try {
      const updatedRole = await updateRole(role.id, role);
      setRoles(roles.map(r => (r.id === updatedRole.id ? updatedRole : r)));
      setEditingRole(null);
    } catch (error) {
      console.error('Error updating role:', error);
      setError('Failed to update role');
    }
  };

  const handleDeleteRole = async (id) => {
    try {
      await deleteRole(id);
      setRoles(roles.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting role:', error);
      setError('Failed to delete role');
    }
  };

  const startEditing = (role) => {
    setEditingRole(role);
  };

  const handleInputChange = (event) => {
    setRoleName(event.target.value);
  };

  return (
    <UserRolesContainer>
      <Heading>User Roles</Heading>

      <AddRoleForm onSubmit={handleAddRole}>
	<Input
	  type="text"
	  value={roleName}
	  onChange={handleInputChange}
	  placeholder="Enter role name"
	  required
	/>
	<Button type="submit">Add Role</Button>
      </AddRoleForm>

      <Table>
	<thead>
	  <tr>
	    <Th>ID</Th>
	    <Th>Name</Th>
	    <Th>Actions</Th>
	  </tr>
	</thead>
	<tbody>
	  {roles.map((role) => (
	    <tr key={role.id}>
	      <Td>{role.id}</Td>
	      <Td>
		{editingRole && editingRole.id === role.id ? (
	          <Input
		    type="text"
		    value={editingRole.name}
		    onChange={(e) =>
		      setEditingRole({ ...editingRole, name: e.target.value })
		    }
		  />
		) : (
		  role.name
		)}
	      </Td>
	      <Td>
		{editingRole && editingRole.id === role.id ? (
	          <Button onClick={() => handleUpdateRole(editingRole)}>Save</Button>
		) : (
	          <Button onClick={() => startEditing(role)}>Edit</Button>
		)}
		<Button onClick={() => handleDeleteRole(role.id)}>Delete</Button>
	      </Td>
	    </tr>
	  ))}
	</tbody>
      </Table>
    </UserRolesContainer>
  );
};

export default UserRolesPage;

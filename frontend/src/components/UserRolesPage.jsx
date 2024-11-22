import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Card, Table, Alert, Badge } from 'react-bootstrap';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import styled from 'styled-components';
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  fetchPermissions
} from '../services/api';
import { useAuth } from '../context/AuthContext';

const StyledContainer = styled(Container)`
  padding: 2rem 1rem;
`;

const PageTitle = styled.h1`
  font-size: 2rem;
  font-weight: bold;
  color: #2d3748;
  margin-bottom: 2rem;
`;

const StyledCard = styled(Card)`
  margin-bottom: 2rem;
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const StyledFormLabel = styled(Form.Label)`
  font-weight: 500;
  color: #4a5568;
  margin-bottom: 0.5rem;
`;

const SearchWrapper = styled.div`
  position: relative;
  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #a0aec0;
  }
`;

const StyledSearchInput = styled(Form.Control)`
  padding-left: 2.5rem;
`;

const PermissionCategoryWrapper = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
`;

const CategoryHeader = styled.button`
  width: 100%;
  padding: 1rem;
  background: #87CEEB;
  border: none;
  border-radius: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
  color: #2d3748;
  transition: background-color 0.2s;

  &:hover {
    background: #edf2f7;
  }
`;

const PermissionGrid = styled.div`
  padding: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
`;

const PermissionItem = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: background-color 0.2s;

  &:hover {
    background: #87CEEB;
  }
`;

const StyledBadge = styled(Badge)`
  margin: 0.25rem;
  padding: 0.5rem;
  font-weight: normal;
`;

const ActionButton = styled(Button)`
  margin-left: 0.5rem;
`;

const PermissionCategory = ({ title, permissions, selectedPermissions, onToggle }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <PermissionCategoryWrapper>
      <CategoryHeader onClick={() => setIsExpanded(!isExpanded)} type="button">
        <span>{title}</span>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </CategoryHeader>
      
      {isExpanded && (
        <PermissionGrid>
          {permissions.map(permission => (
            <PermissionItem key={permission.id}>
              <Form.Check
                type="checkbox"
                id={`permission-${permission.id}`}
                checked={selectedPermissions.some(p => p.id === permission.id)}
                onChange={() => onToggle(permission)}
              />
              <div>
                <div className="font-weight-medium">{permission.name}</div>
                {permission.description && (
                  <small className="text-muted">{permission.description}</small>
                )}
              </div>
            </PermissionItem>
          ))}
        </PermissionGrid>
      )}
    </PermissionCategoryWrapper>
  );
};

const UserRolesPage = () => {
  const { isAuthenticated } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!isAuthenticated()) {
        setLoading(false);
        return;
      }

      try {
        const [rolesData, permissionsData] = await Promise.all([
          fetchRoles(),
          fetchPermissions()
        ]);
        setRoles(rolesData);
        setPermissions(permissionsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load roles and permissions');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [isAuthenticated]);

  const groupedPermissions = permissions.reduce((acc, permission) => {
    const category = permission.name.split('_')[0].toUpperCase();
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(permission);
    return acc;
  }, {});

  const handleAddRole = async (event) => {
    event.preventDefault();
    try {
      const newRole = await createRole({
        name: roleName,
        description: roleDescription,
        permission_ids: selectedPermissions
      });
      setRoles([...roles, newRole]);
      setRoleName('');
      setRoleDescription('');
      setSelectedPermissions([]);
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to create role');
    }
  };

  const handleUpdateRole = async (role) => {
    try {
      const updatedRole = await updateRole(role.id, {
        name: role.name,
        description: role.description,
        permissions: role.permissions.map(p => p.id)
      });
      setRoles(roles.map(r => r.id === updatedRole.id ? updatedRole : r));
      setEditingRole(null);
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleDeleteRole = async (id) => {
    try {
      await deleteRole(id);
      setRoles(roles.filter(r => r.id !== id));
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to delete role');
    }
  };

  const togglePermission = (permissionId) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
  );

  if (!isAuthenticated()) return (
    <div className="text-center p-8 text-gray-600">
      Please log in to manage user roles.
    </div>
  );

  return (
    <StyledContainer fluid>
      <PageTitle>User Roles Management</PageTitle>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <StyledCard>
        <Card.Body>
          <Card.Title className="mb-4">Create New Role</Card.Title>
          <Form onSubmit={handleAddRole}>
            <Row className="mb-4">
              <Col md={6}>
                <Form.Group>
                  <StyledFormLabel>Role Name</StyledFormLabel>
                  <Form.Control
                    type="text"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="Enter role name"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <StyledFormLabel>Description</StyledFormLabel>
                  <Form.Control
                    type="text"
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    placeholder="Enter role description"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <StyledFormLabel className="mb-0">Permissions</StyledFormLabel>
                <SearchWrapper>
                  <Search size={20} className="search-icon" />
                  <StyledSearchInput
                    type="text"
                    placeholder="Search permissions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </SearchWrapper>
              </div>

              {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => {
                const filteredPermissions = categoryPermissions.filter(
                  permission => permission.name.toLowerCase().includes(searchTerm.toLowerCase())
                );

                if (filteredPermissions.length === 0) return null;

                return (
                  <PermissionCategory
                    key={category}
                    title={category}
                    permissions={filteredPermissions}
                    selectedPermissions={selectedPermissions}
                    onToggle={togglePermission}
                  />
                );
              })}
            </Form.Group>

            <div className="text-end">
              <Button type="submit" variant="primary">
                Create Role
              </Button>
            </div>
          </Form>
        </Card.Body>
      </StyledCard>

      <StyledCard>
        <Card.Body className="p-0">
          <Table responsive hover>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Permissions</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td>
                    {editingRole?.id === role.id ? (
                      <Form.Control
                        type="text"
                        value={editingRole.name}
                        onChange={(e) => setEditingRole(prev => ({
                          ...prev,
                          name: e.target.value
                        }))}
                      />
                    ) : (
                      <span>{role.name}</span>
                    )}
                  </td>
                  <td>
                    {editingRole?.id === role.id ? (
                      <Form.Control
                        type="text"
                        value={editingRole.description}
                        onChange={(e) => setEditingRole(prev => ({
                          ...prev,
                          description: e.target.value
                        }))}
                      />
                    ) : (
                      <span className="text-muted">{role.description || 'No description'}</span>
                    )}
                  </td>
                  <td>
                    {editingRole?.id === role.id ? (
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
                          <div key={category} className="mb-3">
                            <h6>{category}</h6>
                            {categoryPermissions.map(permission => (
                              <Form.Check
                                key={permission.id}
                                type="checkbox"
                                label={permission.name}
                                checked={editingRole.permissions.some(p => p.id === permission.id)}
                                onChange={() => {
                                  const isSelected = editingRole.permissions.some(p => p.id === permission.id);
                                  setEditingRole(prev => ({
                                    ...prev,
                                    permissions: isSelected
                                      ? prev.permissions.filter(p => p.id !== permission.id)
                                      : [...prev.permissions, permission]
                                  }));
                                }}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div>
                        {role.permissions?.length ? (
                          role.permissions.map(p => (
                            <StyledBadge key={p.id} bg="info">
                              {p.name}
                            </StyledBadge>
                          ))
                        ) : (
                          <span className="text-muted">No permissions</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="text-end">
                    {editingRole?.id === role.id ? (
                      <>
                        <ActionButton
                          variant="primary"
                          size="sm"
                          onClick={() => handleUpdateRole(editingRole)}
                        >
                          Save
                        </ActionButton>
                        <ActionButton
                          variant="light"
                          size="sm"
                          onClick={() => setEditingRole(null)}
                        >
                          Cancel
                        </ActionButton>
                      </>
                    ) : (
                      <>
                        <ActionButton
                          variant="light"
                          size="sm"
                          onClick={() => setEditingRole(role)}
                        >
                          Edit
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteRole(role.id)}
                        >
                          Delete
                        </ActionButton>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </StyledCard>
    </StyledContainer>
  );
};

export default UserRolesPage;

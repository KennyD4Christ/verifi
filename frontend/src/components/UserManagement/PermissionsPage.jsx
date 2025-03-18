import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Container, Table, Card, Alert, Spinner } from 'react-bootstrap';
import { fetchPermissions } from '../../services/api';

// Category Color Scheme
const CATEGORY_COLORS = {
  'Invoice': {
    primary: '#2980b9',   // Blue
    background: '#ebf5fb',
    badge: '#3498db'
  },
  'Product': {
    primary: '#27ae60',   // Green
    background: '#eafaf1',
    badge: '#2ecc71'
  },
  'Adjustment': {
    primary: '#e67e22',   // Orange
    background: '#fef5e7',
    badge: '#f39c12'
  },
  'User': {
    primary: '#8e44ad',   // Purple
    background: '#f4ecf7',
    badge: '#9b59b6'
  },
  'Uncategorized': {
    primary: '#34495e',   // Dark Gray
    background: '#f2f4f6',
    badge: '#2c3e50'
  }
};

// Dynamic Styled Components
const CategoryCard = styled(Card)`
  margin-bottom: 1.5rem;
  border-top: 4px solid ${props => props.color || '#34495e'};
  box-shadow: 0 4px 6px rgba(0,0,0,0.08);
`;

const CategoryHeader = styled(Card.Header)`
  background-color: ${props => props.background || '#f2f4f6'};
  color: ${props => props.color || '#2c3e50'};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CategoryTitle = styled.h2`
  color: ${props => props.color || '#2c3e50'};
  font-weight: 600;
  margin: 0;
  font-size: 1.2rem;
`;

const CategoryBadge = styled.span`
  background-color: ${props => props.color || '#34495e'};
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
`;

const StatusBadge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.8rem;
  background-color: ${props => props.active ? '#2ecc71' : '#e74c3c'};
  color: white;
`;

const PageTitle = styled.h1`
  color: #2c3e50;
  margin-bottom: 1.5rem;
  font-weight: 700;
  border-bottom: 2px solid #3498db;
  padding-bottom: 0.5rem;
`;

const PermissionsPage = () => {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getPermissions = async () => {
      try {
        const permissionsData = await fetchPermissions();
        setPermissions(permissionsData);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch permissions');
        setLoading(false);
      }
    };
    getPermissions();
  }, []);

  // Group permissions by category with fallback
  const groupedPermissions = permissions.reduce((acc, permission) => {
    const category = permission.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(permission);
    return acc;
  }, {});

  if (loading) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status" variant="primary">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container fluid="md" className="py-4">
      <PageTitle>System Permissions Management</PageTitle>
      
      {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => {
        const categoryColors = CATEGORY_COLORS[category] || CATEGORY_COLORS['Uncategorized'];
        return (
          <CategoryCard 
            key={category} 
            color={categoryColors.primary}
          >
            <CategoryHeader 
              background={categoryColors.background} 
              color={categoryColors.primary}
            >
              <CategoryTitle color={categoryColors.primary}>
                {category}
              </CategoryTitle>
              <CategoryBadge color={categoryColors.badge}>
                {categoryPermissions.length} Permissions
              </CategoryBadge>
            </CategoryHeader>
            <Card.Body>
              <Table striped hover responsive>
                <thead>
                  <tr style={{ backgroundColor: categoryColors.background }}>
                    <th>Permission Name</th>
                    <th>Description</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryPermissions.map(permission => (
                    <tr key={permission.id}>
                      <td>{permission.name}</td>
                      <td>{permission.description}</td>
                      <td>
                        <StatusBadge active={permission.is_active}>
                          {permission.is_active ? 'Active' : 'Inactive'}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </CategoryCard>
        );
      })}
    </Container>
  );
};

export default PermissionsPage;

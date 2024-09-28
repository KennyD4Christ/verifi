import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import styled from 'styled-components';
import { fetchCategories } from '../services/api';

const CategoryContainer = styled.div`
  padding: 20px;
`;

const CategoryItem = styled.div`
  padding: 10px;
  border: 1px solid #ddd;
  margin-bottom: 10px;
  border-radius: 4px;
`;

const CategoryList = () => {
  const { isAuthenticated } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (isAuthenticated()) {
        try {
	  const data = await fetchCategories();
	  setCategories(data);
	} catch (error) {
	  console.error('Error fetching categories:', error);
	}
      }
    };

    fetchData();
  }, [isAuthenticated]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated()) {
    return <div>Please log in to view list of categories.</div>;
  }

  return (
    <CategoryContainer>
      <h2>Categories</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {categories.map(category => (
	<CategoryItem key={category.id}>{category.name}</CategoryItem>
      ))}
    </CategoryContainer>
  );
};

export default CategoryList;

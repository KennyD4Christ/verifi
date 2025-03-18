import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import styled from 'styled-components';
import { fetchReviews } from '../services/api';

const ReviewContainer = styled.div`
  padding: 20px;
`;

const ReviewItem = styled.div`
  padding: 10px;
  border: 1px solid #ddd;
  margin-bottom: 10px;
  border-radius: 4px;
`;

const ReviewList = () => {
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (isAuthenticated()) {
        try {
	  const data = await fetchReviews();
	  setReviews(data);
	} catch (error) {
	  console.error('Error fetching reviews:', error);
        }
      }
    };

    fetchData();
  }, [isAuthenticated]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated()) {
    return <div>Please log in to review items.</div>;
  }

  return (
    <ReviewContainer>
      <h2>Reviews</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {reviews.map(review => (
	<ReviewItem key={review.id}>
	  <p>{review.comment}</p>
	  <p><strong>Rating:</strong> {review.rating}</p>
	</ReviewItem>
      ))}
    </ReviewContainer>
  );
};

export default ReviewList;

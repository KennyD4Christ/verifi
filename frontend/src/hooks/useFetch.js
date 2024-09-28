import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const useFetch = (apiCall, initialParams = {}) => {
  const { isAuthenticated, token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [params, setParams] = useState(initialParams);

  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated()) {
	setLoading(false);
	return;
      }

      setLoading(true);
      try {
        const result = await apiCall({ ...params, headers: { 'Authorization': `Bearer ${token}` } });
	setData(result);
      } catch (err) {
	setError(err);
      } finally {
	setLoading(false);
      }
    };

    fetchData();
  }, [apiCall, params, isAuthenticated, token]);


  const refetch = (newParams = {}) => {
    setParams((prevParams) => ({ ...prevParams, ...newParams }));
  };

  return { data, loading, error, refetch };
};

export default useFetch;

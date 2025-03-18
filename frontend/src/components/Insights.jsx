import React, { useState, useEffect } from 'react';
import { fetchInsights } from '../services/api';

const Insights = () => {
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const data = await fetchInsights();
      setInsights(data);
    };
    fetchData();
  }, []);

  return (
    <div>
      <h2>Business Insights</h2>
      {insights.map((insight, index) => (
        <div key={index}>
          <h3>{insight.title}</h3>
          <p>{insight.description}</p>
        </div>
      ))}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { fetchDetailData } from '../services/api';
import { formatCurrency } from '../utils/dataTransformations';
import { Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend
);

const DetailContainer = styled.div`
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const DetailHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const DetailTitle = styled.h2`
  margin: 0;
`;

const BackButton = styled.button`
  padding: 10px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background-color: #0056b3;
  }
`;

const DetailContent = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
`;

const DetailItem = styled.div`
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
`;

const DetailLabel = styled.h4`
  margin: 0 0 10px 0;
  color: #6c757d;
`;

const DetailValue = styled.p`
  margin: 0;
  font-size: 18px;
  font-weight: bold;
`;

const ChartContainer = styled.div`
  margin-top: 30px;
  height: 300px;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 24px;
`;

const ErrorMessage = styled.div`
  color: #dc3545;
  text-align: center;
  font-size: 18px;
  margin-top: 20px;
`;

const DetailView = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [detailData, setDetailData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDetailData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDetailData(type, id);
        setDetailData(data);
      } catch (err) {
        setError('Failed to load detail data. Please try again later.');
        console.error('Error fetching detail data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDetailData();
  }, [type, id]);

  const renderDetailContent = () => {
    switch (type) {
      case 'product':
        return (
          <>
            <DetailItem>
              <DetailLabel>Name</DetailLabel>
              <DetailValue>{detailData.name}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Price</DetailLabel>
              <DetailValue>{formatCurrency(detailData.price)}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Stock</DetailLabel>
              <DetailValue>{detailData.stock}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Category</DetailLabel>
              <DetailValue>{detailData.category}</DetailValue>
            </DetailItem>
          </>
        );
      case 'order':
        return (
          <>
            <DetailItem>
              <DetailLabel>Order Number</DetailLabel>
              <DetailValue>{detailData.orderNumber}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Customer</DetailLabel>
              <DetailValue>{detailData.customerName}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Total Amount</DetailLabel>
              <DetailValue>{formatCurrency(detailData.totalAmount)}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Status</DetailLabel>
              <DetailValue>{detailData.status}</DetailValue>
            </DetailItem>
          </>
        );
      case 'customer':
        return (
          <>
            <DetailItem>
              <DetailLabel>Name</DetailLabel>
              <DetailValue>{detailData.name}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Email</DetailLabel>
              <DetailValue>{detailData.email}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Total Orders</DetailLabel>
              <DetailValue>{detailData.totalOrders}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Total Spent</DetailLabel>
              <DetailValue>{formatCurrency(detailData.totalSpent)}</DetailValue>
            </DetailItem>
          </>
        );
      default:
        return <p>No details available for this type.</p>;
    }
  };

  const renderChart = () => {
    if (!detailData || !detailData.chartData) return null;

    const chartOptions = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: `${type.charAt(0).toUpperCase() + type.slice(1)} Performance`,
        },
      },
    };

    return (
      <ChartContainer>
        <Line options={chartOptions} data={detailData.chartData} />
      </ChartContainer>
    );
  };

  if (loading) return <LoadingSpinner>Loading...</LoadingSpinner>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!detailData) return <ErrorMessage>No data available.</ErrorMessage>;

  return (
    <DetailContainer>
      <DetailHeader>
        <DetailTitle>{type.charAt(0).toUpperCase() + type.slice(1)} Details</DetailTitle>
        <BackButton onClick={() => navigate(-1)}>Back</BackButton>
      </DetailHeader>
      <DetailContent>
        {renderDetailContent()}
      </DetailContent>
      {renderChart()}
    </DetailContainer>
  );
};

export default DetailView;

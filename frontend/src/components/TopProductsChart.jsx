// First, create a new file: src/components/TopProductsChart.jsx
import React, { useState } from 'react';
import { Form } from 'react-bootstrap';
import styled from 'styled-components';
import { Bar, Line, Pie } from 'react-chartjs-2';

const ChartContainer = styled.div`
  position: relative;
`;

const ControlsContainer = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  gap: 10px;
`;

const StyledSelect = styled(Form.Select)`
  max-width: 200px;
  flex-shrink: 0;
`;

const TopProductsChart = ({ chartType, productsData, getRandomColor }) => {
  const [selectedMetric, setSelectedMetric] = useState('sales');

  const getChartData = () => {
    if (!Array.isArray(productsData) || productsData.length === 0) {
      return null;
    }

    if (chartType === 'pie') {
      return {
        labels: productsData.map(item => item.name),
        datasets: [{
          label: selectedMetric === 'sales' ? 'Total Sales' : 'Revenue',
          data: productsData.map(item => selectedMetric === 'sales' ? item.sales : item.revenue),
          backgroundColor: productsData.map(() => getRandomColor()),
          borderColor: productsData.map(() => getRandomColor()),
          borderWidth: 1
        }]
      };
    }

    return {
      labels: productsData.map(item => item.name),
      datasets: [{
        label: 'Total Sales',
        data: productsData.map(item => item.sales),
        backgroundColor: getRandomColor(),
        borderColor: getRandomColor(),
        borderWidth: 1
      }, {
        label: 'Revenue',
        data: productsData.map(item => item.revenue),
        backgroundColor: getRandomColor(),
        borderColor: getRandomColor(),
        borderWidth: 1,
        yAxisID: 'revenue'
      }]
    };
  };

  const getChartConfig = () => ({
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Top Products'
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const metric = context.dataset.label;
            const value = context.raw;
            if (metric === 'Revenue') {
              return `${metric}: ₦${value.toLocaleString()}`;
            }
            return `${metric}: ${value.toLocaleString()} units`;
          }
        }
      }
    },
    scales: chartType !== 'pie' ? {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Units Sold'
        }
      },
      revenue: {
        beginAtZero: true,
        position: 'right',
        title: {
          display: true,
          text: 'Revenue (₦)'
        },
        grid: {
          drawOnChartArea: false
        }
      },
      x: {
        title: {
          display: true,
          text: 'Products'
        }
      }
    } : undefined
  });

  const ChartComponent = {
    line: Line,
    bar: Bar,
    pie: Pie
  }[chartType];

  return (
    <ChartContainer>
      {chartType === 'pie' && (
        <ControlsContainer>
          <Form.Label>Show:</Form.Label>
          <StyledSelect
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
          >
            <option value="sales">Total Sales</option>
            <option value="revenue">Revenue</option>
          </StyledSelect>
        </ControlsContainer>
      )}
      
      <ChartComponent 
        data={getChartData()}
        options={getChartConfig()}
      />
    </ChartContainer>
  );
};

export default TopProductsChart;

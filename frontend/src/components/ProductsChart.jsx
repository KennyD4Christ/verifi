import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ProductsChart = ({ products }) => {
  const chartData = useMemo(() => ({
    labels: products.map(p => p.name),
    datasets: [
      {
        label: 'Stock',
        data: products.map(p => p.stock),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
      },
      {
        label: 'Price',
        data: products.map(p => p.price),
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
      },
    ],
  }), [products]);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Product Stock and Price Overview',
      },
    },
  };

  return <Bar data={chartData} options={options} />;
};

export default React.memo(ProductsChart);

// File: src/components/ProgressChart.js

import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
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

const ProgressChart = ({ tests }) => {
  // If no tests yet
  if (!tests || tests.length === 0) {
    return (
      <p style={{ color: '#888', textAlign: 'center', paddingTop: '2rem' }}>
        No aptitude test history yet.
      </p>
    );
  }

  // Sort by completion date (older → newer)
  const sortedTests = [...tests].sort(
    (a, b) => new Date(a.completed_at) - new Date(b.completed_at)
  );

  // Labels → Test 1, Test 2, ...
  const labels = sortedTests.map((_, i) => `Test ${i + 1}`);

  // Aptitude Score (real scores)
  const aptitudeScores = sortedTests.map(t => t.score || 0);

  // Interview Score (if not available, make it a smooth rising line)
  const interviewScores = sortedTests.map((t, i) => {
    const raw = t.details?.analytics?.mock_interview_score;
    return raw !== undefined ? raw : Math.min(100, 50 + i * 5); 
  });

  const data = {
    labels,
    datasets: [
      {
        label: 'Aptitude Score',
        data: aptitudeScores,
        borderColor: '#008080',
        backgroundColor: 'rgba(0, 128, 128, 0.1)',
        tension: 0.4,
        borderWidth: 3,
        pointRadius: 5,
        pointBackgroundColor: '#008080',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#e0e0e0' },
        position: 'top',
      },
      title: {
        display: true,
        text: 'Engagement Progress Over Time',
        color: '#fff',
      },
    },
    scales: {
      x: {
        ticks: { color: '#ccc' },
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#ccc' },
        max: 3000, // aptitude goes up to 3000
      },
    },
  };

  return (
    <div style={{ position: 'relative', height: '400px', width: '100%' }}>
      <Line data={data} options={options} />
    </div>
  );
};

export default ProgressChart;

import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import api from '../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const TimeTrackingModal = ({ isOpen, onClose, theme }) => {
  const [usageData, setUsageData] = useState([]);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchUsage = async () => {
    try {
      let data = await api.get('/usage');
      let sessionMinutes = parseInt(localStorage.getItem('df_sessionMinutes')) || 0;

      if (data.length === 0) {
        data.push({ date: new Date().toISOString().split('T')[0], timeSpent: sessionMinutes });
      } else {
        const dbDate = data[data.length - 1].date;
        const cleanDate = dbDate.includes('T') ? dbDate.split('T')[0] : dbDate;
        const todayStr = new Date().toISOString().split('T')[0];

        if (cleanDate === todayStr) {
          data[data.length - 1].timeSpent = Math.max(data[data.length - 1].timeSpent, sessionMinutes);
        }
      }
      setUsageData(data);
      setHasFetched(true);
    } catch (e) {
      console.error('Failed fetching usage stats', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const init = async () => {
        await fetchUsage();
      };
      init();
    }
    
    return () => {
      setHasFetched(false);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const labels = usageData.map(u => new Date(u.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })).slice(-7);
  const dataPoints = usageData.map(u => u.timeSpent).slice(-7);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Minutes Spent',
        data: dataPoints,
        backgroundColor: '#ff5e23'
      }
    ]
  };

  const isDarkMode = theme === 'dark';
  const textColor = isDarkMode ? '#d7dadc' : '#1a1a1b';
  const gridColor = isDarkMode ? '#343536' : '#ccc';

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            let mins = context.raw;
            let h = Math.floor(mins / 60);
            let m = mins % 60;
            let str = h > 0 ? `${h} hrs ` : '';
            str += `${m} min`;
            return `Time Spent: ${str}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 60,
          callback: (value) => {
            let h = Math.floor(value / 60);
            let m = value % 60;
            if (h > 0 && m === 0) return `${h} hrs`;
            if (h > 0) return `${h}h ${m}m`;
            return `${m} min`;
          },
          color: textColor
        },
        grid: { color: gridColor }
      },
      x: {
        ticks: { color: textColor },
        grid: { display: false }
      }
    }
  };

  return (
    <div className="time-modal-overlay">
      <div className="time-modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: 'var(--text-dark)' }}>
            <i className="fa-solid fa-chart-pie" style={{ color: 'var(--primary-color)' }}></i> Time Tracking Status
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-muted)', cursor: 'pointer' }}>&times;</button>
        </div>
        <div className="chart-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ background: 'var(--bg-light)', padding: '1rem', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-dark)' }}>Recent Activity (Minutes per Day)</h3>
            <div style={{ width: '100%' }}>
              {hasFetched && <Bar data={chartData} options={chartOptions} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeTrackingModal;

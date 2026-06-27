// src/pages/Profile.js
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaChartLine, FaEdit, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import api from '../utils/axios';
import ProgressChart from '../components/ProgressChart';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const Profile = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const userId = sessionStorage.getItem('user');
  const username = sessionStorage.getItem('username') || (userId ? userId.split('@')[0] : 'User');

  const [userData, setUserData] = useState({
    name: username,
    email: userId || '',
    phone: '+91-9876543210',
    location: 'Mumbai, India',
    education: 'B.Tech CSAI, VIT Pune (2023-2027)',
    experience: 'Intern at TechCorp (Summer 2024)',
    editing: false,
    editedData: {},
    progress: [],
    gamify: { total_completed: 0, streak_days: 0, coins: 0, badges: [] },
    aptitudeStats: { testsCompleted: 0, avgScore: 0, bestScore: 0 },
  });

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const [activityCalendar, setActivityCalendar] = useState([]);

  useEffect(() => {
    if (!userId) navigate('/login');
  }, [userId, navigate]);

  const fetchData = async () => {
    if (!userId) return;
    try {
      const res = await api.get('/api/progress/profile/me');
      const { progress = [], gamify = {} } = res.data;

      const aptitudeTests = progress.filter(p => p.activity_type === 'aptitude-test');
      const avgScore = aptitudeTests.length > 0
        ? Math.round(aptitudeTests.reduce((a, b) => a + (b.score || 0), 0) / aptitudeTests.length)
        : 0;
      const bestScore = aptitudeTests.length > 0
        ? Math.max(...aptitudeTests.map(p => p.score || 0))
        : 0;

      setUserData(prev => ({
        ...prev,
        progress,
        gamify: gamify || {},
        aptitudeStats: {
          testsCompleted: aptitudeTests.length,
          avgScore,
          bestScore,
        },
      }));
    } catch (err) {
      console.error('Profile fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  // FIXED: Use local date (not UTC) for calendar
  const getLocalDateString = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const generateCalendar = useCallback((year, month) => {
    const lastDay = new Date(year, month + 1, 0).getDate();

    // Extract local date strings from progress
    const completedDates = userData.progress
      .map(p => getLocalDateString(p.completed_at))
      .filter(Boolean);

    const uniqueDates = [...new Set(completedDates)]; // Remove duplicates

    const days = [];
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const active = uniqueDates.includes(dateStr);
      days.push({
        date: dateStr,
        active,
        dayNum: d,
        dayOfWeek: new Date(year, month, d).getDay(),
      });
    }
    setActivityCalendar(days);
  }, [userData.progress]);

  useEffect(() => {
    generateCalendar(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth, generateCalendar]);

  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const aptitudeCount = userData.progress.filter(p =>
    ['aptitude', 'aptitude-test'].includes(p.activity_type)
  ).length;

  const doughnutData = {
    labels: ['Full Tests', 'Practice Questions'],
    datasets: [{
      data: [
        userData.aptitudeStats.testsCompleted || 1,
        Math.max(aptitudeCount - userData.aptitudeStats.testsCompleted, 0) || 1,
      ],
      backgroundColor: ['#10b981', '#6b7280'],
      borderColor: ['#059669', '#4b5563'],
      borderWidth: 2,
    }],
  };

  const tabs = [
    { id: 'overview', icon: <FaUser />, label: 'Overview' },
    { id: 'aptitude', icon: <FaChartLine />, label: 'Aptitude' },
  ];

  const cardStyle = {
    backgroundColor: '#0f0f0f',
    borderRadius: '20px',
    padding: '2rem',
    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
    border: '1px solid #222',
    color: '#e0e0e0',
    marginBottom: '2rem',
  };

  const handleEditToggle = () => {
    setUserData(prev => ({
      ...prev,
      editing: !prev.editing,
      editedData: prev.editing ? {} : { ...prev },
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      editedData: { ...prev.editedData, [name]: value },
    }));
  };

  const handleSave = () => {
    setUserData(prev => ({
      ...prev,
      ...prev.editedData,
      editing: false,
      editedData: {},
    }));
    alert('Profile updated successfully!');
  };

  const renderCalendar = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeks = [];
    let currentWeek = [];

    // Add empty cells for days before month starts
    const firstDayOfWeek = new Date(selectedYear, selectedMonth, 1).getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({ empty: true });
    }

    activityCalendar.forEach(day => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    // Fill remaining days
    while (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push({ empty: true });
    }
    if (currentWeek.length === 7) weeks.push(currentWeek);

    const activeCount = activityCalendar.filter(d => d.active).length;

    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button onClick={goToPrevMonth} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '1.5rem', cursor: 'pointer' }}>
            <FaChevronLeft />
          </button>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.4rem', fontWeight: '600' }}>
            {monthNames[selectedMonth]} {selectedYear}
          </h3>
          <button onClick={goToNextMonth} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '1.5rem', cursor: 'pointer' }}>
            <FaChevronRight />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', marginBottom: '1rem' }}>
          {days.map(d => (
            <div key={d} style={{ color: '#888', fontWeight: 'bold', textAlign: 'center', fontSize: '0.9rem' }}>
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
          {weeks.flat().map((day, i) => (
            <div
              key={i}
              style={{
                aspectRatio: '1',
                borderRadius: '12px',
                backgroundColor: day.empty ? 'transparent' : (day.active ? '#10b981' : '#1a1a1a'),
                border: day.empty ? 'none' : `1px solid ${day.active ? '#059669' : '#333'}`,
                color: day.empty ? 'transparent' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: day.active ? 'bold' : '500',
                fontSize: '0.95rem',
                transition: 'all 0.2s',
              }}
            >
              {day.dayNum || ''}
            </div>
          ))}
        </div>

        <p style={{ color: '#888', fontSize: '0.9rem', textAlign: 'center', marginTop: '1rem' }}>
          Green = Practice Day • <strong>{activeCount}</strong> days active this month
        </p>
      </div>
    );
  };

  const renderTabContent = () => {
    if (activeTab === 'overview') {
      return (
        <div style={{ display: 'grid', gap: '2rem' }}>
          <motion.div style={cardStyle} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Personal Information</h3>
              <button onClick={handleEditToggle} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }}>
                <FaEdit size={22} />
              </button>
            </div>

            {userData.editing ? (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {['name', 'email', 'phone', 'location', 'education', 'experience'].map(field => (
                  <input
                    key={field}
                    name={field}
                    value={userData.editedData[field] ?? userData[field]}
                    onChange={handleInputChange}
                    style={{
                      padding: '1rem',
                      borderRadius: '12px',
                      border: '1px solid #444',
                      background: '#111',
                      color: '#fff',
                      fontSize: '1rem',
                    }}
                    placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                  />
                ))}
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={handleSave}
                    style={{ flex: 1, padding: '1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setUserData(prev => ({ ...prev, editing: false, editedData: {} }))}
                    style={{ flex: 1, padding: '1rem', background: '#444', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ lineHeight: '2.2', fontSize: '1.1rem' }}>
                <p><strong style={{ color: '#aaa' }}>Name:</strong> {userData.name}</p>
                <p><strong style={{ color: '#aaa' }}>Email:</strong> {userData.email}</p>
                <p><strong style={{ color: '#aaa' }}>Phone:</strong> {userData.phone}</p>
                <p><strong style={{ color: '#aaa' }}>Location:</strong> {userData.location}</p>
                <p><strong style={{ color: '#aaa' }}>Education:</strong> {userData.education}</p>
                <p><strong style={{ color: '#aaa' }}>Experience:</strong> {userData.experience}</p>
              </div>
            )}
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {renderCalendar()}
            <motion.div style={cardStyle}>
              <h3 style={{ marginBottom: '1rem', color: '#fff' }}>Practice Distribution</h3>
              <div style={{ height: '320px' }}>
                <Doughnut
                  data={doughnutData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: { color: '#e0e0e0', font: { size: 14 } },
                      },
                    },
                  }}
                />
              </div>
            </motion.div>
          </div>

          <motion.div style={cardStyle}>
            <h3 style={{ marginBottom: '1rem', color: '#fff' }}>Your Progress Over Time</h3>
            <div style={{ height: '340px', background: '#111', borderRadius: '16px', padding: '1rem' }}>
              <ProgressChart tests={userData.progress.filter(p => p.activity_type === 'aptitude-test')} />

            </div>
          </motion.div>
        </div>
      );
    }

    if (activeTab === 'aptitude') {
      const tests = userData.progress
        .filter(p => p.activity_type === 'aptitude-test')
        .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
        .slice(0, 10);

      const chartData = {
        labels: tests.length ? tests.map((_, i) => `Test ${tests.length - i}`) : ['No Tests Yet'],
        datasets: [
          { label: 'Correct', data: tests.map(t => t.details?.analytics?.correct || 0), backgroundColor: '#10b981' },
          { label: 'Wrong', data: tests.map(t => t.details?.analytics?.wrong || 0), backgroundColor: '#ef4444' },
          {
            label: 'Unattempted',
            data: tests.map(t => 30 - (t.details?.analytics?.correct || 0) - (t.details?.analytics?.wrong || 0)),
            backgroundColor: '#6b7280',
          },
        ],
      };

      return (
        <motion.div style={cardStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2 style={{ color: '#10b981', marginBottom: '1.5rem', fontSize: '1.8rem' }}>Aptitude Performance</h2>

          <div style={{ height: '420px', marginBottom: '2rem' }}>
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#e0e0e0' } } },
                scales: {
                  x: { stacked: true, ticks: { color: '#ccc' } },
                  y: { stacked: true, max: 30, ticks: { color: '#ccc' } },
                },
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', textAlign: 'center' }}>
            <div style={{ background: '#111', padding: '1.8rem', borderRadius: '16px' }}>
              <p style={{ color: '#888', fontSize: '0.9rem' }}>Tests Completed</p>
              <h3 style={{ color: '#10b981', margin: '0.5rem 0 0', fontSize: '2rem' }}>
                {userData.aptitudeStats.testsCompleted}
              </h3>
            </div>
            <div style={{ background: '#111', padding: '1.8rem', borderRadius: '16px' }}>
              <p style={{ color: '#888', fontSize: '0.9rem' }}>Average Score</p>
              <h3 style={{ color: '#60a5fa', margin: '0.5rem 0 0', fontSize: '2rem' }}>
                {userData.aptitudeStats.avgScore}
              </h3>
            </div>
            <div style={{ background: '#111', padding: '1.8rem', borderRadius: '16px' }}>
              <p style={{ color: '#888', fontSize: '0.9rem' }}>Best Score</p>
              <h3 style={{ color: '#a78bfa', margin: '0.5rem 0 0', fontSize: '2rem' }}>
                {userData.aptitudeStats.bestScore}
              </h3>
            </div>
            <div style={{ background: '#111', padding: '1.8rem', borderRadius: '16px' }}>
              <p style={{ color: '#888', fontSize: '0.9rem' }}>Total Questions</p>
              <h3 style={{ color: '#f59e0b', margin: '0.5rem 0 0', fontSize: '2rem' }}>
                {aptitudeCount}
              </h3>
            </div>
          </div>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <motion.section
      style={{
        padding: '3rem 1rem',
        minHeight: '100vh',
        backgroundColor: '#050505',
        color: '#e0e0e0',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem', color: '#fff', fontWeight: '700' }}>
            Welcome back, {userData.name}!
          </h1>
          <p style={{ color: '#888', fontSize: '1.3rem' }}>Your aptitude mastery dashboard</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '1rem 2.5rem',
                borderRadius: '16px',
                background: activeTab === tab.id ? '#10b981' : '#1f1f1f',
                color: activeTab === tab.id ? 'white' : '#ccc',
                border: activeTab === tab.id ? '2px solid #34d399' : '1px solid #333',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontWeight: '600',
                fontSize: '1.1rem',
                transition: 'all 0.3s',
                boxShadow: activeTab === tab.id ? '0 8px 25px rgba(16, 185, 129, 0.4)' : 'none',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.4 }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.section>
  );
};

export default Profile;
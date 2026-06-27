// src/utils/axios.js
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:5000'; // Your backend URL

// Create Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor: Auto-attach token if available
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401s (clear session & redirect)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear session and redirect to login
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('justLoggedIn');
      window.location.href = '/login';
    }
    // For other errors, just reject
    return Promise.reject(error);
  }
);

export default api;
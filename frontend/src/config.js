// API Base URL configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.MODE === 'production' 
    ? '/api' 
    : 'http://localhost:4000/api');

export default API_BASE_URL;

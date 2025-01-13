import axios from 'axios';

const instance = axios.create({
  baseURL: 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add a request interceptor
instance.interceptors.request.use(
  (config) => {
    // Get the token from localStorage
    const token = localStorage.getItem('token');
    
    // If token exists, add it to the headers
    if (token) {
      // Make sure to trim any whitespace and verify it's a non-empty string
      const cleanToken = token.trim();
      if (cleanToken) {
        config.headers.Authorization = `Bearer ${cleanToken}`;
      }
    }
    
    return config;
  },
  (error) => {
    console.error('Błąd interceptora żądania:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor
instance.interceptors.response.use(
  (response) => {
    // Log book-related responses
    if (response.config.url.includes('/books')) {
      console.log('Odpowiedź książki:', {
        url: response.config.url,
        status: response.status,
        data: response.data
      });
    }
    return response;
  },
  (error) => {
    console.error('Błąd odpowiedzi:', {
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    });
    return Promise.reject(error);
  }
);

export default instance;

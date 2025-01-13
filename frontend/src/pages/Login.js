import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/axios';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/api/auth/login', formData);
      if (response.data.token) {
        const cleanToken = response.data.token.trim();
        localStorage.setItem('token', cleanToken);
        login(cleanToken, response.data.role);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się zalogować');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded shadow">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Zaloguj się do swojego konta
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="text-red-500 text-center">{error}</div>
          )}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Nazwa użytkownika
            </label>
            <input
              type="text"
              name="username"
              id="username"
              required
              value={formData.username}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Hasło
            </label>
            <input
              type="password"
              name="password"
              id="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Zaloguj się
            </button>
          </div>
        </form>
        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">
            Nie masz konta?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-500">
              Zarejestruj się tutaj
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

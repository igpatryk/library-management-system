import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/axios';

const RegisterReader = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    address: '',
    phone_number: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPendingRequest = async () => {
      try {
        const response = await api.get('/api/reader-requests/check');
        setHasPendingRequest(response.data.has_pending_request);
      } catch (err) {
        setError('Nie udało się sprawdzić statusu rejestracji');
      } finally {
        setIsLoading(false);
      }
    };

    if (user.role === 'user') {
      checkPendingRequest();
    } else {
      setIsLoading(false);
    }
  }, [user.role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/reader-requests', formData);
      setSuccess('Wniosek o rejestrację został złożony pomyślnie. Proszę czekać na zatwierdzenie.');
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się złożyć wniosku o rejestrację');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (user.role !== 'user') {
    return <div className="text-red-600 p-4">Tylko zwykli użytkownicy mogą zarejestrować się jako czytelnicy</div>;
  }

  if (isLoading) {
    return <div className="text-center p-4">Ładowanie...</div>;
  }

  if (hasPendingRequest) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded">
          <p className="font-bold">Wniosek w trakcie rozpatrywania</p>
          <p>Twój wniosek o rejestrację jako czytelnik został już złożony i czeka na rozpatrzenie. 
             Proszę poczekać na jego rozpatrzenie przez administratora lub pracownika biblioteki.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Zarejestruj się jako Czytelnik</h2>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      {success && <div className="text-green-600 mb-4">{success}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Imię *</label>
          <input
            type="text"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-1">Nazwisko *</label>
          <input
            type="text"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-1">Adres *</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-1">Numer Telefonu *</label>
          <input
            type="tel"
            name="phone_number"
            value={formData.phone_number}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          Złóż Wniosek o Rejestrację
        </button>
      </form>
    </div>
  );
};

export default RegisterReader;

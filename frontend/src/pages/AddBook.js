import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { useAuth } from '../context/AuthContext';

const AddBook = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    author_first_name: '',
    author_last_name: '',
    isbn: '',
    publisher: '',
    publication_year: '',
    genre: ''
  });
  const [error, setError] = useState(null);

  if (user.role !== 'admin') {
    return <div className="text-red-600 p-4">Brak uprawnień: Tylko administratorzy mogą dodawać książki</div>;
  }
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/books', formData);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się dodać książki');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Dodaj Nową Książkę</h2>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Tytuł</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">Imię Autora</label>
            <input
              type="text"
              name="author_first_name"
              value={formData.author_first_name}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block mb-1">Nazwisko Autora</label>
            <input
              type="text"
              name="author_last_name"
              value={formData.author_last_name}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
          </div>
        </div>

        <div>
          <label className="block mb-1">ISBN</label>
          <input
            type="text"
            name="isbn"
            value={formData.isbn}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-1">Wydawnictwo</label>
          <input
            type="text"
            name="publisher"
            value={formData.publisher}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-1">Rok wydania</label>
          <input
            type="number"
            name="publication_year"
            value={formData.publication_year}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-1">Gatunek</label>
          <input
            type="text"
            name="genre"
            value={formData.genre}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          Dodaj książkę
        </button>
      </form>
    </div>
  );
};

export default AddBook;

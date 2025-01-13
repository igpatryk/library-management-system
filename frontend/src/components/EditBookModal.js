import React, { useState } from 'react';
import api from '../utils/axios';

const EditBookModal = ({ book, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    title: book.title,
    author_first_name: book.author.split(' ')[0],
    author_last_name: book.author.split(' ').slice(1).join(' '),
    isbn: book.isbn,
    publication_year: book.year,
    genre: book.genre
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/books/${book.id}`, formData);
      onUpdate();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Błąd podczas edycji książki');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Edytuj książkę</h2>
        
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

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            >
              Aktualizuj
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
            >
              Anuluj
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditBookModal; 
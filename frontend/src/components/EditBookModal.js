import React, { useState, useEffect } from 'react';
import api from '../utils/axios';

const EditBookModal = ({ book, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    title: '',
    author_first_name: '',
    author_last_name: '',
    isbn: '',
    publication_year: '',
    genre: '',
    description: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (book) {
      const [firstName = '', lastName = ''] = (book.author || '').split(' ');
      
      setFormData({
        title: book.title || '',
        author_first_name: firstName,
        author_last_name: lastName,
        isbn: book.isbn || '',
        publication_year: book.publication_year?.toString() || '',
        genre: book.genre || '',
        description: book.description || ''
      });
    }
  }, [book]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.put(`/api/books/${book.id}`, {
        title: formData.title,
        author_first_name: formData.author_first_name,
        author_last_name: formData.author_last_name,
        isbn: formData.isbn,
        publication_year: parseInt(formData.publication_year),
        genre: formData.genre,
        description: formData.description
      });
      onUpdate();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się zaktualizować książki');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Edytuj Książkę</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1">Tytuł *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block mb-1">Imię Autora *</label>
            <input
              type="text"
              name="author_first_name"
              value={formData.author_first_name}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block mb-1">Nazwisko Autora *</label>
            <input
              type="text"
              name="author_last_name"
              value={formData.author_last_name}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block mb-1">ISBN *</label>
            <input
              type="text"
              name="isbn"
              value={formData.isbn}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block mb-1">Rok wydania *</label>
            <input
              type="number"
              name="publication_year"
              value={formData.publication_year}
              onChange={handleChange}
              required
              min="1000"
              max={new Date().getFullYear()}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block mb-1">Gatunek *</label>
            <input
              type="text"
              name="genre"
              value={formData.genre}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block mb-1">Opis *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
          </div>

          {error && <p className="text-red-500">{error}</p>}

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditBookModal; 
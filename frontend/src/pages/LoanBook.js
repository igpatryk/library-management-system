import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/axios';

const LoanBook = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [selectedReader, setSelectedReader] = useState(null);
  const [formData, setFormData] = useState({
    book_id: '',
    reader_id: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);
        const response = await api.get('/api/loans/books');
        console.log('Pobrane książki:', response.data);
        setBooks(response.data);
        setLoading(false);
      } catch (err) {
        setError('Nie udało się pobrać danych');
        setLoading(false);
      }
    };

    if (user?.role !== 'admin' && user?.role !== 'worker') {
      navigate('/');
      return;
    }
    fetchBooks();
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/loans', formData);
      setSuccess('Książka została wypożyczona pomyślnie');
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się wypożyczyć książki');
    }
  };

  const handleReaderSelect = (readerId) => {
    setSelectedReader(readerId);
    setFormData({
      ...formData,
      reader_id: readerId,
      book_id: ''  // Reset book selection when reader changes
    });
  };

  // Group books by reader
  const booksByReader = books.reduce((acc, book) => {
    if (!acc[book.reader_id]) {
      acc[book.reader_id] = {
        reader_name: book.reader_name,
        books: []
      };
    }
    acc[book.reader_id].books.push(book);
    return acc;
  }, {});

  if (loading) {
    return <div>Ładowanie...</div>;
  }

  if (Object.keys(booksByReader).length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <h2 className="text-2xl font-bold mb-4">Wypożycz Książkę</h2>
        <div className="text-gray-600">
          Brak książek dostępnych do wypożyczenia. Książki muszą być najpierw zarezerwowane.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Wypożycz Książkę</h2>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      {success && <div className="text-green-600 mb-4">{success}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Wybierz Czytelnika *</label>
          <select
            value={selectedReader || ''}
            onChange={(e) => handleReaderSelect(e.target.value)}
            className="w-full p-2 border rounded"
            required
          >
            <option value="">Wybierz czytelnika</option>
            {Object.entries(booksByReader).map(([readerId, { reader_name }]) => (
              <option key={readerId} value={readerId}>
                {reader_name}
              </option>
            ))}
          </select>
        </div>

        {selectedReader && (
          <div>
            <label className="block mb-1">Wybierz Zarezerwowaną Książkę *</label>
            <select
              name="book_id"
              value={formData.book_id}
              onChange={(e) => setFormData({ ...formData, book_id: e.target.value })}
              className="w-full p-2 border rounded"
              required
            >
              <option value="">Wybierz książkę</option>
              {booksByReader[selectedReader]?.books.map(book => (
                <option key={book.id} value={book.id}>
                  {book.title} - {book.author}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          disabled={!selectedReader || !formData.book_id}
        >
          Utwórz Wypożyczenie
        </button>
      </form>
    </div>
  );
};

export default LoanBook;

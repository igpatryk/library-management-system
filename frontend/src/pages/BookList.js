import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/axios';
import { useAuth } from '../context/AuthContext';
import EditBookModal from '../components/EditBookModal';

const BookList = () => {
  const [bookData, setBookData] = useState({ books: [], total: 0, pages: 1, genres: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    title: '',
    author: '',
    isbn: '',
    genre: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const { user } = useAuth();
  const [selectedBook, setSelectedBook] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');

  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/books', {
        params: {
          title: filters.title,
          author: filters.author,
          isbn: filters.isbn,
          status: selectedStatus,
          genre: filters.genre,
          page: currentPage
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      setBookData(response.data);
      setError('');
    } catch (err) {
      setError('Nie udało się pobrać książek');
      setBookData({ books: [], total: 0, pages: 1, genres: [] });
    } finally {
      setLoading(false);
    }
  }, [filters.title, filters.author, filters.isbn, selectedStatus, filters.genre, currentPage]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchBooks();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [fetchBooks]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      title: '',
      author: '',
      isbn: '',
      genre: ''
    });
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo(0, 0);
  };

  const handleEditClick = (book) => {
    setSelectedBook(book);
  };

  const handleCloseModal = () => {
    setSelectedBook(null);
  };

  const handleUpdateBook = () => {
    fetchBooks();
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Katalog Książek</h1>

      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Szukaj po tytule..."
            value={filters.title}
            onChange={(e) => setFilters(prev => ({ ...prev, title: e.target.value }))}
            className="p-2 border rounded flex-1"
          />
          <input
            type="text"
            placeholder="Szukaj po autorze..."
            value={filters.author}
            onChange={(e) => setFilters(prev => ({ ...prev, author: e.target.value }))}
            className="p-2 border rounded flex-1"
          />
          <input
            type="text"
            placeholder="Szukaj po ISBN..."
            value={filters.isbn}
            onChange={(e) => setFilters(prev => ({ ...prev, isbn: e.target.value }))}
            className="p-2 border rounded flex-1"
          />
        </div>

        <div className="flex gap-4">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="">Wszystkie statusy</option>
            <option value="available">Dostępne</option>
            <option value="borrowed">Wypożyczone</option>
          </select>

          <select
            value={filters.genre}
            onChange={(e) => setFilters(prev => ({ ...prev, genre: e.target.value }))}
            className="p-2 border rounded"
          >
            <option value="">Wszystkie gatunki</option>
            {bookData.genres.map(genre => (
              <option key={genre} value={genre}>{genre}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      {loading ? (
        <div>Ładowanie...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bookData.books.map(book => (
            <div key={book.id} className="border rounded-lg p-4 shadow-sm">
              <h3 className="text-lg font-semibold">{book.title}</h3>
              <p className="text-gray-600">Autor: {book.author}</p>
              <p className="text-sm text-gray-500">ISBN: {book.isbn}</p>
              <p className="text-sm text-gray-500">Wydawnictwo: {book.publisher}</p>
              <p className="text-sm text-gray-500">Rok wydania: {book.year}</p>
              <p className="text-sm text-gray-500">Gatunek: {book.genre}</p>
              <div className="mt-4 flex justify-between items-center">
                <span className={`px-2 py-1 rounded text-sm ${
                  book.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {book.status === 'available' ? 'Dostępna' : 'Wypożyczona'}
                </span>
                {(user?.role === 'admin' || user?.role === 'worker') && (
                  <button
                    onClick={() => handleEditClick(book)}
                    className="bg-gray-500 text-white px-4 py-1 rounded hover:bg-gray-600"
                  >
                    Edytuj
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-center gap-4">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Poprzednia
        </button>
        <span className="px-4 py-2">
          Strona {currentPage} z {bookData.pages}
        </span>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === bookData.pages}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Następna
        </button>
      </div>

      {selectedBook && (
        <EditBookModal
          book={selectedBook}
          onClose={handleCloseModal}
          onUpdate={handleUpdateBook}
        />
      )}
    </div>
  );
};

export default BookList;

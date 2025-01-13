import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

const ReserveBook = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTitle, setSearchTitle] = useState('');
  const [searchAuthor, setSearchAuthor] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedBook, setSelectedBook] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [existingReservations, setExistingReservations] = useState([]);
  const [userReservations, setUserReservations] = useState([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/books/available', {
        params: {
          title: searchTitle,
          author: searchAuthor,
          page: currentPage
        }
      });
      setBooks(response.data.books);
      setTotalPages(response.data.pages);
      setError('');
    } catch (err) {
      setError('Nie udało się pobrać książek');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [searchTitle, searchAuthor, currentPage]);

  const fetchUserReservations = async () => {
    try {
      const response = await api.get('/api/reservations/user');
      setUserReservations(response.data);
    } catch (err) {
      console.error('Nie udało się pobrać rezerwacji użytkownika:', err);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchBooks();
    fetchUserReservations();
  }, [user, navigate, fetchBooks]);

  const fetchExistingReservations = async (bookId) => {
    try {
      const response = await api.get(`/api/reservations/book/${bookId}`);
      setExistingReservations(response.data);
    } catch (err) {
      console.error('Nie udało się pobrać istniejących rezerwacji:', err);
    }
  };

  const handleBookSelect = async (book) => {
    setSelectedBook(book);
    await fetchExistingReservations(book.id);
  };

  const handleReserve = async () => {
    if (!selectedBook || !startDate || !endDate) {
      setError('Proszę wybrać książkę i daty rezerwacji');
      return;
    }

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      start.setHours(12, 0, 0, 0);
      end.setHours(12, 0, 0, 0);

      await api.post('/api/reservations', {
        book_id: selectedBook.id,
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0]
      });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się utworzyć rezerwacji');
    }
  };

  const isDateConflicting = (date) => {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    const hasBookConflict = existingReservations.some(reservation => {
        const reservationStart = new Date(reservation.start_date);
        const reservationEnd = new Date(reservation.end_date);
        reservationStart.setHours(0, 0, 0, 0);
        reservationEnd.setHours(0, 0, 0, 0);
        return checkDate >= reservationStart && checkDate <= reservationEnd;
    });

    const hasUserConflict = userReservations.some(reservation => {
        const reservationStart = new Date(reservation.start_date);
        const reservationEnd = new Date(reservation.end_date);
        reservationStart.setHours(0, 0, 0, 0);
        reservationEnd.setHours(0, 0, 0, 0);
        return checkDate >= reservationStart && checkDate <= reservationEnd;
    });

    return hasBookConflict || hasUserConflict;
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Zarezerwuj Książkę</h1>
      
      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Szukaj po tytule..."
          value={searchTitle}
          onChange={(e) => setSearchTitle(e.target.value)}
          className="p-2 border rounded"
        />
        <input
          type="text"
          placeholder="Szukaj po autorze..."
          value={searchAuthor}
          onChange={(e) => setSearchAuthor(e.target.value)}
          className="p-2 border rounded"
        />
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}
      {success && <div className="text-green-600 mb-4">{success}</div>}

      {loading ? (
        <div>Ładowanie...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map(book => (
            <div key={book.id} className="border rounded-lg p-4 shadow-sm">
              <h3 className="text-lg font-semibold">{book.title}</h3>
              <p className="text-gray-600">Autor: {book.author_first_name} {book.author_last_name}</p>
              <p className="text-sm text-gray-500">ISBN: {book.isbn}</p>
              <p className="text-sm text-gray-500">Wydawnictwo: {book.publisher}</p>
              <p className="text-sm text-gray-500">Rok wydania: {book.publication_year}</p>
              <p className="text-sm text-gray-500">Gatunek: {book.genre}</p>
              
              <div className="mt-4">
                <h4 className="font-medium mb-2">Wybierz datę rezerwacji:</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600">Data rozpoczęcia</label>
                    <input
                      type="date"
                      value={reservationDates[book.id]?.start_date || ''}
                      onChange={(e) => handleDateChange(book.id, 'start_date', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full p-2 border rounded mt-1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Data zakończenia</label>
                    <input
                      type="date"
                      value={reservationDates[book.id]?.end_date || ''}
                      onChange={(e) => handleDateChange(book.id, 'end_date', e.target.value)}
                      min={reservationDates[book.id]?.start_date || new Date().toISOString().split('T')[0]}
                      className="w-full p-2 border rounded mt-1"
                    />
                  </div>
                </div>
                
                {dateErrors[book.id] && (
                  <p className="text-red-500 text-sm mt-2">{dateErrors[book.id]}</p>
                )}

                <button
                  onClick={() => handleReserve(book.id)}
                  disabled={!isValidReservation(book.id)}
                  className={`w-full mt-4 py-2 px-4 rounded ${
                    isValidReservation(book.id)
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Zarezerwuj
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-center gap-4">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Poprzednia
        </button>
        <span className="px-4 py-2">
          Strona {currentPage} z {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Następna
        </button>
      </div>
    </div>
  );
};

export default ReserveBook;

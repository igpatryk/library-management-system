import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/axios';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

const ManageReservations = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    reader_name: '',
    book_title: ''
  });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  // New reservation form state
  const [showNewReservationForm, setShowNewReservationForm] = useState(false);
  const [availableBooks, setAvailableBooks] = useState([]);
  const [readers, setReaders] = useState([]);
  const [newReservation, setNewReservation] = useState({
    book_id: '',
    reader_id: '',
    start_date: null,
    end_date: null
  });

  // Debounce filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters]);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/reservations/all', {
        params: {
          ...debouncedFilters,
          page: currentPage
        }
      });
      setReservations(response.data.reservations);
      setTotalPages(response.data.pages);
    } catch (err) {
      setError('Nie udało się pobrać rezerwacji');
    } finally {
      setLoading(false);
    }
  };

  const fetchFormData = async () => {
    try {
      const [booksRes, readersRes] = await Promise.all([
        api.get('/api/books/available'),
        api.get('/api/loans/readers')
      ]);
      setAvailableBooks(booksRes.data.books);
      setReaders(readersRes.data);
    } catch (err) {
      setError('Nie udało się pobrać danych formularza');
    }
  };

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'worker') {
      navigate('/');
      return;
    }
    fetchReservations();
  }, [user, navigate, currentPage, debouncedFilters]);

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/reservations/admin/create', {
        ...newReservation,
        start_date: newReservation.start_date.toISOString().split('T')[0],
        end_date: newReservation.end_date.toISOString().split('T')[0]
      });
      setSuccess('Rezerwacja została utworzona pomyślnie');
      setShowNewReservationForm(false);
      fetchReservations();
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się utworzyć rezerwacji');
    }
  };

  const handleDeleteReservation = async (id) => {
    if (!window.confirm('Czy na pewno chcesz anulować tę rezerwację?')) {
      return;
    }
    try {
      await api.delete(`/api/reservations/${id}`);
      setSuccess('Rezerwacja została anulowana');
      fetchReservations();
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się anulować rezerwacji');
    }
  };

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedReservationId, setSelectedReservationId] = useState(null);

  const handleApprove = async (reservationId) => {
    try {
      await api.post(`/api/reservations/${reservationId}/approve`);
      fetchReservations();
      setSuccess('Rezerwacja została zatwierdzona');
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się zatwierdzić rezerwacji');
    }
  };

  const handleReject = async (reservationId) => {
    setShowRejectModal(true);
    setSelectedReservationId(reservationId);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Zarządzanie Rezerwacjami</h1>

      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Szukaj po nazwie czytelnika..."
            value={filters.reader_name}
            onChange={(e) => setFilters(prev => ({ ...prev, reader_name: e.target.value }))}
            className="p-2 border rounded flex-1"
          />
          <input
            type="text"
            placeholder="Szukaj po tytule książki..."
            value={filters.book_title}
            onChange={(e) => setFilters(prev => ({ ...prev, book_title: e.target.value }))}
            className="p-2 border rounded flex-1"
          />
        </div>

        <div className="flex gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="p-2 border rounded"
          >
            <option value="">Wszystkie statusy</option>
            <option value="pending">Oczekujące</option>
            <option value="approved">Zatwierdzone</option>
            <option value="rejected">Odrzucone</option>
            <option value="cancelled">Anulowane</option>
          </select>

          <select
            value={filters.date_filter}
            onChange={(e) => setFilters(prev => ({ ...prev, date_filter: e.target.value }))}
            className="p-2 border rounded"
          >
            <option value="">Wszystkie daty</option>
            <option value="today">Dzisiaj</option>
            <option value="tomorrow">Jutro</option>
            <option value="this_week">Ten tydzień</option>
            <option value="next_week">Następny tydzień</option>
          </select>
        </div>
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      {loading ? (
        <div>Ładowanie...</div>
      ) : (
        <div className="space-y-4">
          {reservations.map(reservation => (
            <div key={reservation.id} className="border rounded-lg p-4 shadow-sm">
              <h3 className="text-lg font-semibold">{reservation.book_title}</h3>
              <p className="text-gray-600">Czytelnik: {reservation.reader}</p>
              <p className="text-sm text-gray-500">Data rozpoczęcia: {new Date(reservation.start_date).toLocaleDateString()}</p>
              <p className="text-sm text-gray-500">Data zakończenia: {new Date(reservation.end_date).toLocaleDateString()}</p>
              <p className="text-sm text-gray-500">Status: {
                reservation.status === 'pending' ? 'Oczekująca' :
                reservation.status === 'approved' ? 'Zatwierdzona' :
                reservation.status === 'rejected' ? 'Odrzucona' : 'Anulowana'
              }</p>
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

export default ManageReservations; 
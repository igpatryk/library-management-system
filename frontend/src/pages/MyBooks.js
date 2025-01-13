import React, { useState, useEffect } from 'react';
import api from '../utils/axios';

const MyBooks = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  const [reservationError, setReservationError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [loanHistory, setLoanHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('loans');
  const [success, setSuccess] = useState('');
  const [reservations, setReservations] = useState([]);

  const fetchLoans = async () => {
    try {
      const response = await api.get('/api/loans/active');
      setLoans(response.data);
      setError('');
    } catch (err) {
      setError('Nie udało się pobrać wypożyczeń');
    }
  };

  const fetchReservations = async () => {
    setLoadingReservations(true);
    try {
      const response = await api.get('/api/reservations/user');
      setReservations(response.data);
      setReservationError('');
    } catch (err) {
      setReservationError('Nie udało się pobrać rezerwacji');
      console.error('Error fetching reservations:', err);
    } finally {
      setLoadingReservations(false);
    }
  };

  const fetchLoanHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await api.get('/api/loans/history');
      setLoanHistory(response.data);
      setHistoryError('');
    } catch (err) {
      setHistoryError('Nie udało się pobrać historii wypożyczeń');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCancelReservation = async (reservationId) => {
    try {
      await api.delete(`/api/reservations/${reservationId}`);
      setSuccess('Rezerwacja została anulowana');
      await fetchReservations();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setReservationError('Nie udało się anulować rezerwacji');
      console.error('Error canceling reservation:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([
        fetchLoans(),
        fetchReservations(),
        fetchLoanHistory()
      ]);
      setLoading(false);
    };
    
    fetchData();
  }, []);

  if (loading) return <div className="text-center p-4">Ładowanie...</div>;
  if (error) return <div className="text-red-600 p-4">{error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Moje Książki</h1>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Aktywne Wypożyczenia</h2>
        {loading ? (
          <div>Ładowanie...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : loans.length === 0 ? (
          <div className="text-gray-500">Nie masz aktualnie wypożyczonych książek</div>
        ) : (
          <div className="space-y-4">
            {loans.map(loan => (
              <div key={loan.id} className="border rounded-lg p-4 shadow-sm">
                <h3 className="font-semibold">{loan.title}</h3>
                <p className="text-gray-600">Autor: {loan.author}</p>
                <p className="text-sm text-gray-500">Data wypożyczenia: {new Date(loan.loan_date).toLocaleDateString()}</p>
                <p className="text-sm text-gray-500">Termin zwrotu: {new Date(loan.due_date).toLocaleDateString()}</p>
                {loan.is_overdue && (
                  <p className="text-red-600 mt-2">Książka przetrzymana!</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Aktywne Rezerwacje</h2>
        {loadingReservations ? (
          <div>Ładowanie...</div>
        ) : reservationError ? (
          <div className="text-red-600">{reservationError}</div>
        ) : reservations.length === 0 ? (
          <div className="text-gray-500">Nie masz aktualnie zarezerwowanych książek</div>
        ) : (
          <div className="space-y-4">
            {reservations.map(reservation => (
              <div key={reservation.id} className="border rounded-lg p-4 shadow-sm">
                <h3 className="text-lg font-semibold">{reservation.book_title}</h3>
                <p className="text-gray-600">Autor: {reservation.author}</p>
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
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Historia Wypożyczeń</h2>
        {loadingHistory ? (
          <div>Ładowanie...</div>
        ) : historyError ? (
          <div className="text-red-600">{historyError}</div>
        ) : loanHistory.length === 0 ? (
          <div className="text-gray-500">Brak historii wypożyczeń</div>
        ) : (
          <div className="space-y-4">
            {loanHistory.map(item => (
              <div key={item.id} className="border rounded-lg p-4 shadow-sm">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-gray-600">Autor: {item.author}</p>
                <p className="text-sm text-gray-500">Wypożyczono: {new Date(item.loan_date).toLocaleDateString()}</p>
                <p className="text-sm text-gray-500">Zwrócono: {new Date(item.return_date).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBooks; 
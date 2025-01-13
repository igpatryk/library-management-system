import React, { useState, useEffect } from 'react';
import api from '../utils/axios';

const MyBooks = () => {
  const [loans, setLoans] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('loans');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [loansRes, reservationsRes] = await Promise.all([
          api.get('/api/users/my-loans'),
          api.get('/api/users/my-reservations')
        ]);
        setLoans(loansRes.data);
        setReservations(reservationsRes.data);
      } catch (err) {
        setError('Nie udało się pobrać danych');
      } finally {
        setLoading(false);
      }
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
                <h3 className="font-semibold">{reservation.title}</h3>
                <p className="text-gray-600">Autor: {reservation.author}</p>
                <p className="text-sm text-gray-500">Od: {new Date(reservation.start_date).toLocaleDateString()}</p>
                <p className="text-sm text-gray-500">Do: {new Date(reservation.end_date).toLocaleDateString()}</p>
                <button
                  onClick={() => handleCancelReservation(reservation.id)}
                  className="mt-2 px-4 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Anuluj rezerwację
                </button>
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
        ) : history.length === 0 ? (
          <div className="text-gray-500">Brak historii wypożyczeń</div>
        ) : (
          <div className="space-y-4">
            {history.map(item => (
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
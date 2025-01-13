import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';

const Reports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reports = [
    {
      id: 'active-loans',
      name: 'Aktywne Wypożyczenia',
      description: 'Lista wszystkich aktualnie wypożyczonych książek i ich czytelników',
      endpoint: '/api/reports/active-loans'
    },
    {
      id: 'overdue-loans',
      name: 'Przetrzymane Książki',
      description: 'Lista wszystkich przetrzymanych książek',
      endpoint: '/api/reports/overdue-loans'
    },
    {
      id: 'reader-activity',
      name: 'Aktywność Czytelników',
      description: 'Podsumowanie aktywności czytelników, w tym wypożyczenia i rezerwacje',
      endpoint: '/api/reports/reader-activity'
    },
    {
      id: 'popular-books',
      name: 'Popularne Książki',
      description: 'Najczęściej wypożyczane i rezerwowane książki',
      endpoint: '/api/reports/popular-books'
    },
    {
      id: 'user-statistics',
      name: 'Statystyki Użytkowników',
      description: 'Statystyki dotyczące użytkowników, czytelników i ich ról',
      endpoint: '/api/reports/user-statistics'
    }
  ];

  const handleGenerateReport = async (endpoint) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.get(endpoint, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename and type from response headers
      const contentDisposition = response.headers['content-disposition'];
      const contentType = response.headers['content-type'];
      
      // Default to CSV if no content type is specified
      let extension = contentType?.includes('json') ? 'json' : 'csv';
      let filename = `raport.${extension}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Nie udało się wygenerować raportu');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'admin' && user?.role !== 'worker') {
    navigate('/');
    return null;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Raporty</h1>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Loan Statistics */}
        <div className="border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Statystyki Wypożyczeń</h2>
          {loading ? (
            <div>Ładowanie...</div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-gray-600">Aktywne wypożyczenia:</p>
                <p className="text-2xl font-bold">{stats.active_loans}</p>
              </div>
              <div>
                <p className="text-gray-600">Przetrzymane książki:</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdue_loans}</p>
              </div>
              <div>
                <p className="text-gray-600">Wypożyczenia w tym miesiącu:</p>
                <p className="text-2xl font-bold">{stats.loans_this_month}</p>
              </div>
            </div>
          )}
        </div>

        {/* Reservation Statistics */}
        <div className="border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Statystyki Rezerwacji</h2>
          {loading ? (
            <div>Ładowanie...</div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-gray-600">Oczekujące rezerwacje:</p>
                <p className="text-2xl font-bold">{stats.pending_reservations}</p>
              </div>
              <div>
                <p className="text-gray-600">Zatwierdzone rezerwacje:</p>
                <p className="text-2xl font-bold">{stats.approved_reservations}</p>
              </div>
              <div>
                <p className="text-gray-600">Rezerwacje w tym miesiącu:</p>
                <p className="text-2xl font-bold">{stats.reservations_this_month}</p>
              </div>
            </div>
          )}
        </div>

        {/* Reader Statistics */}
        <div className="border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Statystyki Czytelników</h2>
          {loading ? (
            <div>Ładowanie...</div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-gray-600">Aktywni czytelnicy:</p>
                <p className="text-2xl font-bold">{stats.active_readers}</p>
              </div>
              <div>
                <p className="text-gray-600">Nowi czytelnicy w tym miesiącu:</p>
                <p className="text-2xl font-bold">{stats.new_readers_this_month}</p>
              </div>
              <div>
                <p className="text-gray-600">Oczekujące wnioski:</p>
                <p className="text-2xl font-bold">{stats.pending_reader_requests}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Generuj Raport</h2>
        <div className="flex gap-4">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="">Wybierz typ raportu</option>
            <option value="loans">Raport wypożyczeń</option>
            <option value="reservations">Raport rezerwacji</option>
            <option value="readers">Raport czytelników</option>
            <option value="overdue">Raport przetrzymanych książek</option>
          </select>

          <select
            value={reportPeriod}
            onChange={(e) => setReportPeriod(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="">Wybierz okres</option>
            <option value="today">Dzisiaj</option>
            <option value="week">Ten tydzień</option>
            <option value="month">Ten miesiąc</option>
            <option value="year">Ten rok</option>
          </select>

          <button
            onClick={handleGenerateReport}
            disabled={!reportType || !reportPeriod}
            className={`px-4 py-2 rounded ${
              !reportType || !reportPeriod
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            Generuj Raport
          </button>
        </div>
      </div>

      {generatingReport && (
        <div className="mt-4 text-blue-600">
          Generowanie raportu...
        </div>
      )}
    </div>
  );
};

export default Reports; 
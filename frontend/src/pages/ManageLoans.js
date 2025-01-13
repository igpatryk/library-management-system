import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/axios';

const ManageLoans = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    overdue: false,
    reader_name: '',
    book_title: ''
  });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 500);

    return () => clearTimeout(timer);
  }, [filters]);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/loans', {
        params: {
          ...debouncedFilters,
          page: currentPage
        }
      });
      setLoans(response.data.loans);
      setTotalPages(response.data.pages);
    } catch (err) {
      setError('Nie udało się pobrać wypożyczeń');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'worker') {
      navigate('/');
      return;
    }
    fetchLoans();
  }, [user, navigate, currentPage, debouncedFilters]);

  const handleReturn = async (loanId) => {
    try {
      await api.post(`/api/loans/${loanId}/return`);
      fetchLoans();  // Refresh the list
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się zwrócić książki');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Zarządzanie Wypożyczeniami</h1>
      
      <div className="mb-4 space-y-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Szukaj po nazwie czytelnika..."
            value={filters.reader_name}
            onChange={(e) => setFilters(f => ({ ...f, reader_name: e.target.value }))}
            className="p-2 border rounded flex-1"
          />
          <input
            type="text"
            placeholder="Szukaj po tytule książki..."
            value={filters.book_title}
            onChange={(e) => setFilters(f => ({ ...f, book_title: e.target.value }))}
            className="p-2 border rounded flex-1"
          />
        </div>
        
        <div className="flex gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
            className="p-2 border rounded"
          >
            <option value="">Wszystkie statusy</option>
            <option value="borrowed">Wypożyczone</option>
            <option value="returned">Zwrócone</option>
          </select>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.overdue}
              onChange={(e) => setFilters(f => ({ ...f, overdue: e.target.checked }))}
              className="mr-2"
            />
            Pokaż tylko przetrzymane
          </label>
        </div>
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      {loading ? (
        <div>Ładowanie...</div>
      ) : (
        <div className="space-y-4">
          {loans.map(loan => (
            <div
              key={loan.id}
              className={`border p-4 rounded ${loan.is_overdue ? 'border-red-500' : ''}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold">{loan.title}</h3>
                  <p>Czytelnik: {loan.reader}</p>
                  <p>Data wypożyczenia: {new Date(loan.loan_date).toLocaleDateString()}</p>
                  {loan.return_date && (
                    <p>Data zwrotu: {new Date(loan.return_date).toLocaleDateString()}</p>
                  )}
                  <p>Status: {loan.status === 'borrowed' ? 'Wypożyczona' : 'Zwrócona'}</p>
                  {loan.is_overdue && (
                    <p className="text-red-600">PRZETRZYMANA</p>
                  )}
                </div>
                {loan.status === 'borrowed' && (
                  <button
                    onClick={() => handleReturn(loan.id)}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                  >
                    Zwróć Książkę
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="flex justify-center gap-4 mt-4">
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
      )}
    </div>
  );
};

export default ManageLoans; 
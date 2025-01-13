import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';

const Reports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportType, setReportType] = useState('');
  const [reportPeriod, setReportPeriod] = useState('');

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      setError('');
      
      const response = await api.get('/api/reports/generate', {
        params: {
          type: reportType,
          period: reportPeriod
        },
        responseType: 'blob'
      });
      
      // Create a blob from the response data
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Create a link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${reportType}-${reportPeriod}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      // Clean up the URL
      window.URL.revokeObjectURL(url);
      
      setSuccess('Raport został wygenerowany pomyślnie');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Nie udało się wygenerować raportu');
      console.error('Error generating report:', err);
    } finally {
      setGeneratingReport(false);
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
      
      {success && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4">
          {success}
        </div>
      )}

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
            disabled={!reportType || !reportPeriod || generatingReport}
            className={`px-4 py-2 rounded ${
              !reportType || !reportPeriod || generatingReport
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {generatingReport ? 'Generowanie...' : 'Generuj Raport'}
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
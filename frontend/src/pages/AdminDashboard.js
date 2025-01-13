import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/axios';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [backupStatus, setBackupStatus] = useState('');
  const [error, setError] = useState('');

  // Check if user is admin
  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const handleBackupDatabase = async () => {
    try {
      setBackupStatus('Tworzenie kopii zapasowej...');
      setError('');

      const response = await api.get('/api/admin/database/backup', {
        responseType: 'blob'
      });

      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from response headers or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'library_backup.sql';
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
      
      setBackupStatus('Kopia zapasowa została pobrana pomyślnie!');
    } catch (err) {
      setError('Nie udało się utworzyć kopii zapasowej bazy danych');
      setBackupStatus('');
      console.error('Błąd tworzenia kopii zapasowej:', err);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Panel Administratora</h1>
      
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Zarządzanie Bazą Danych</h2>
        
        <div className="space-y-4">
          <div>
            <button
              onClick={handleBackupDatabase}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              Pobierz Kopię Zapasową Bazy Danych
            </button>
            
            {backupStatus && (
              <p className="mt-2 text-sm text-green-600">
                {backupStatus}
              </p>
            )}
            
            {error && (
              <p className="mt-2 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
          
          <div className="text-sm text-gray-600">
            <p>Ta operacja utworzy pełną kopię zapasową bazy danych w formacie SQL.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard; 
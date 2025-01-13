import React, { useState, useEffect } from 'react';
import api from '../utils/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }

    const fetchUsers = async () => {
      try {
        const response = await api.get('/api/users');
        setUsers(response.data);
      } catch (err) {
        setError('Nie udało się pobrać użytkowników');
      }
    };

    fetchUsers();
  }, [user, navigate]);

  const handlePromote = async (userId, newRole) => {
    try {
      await api.post(`/api/users/${userId}/promote`, { role: newRole });
      // Refresh user list
      const response = await api.get('/api/users');
      setUsers(response.data);
    } catch (err) {
      setError('Nie udało się awansować użytkownika');
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Czy na pewno chcesz usunąć tego użytkownika? Tej operacji nie można cofnąć.')) {
      try {
        await api.delete(`/api/users/${userId}`);
        setUsers(users.filter(u => u.id !== userId));
      } catch (err) {
        setError('Nie udało się usunąć użytkownika');
      }
    }
  };

  const handleInspect = async (userId) => {
    try {
      const response = await api.get(`/api/users/${userId}/details`);
      setUserDetails(response.data);
      setShowModal(true);
    } catch (err) {
      setError('Nie udało się pobrać szczegółów użytkownika');
    }
  };

  const UserDetailsModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h3 className="text-xl font-bold mb-4">Szczegóły Użytkownika</h3>
        {userDetails && (
          <div className="space-y-4">
            <div>
              <p><span className="font-bold">Nazwa użytkownika:</span> {userDetails.username}</p>
              <p><span className="font-bold">Email:</span> {userDetails.email}</p>
              <p><span className="font-bold">Rola:</span> {userDetails.role}</p>
              <p><span className="font-bold">Data utworzenia:</span> {new Date(userDetails.created_at).toLocaleDateString()}</p>
            </div>
            {userDetails.reader_profile && (
              <div className="border-t pt-4">
                <h4 className="font-bold mb-2">Profil Czytelnika</h4>
                <p>Numer karty: {userDetails.reader_profile.card_number}</p>
                <p>Data rejestracji: {new Date(userDetails.reader_profile.registration_date).toLocaleDateString()}</p>
              </div>
            )}
            {userDetails.loan_history && (
              <div className="border-t pt-4">
                <h4 className="font-bold mb-2">Historia Wypożyczeń</h4>
                <div className="max-h-40 overflow-y-auto">
                  {userDetails.loan_history.map((loan, index) => (
                    <div key={index} className="mb-2 p-2 bg-gray-50 rounded">
                      <p>Książka: {loan.book_title}</p>
                      <p>Data: {new Date(loan.loan_date).toLocaleDateString()}</p>
                      <p>Status: {loan.status}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <button
          onClick={() => setShowModal(false)}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Zamknij
        </button>
      </div>
    </div>
  );

  if (error) {
    return <div className="text-red-600 p-4">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Zarządzanie Użytkownikami</h1>
      <div className="grid gap-4">
        {users.map(user => (
          <div key={user.id} className="border p-4 rounded shadow">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold">{user.username}</p>
                <p className="text-gray-600">{user.email}</p>
                <p className="text-sm">Obecna rola: {user.role}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleInspect(user.id)}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Szczegóły
                </button>
                {user.role !== 'admin' && (
                  <>
                    {user.role === 'user' && (
                      <button
                        onClick={() => handlePromote(user.id, 'worker')}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                      >
                        Awansuj na Pracownika
                      </button>
                    )}
                    {user.role === 'worker' && (
                      <button
                        onClick={() => handlePromote(user.id, 'user')}
                        className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                      >
                        Degraduj do Użytkownika
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                    >
                      Usuń Użytkownika
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {showModal && <UserDetailsModal />}
    </div>
  );
};

export default ManageUsers; 
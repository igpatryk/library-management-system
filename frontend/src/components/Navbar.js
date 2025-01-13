import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/axios';

const Navbar = () => {
  const { user, logout } = useAuth();
  const [isReader, setIsReader] = useState(false);

  useEffect(() => {
    const checkReaderStatus = async () => {
      try {
        if (!user?.token || user?.role === 'admin' || user?.role === 'worker') {
          setIsReader(false);
          return;
        }

        const response = await api.get('/api/readers/check-status');
        setIsReader(response.data.is_reader);
      } catch (error) {
        console.error('Błąd podczas sprawdzania statusu czytelnika:', error);
        setIsReader(false);
      }
    };

    if (user && user.token) {
      checkReaderStatus();
    }
  }, [user]);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          System Biblioteczny
        </Link>
        <div className="navbar-links">
          <Link to="/" className="navbar-link">
            Książki
          </Link>

          {isReader ? (
            <Link to="/reservations/create" className="navbar-link">
              Zarezerwuj Książkę
            </Link>
          ) : user?.role === 'user' && (
            <Link to="/readers/register" className="navbar-link">
              Zarejestruj się jako Czytelnik
            </Link>
          )}

          {user && (user.role === 'admin' || user.role === 'worker') && (
            <>
              <div className="border-l border-gray-300 mx-2 h-6" />
              
              <div className="group relative inline-block">
                <span className="navbar-link cursor-default">Zarządzanie Książkami</span>
                <div className="absolute hidden group-hover:block bg-white border rounded shadow-lg mt-1">
                  <Link to="/loans/create" className="block px-4 py-2 hover:bg-gray-100">
                    Wypożycz Książkę
                  </Link>
                  <Link to="/manage-loans" className="block px-4 py-2 hover:bg-gray-100">
                    Zarządzaj Wypożyczeniami
                  </Link>
                  <Link to="/manage-reservations" className="block px-4 py-2 hover:bg-gray-100">
                    Zarządzaj Rezerwacjami
                  </Link>
                  {user.role === 'admin' && (
                    <Link to="/books/add" className="block px-4 py-2 hover:bg-gray-100">
                      Dodaj Książkę
                    </Link>
                  )}
                </div>
              </div>

              <div className="group relative inline-block">
                <span className="navbar-link cursor-default">Zarządzanie Czytelnikami</span>
                <div className="absolute hidden group-hover:block bg-white border rounded shadow-lg mt-1">
                  <Link to="/reader-requests" className="block px-4 py-2 hover:bg-gray-100">
                    Wnioski Czytelników
                  </Link>
                </div>
              </div>

              {user.role === 'admin' && (
                <div className="group relative inline-block">
                  <span className="navbar-link cursor-default">Narzędzia Administratora</span>
                  <div className="absolute hidden group-hover:block bg-white border rounded shadow-lg mt-1">
                    <Link to="/manage-users" className="block px-4 py-2 hover:bg-gray-100">
                      Zarządzaj Użytkownikami
                    </Link>
                    <Link to="/admin" className="block px-4 py-2 hover:bg-gray-100">
                      Panel Administratora
                    </Link>
                    <Link to="/reports" className="block px-4 py-2 hover:bg-gray-100">
                      Raporty
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}

          {user && (
            <Link to="/my-books" className="navbar-link">
              Moje Książki
            </Link>
          )}

          <button onClick={logout} className="navbar-link ml-auto">
            Wyloguj
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

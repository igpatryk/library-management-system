import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import BookList from './pages/BookList';
import AddBook from './pages/AddBook';
import RegisterReader from './pages/RegisterReader';
import LoanBook from './pages/LoanBook';
import ReserveBook from './pages/ReserveBook';
import Login from './pages/Login';
import Register from './pages/Register';
import ManageUsers from './pages/ManageUsers';
import ManageReaderRequests from './pages/ManageReaderRequests';
import AdminDashboard from './pages/AdminDashboard';
import Reports from './pages/Reports';
import ManageLoans from './pages/ManageLoans';
import ManageReservations from './pages/ManageReservations';
import MyBooks from './pages/MyBooks';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <div>
                    <Navbar />
                    <div className="container mx-auto p-4">
                      <Routes>
                        <Route path="/" element={<BookList />} />
                        <Route path="/books/add" element={<AddBook />} />
                        <Route path="/readers/register" element={<RegisterReader />} />
                        <Route path="/loans/create" element={<LoanBook />} />
                        <Route path="/reservations/create" element={<ReserveBook />} />
                        <Route path="/manage-users" element={<ManageUsers />} />
                        <Route path="/reader-requests" element={<ManageReaderRequests />} />
                        <Route path="/admin" element={<AdminDashboard />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/manage-loans" element={<ManageLoans />} />
                        <Route path="/manage-reservations" element={<ManageReservations />} />
                        <Route path="/my-books" element={<MyBooks />} />
                      </Routes>
                    </div>
                  </div>
                </PrivateRoute>
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

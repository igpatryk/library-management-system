import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/axios';

const Register = () => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        try {
            const response = await api.post('/api/auth/register', formData);
            if (response.data.message) {
                navigate('/login');
            }
        } catch (err) {
            setError(err.error || 'Rejestracja nie powiodła się. Spróbuj ponownie.');
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full space-y-8 p-8 bg-white rounded shadow">
                <div>
                    <h2 className="text-center text-3xl font-extrabold text-gray-900">
                        Zarejestruj nowe konto
                    </h2>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="text-red-500 text-center">{error}</div>
                    )}
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                            Nazwa użytkownika
                        </label>
                        <input
                            type="text"
                            name="username"
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            value={formData.username}
                            onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                            Email
                        </label>
                        <input
                            type="email"
                            name="email"
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                            Hasło
                        </label>
                        <input
                            type="password"
                            name="password"
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>
                    <div>
                        <button
                            type="submit"
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Zarejestruj się
                        </button>
                    </div>
                    <div className="text-center mt-4">
                        <p className="text-sm text-gray-600">
                            Masz już konto?{' '}
                            <Link to="/login" className="text-blue-600 hover:text-blue-500">
                                Zaloguj się tutaj
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Register;

import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ManageReaderRequests = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [processedRequests, setProcessedRequests] = useState([]);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingCurrentPage, setPendingCurrentPage] = useState(1);
  const [processedCurrentPage, setProcessedCurrentPage] = useState(1);
  const [pendingTotalPages, setPendingTotalPages] = useState(1);
  const [processedTotalPages, setProcessedTotalPages] = useState(1);

  const fetchRequests = useCallback(async () => {
    try {
      const [pendingRes, processedRes] = await Promise.all([
        api.get(`/api/reader-requests?status=pending&page=${pendingCurrentPage}`),
        api.get(`/api/reader-requests?status=processed&page=${processedCurrentPage}`)
      ]);
      
      setPendingRequests(pendingRes.data?.requests || []);
      setPendingTotalPages(pendingRes.data?.totalPages || 1);
      setProcessedRequests(processedRes.data?.requests || []);
      setProcessedTotalPages(processedRes.data?.totalPages || 1);
    } catch (err) {
      console.error('Błąd podczas pobierania wniosków:', err);
      setError('Nie udało się pobrać wniosków czytelników');
      setPendingRequests([]);
      setProcessedRequests([]);
    }
  }, [pendingCurrentPage, processedCurrentPage]);

  useEffect(() => {
    if (user.role !== 'admin' && user.role !== 'worker') {
      navigate('/');
    }
    fetchRequests();
  }, [user.role, navigate, fetchRequests]);

  const handleApprove = async (requestId) => {
    try {
      await api.post(`/api/reader-requests/${requestId}/approve`);
      fetchRequests();
    } catch (err) {
      setError('Nie udało się zatwierdzić wniosku');
    }
  };

  const openRejectModal = (requestId) => {
    setSelectedRequestId(requestId);
    setShowRejectModal(true);
    setRejectionReason('');
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('Proszę podać powód odrzucenia');
      return;
    }

    try {
      await api.post(`/api/reader-requests/${selectedRequestId}/reject`, {
        reason: rejectionReason
      });
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedRequestId(null);
      fetchRequests();
    } catch (err) {
      setError('Nie udało się odrzucić wniosku');
    }
  };

  const RejectModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-bold mb-4">Odrzuć wniosek o rejestrację</h3>
        <div className="mb-4">
          <label className="block mb-2">Powód odrzucenia *</label>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="w-full p-2 border rounded"
            rows="3"
            required
            placeholder="Proszę podać powód odrzucenia wniosku"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <button
            onClick={() => setShowRejectModal(false)}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Anuluj
          </button>
          <button
            onClick={handleReject}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Odrzuć
          </button>
        </div>
      </div>
    </div>
  );

  const Pagination = () => (
    <div className="flex justify-center mt-4 space-x-2">
      <button
        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
        disabled={currentPage === 1}
        className={`px-3 py-1 rounded ${
          currentPage === 1 
            ? 'bg-gray-300 cursor-not-allowed' 
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        Poprzednia
      </button>
      <span className="px-4 py-1">
        Strona {currentPage} z {totalPages}
      </span>
      <button
        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
        disabled={currentPage === totalPages}
        className={`px-3 py-1 rounded ${
          currentPage === totalPages 
            ? 'bg-gray-300 cursor-not-allowed' 
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        Następna
      </button>
    </div>
  );

  const RequestCard = ({ request, isPending }) => (
    <div className="border p-4 rounded shadow">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold">{request.username}</p>
          <p className="text-gray-600">{request.email}</p>
          <p>Adres: {request.address}</p>
          <p>Telefon: {request.phone_number}</p>
          <p className="text-sm text-gray-500">
            Data złożenia: {new Date(request.created_at).toLocaleDateString()}
          </p>
          {!isPending && (
            <>
              <p className={`mt-2 font-semibold ${
                request.status === 'approved' ? 'text-green-600' : 'text-red-600'
              }`}>
                Status: {request.status === 'approved' ? 'Zatwierdzony' : 'Odrzucony'}
              </p>
              {request.status === 'rejected' && (
                <p className="mt-1 text-gray-700">
                  Powód: {request.rejection_reason}
                </p>
              )}
              <p className="text-sm text-gray-500">
                Data przetworzenia: {new Date(request.processed_at).toLocaleDateString()}
              </p>
            </>
          )}
        </div>
        {isPending && (
          <div className="space-x-2">
            <button
              onClick={() => handleApprove(request.id)}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Zatwierdź
            </button>
            <button
              onClick={() => openRejectModal(request.id)}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Odrzuć
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Wnioski o Status Czytelnika</h2>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      
      <div className="flex border-b mb-4">
        <button
          className={`py-2 px-4 ${
            activeTab === 'pending'
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-500'
          }`}
          onClick={() => setActiveTab('pending')}
        >
          Oczekujące wnioski ({pendingRequests.length})
        </button>
        <button
          className={`py-2 px-4 ${
            activeTab === 'processed'
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-500'
          }`}
          onClick={() => setActiveTab('processed')}
        >
          Przetworzone wnioski
        </button>
      </div>

      <div className="grid gap-4">
        {activeTab === 'pending' ? (
          <>
            {pendingRequests.map(request => (
              <RequestCard key={request.id} request={request} isPending={true} />
            ))}
            {pendingRequests.length === 0 && (
              <p className="text-gray-500 text-center">Brak oczekujących wniosków</p>
            )}
          </>
        ) : (
          <>
            {processedRequests.map(request => (
              <RequestCard key={request.id} request={request} isPending={false} />
            ))}
            {processedRequests.length === 0 ? (
              <p className="text-gray-500 text-center">Brak przetworzonych wniosków</p>
            ) : (
              <Pagination />
            )}
          </>
        )}
      </div>

      {showRejectModal && <RejectModal />}
    </div>
  );
};

export default ManageReaderRequests; 
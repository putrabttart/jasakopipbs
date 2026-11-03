'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Icon } from './Icons';

const StockContext = createContext(null);

/**
 * Provider untuk cek stok akun. Diintegrasikan di root layout.
 */
export function StockProvider({ children }) {
  const [available, setAvailable] = useState(true);
  const [message, setMessage] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/account-stock', { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        if (json.error_code === 0) {
          setAvailable(!!json.data.available);
          setMessage(json.data.message || '');
        }
      } catch (_) {}
    }
    load();
    // Refresh tiap 30 detik
    const i = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, []);

  function showUnavailable(customMessage) {
    setMessage(customMessage || message);
    setShowModal(true);
  }

  return (
    <StockContext.Provider
      value={{ available, message, showUnavailable, setShowModal }}
    >
      {children}
      {showModal && (
        <UnavailableModal
          message={message}
          onClose={() => setShowModal(false)}
        />
      )}
    </StockContext.Provider>
  );
}

export function useStock() {
  const ctx = useContext(StockContext);
  if (!ctx) {
    return {
      available: true,
      message: '',
      showUnavailable: () => {},
      setShowModal: () => {},
    };
  }
  return ctx;
}

function UnavailableModal({ message, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden fade-up">
        <div className="px-6 pt-6 pb-4 text-center bg-gradient-to-br from-amber-50 to-orange-50">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 grid place-items-center text-white shadow-lg mb-3">
            <Icon.Info size={28} strokeWidth={2.5} />
          </div>
          <h2 className="text-base font-bold text-ink-900">Mohon Maaf</h2>
        </div>

        <div className="p-6">
          <p className="text-sm text-ink-700 leading-relaxed text-center whitespace-pre-line">
            {message ||
              'Mohon maaf, layanan sedang sibuk. Silakan coba lagi dalam beberapa saat ya.'}
          </p>

          <button
            onClick={onClose}
            className="w-full mt-5 bg-ink-900 hover:bg-ink-800 text-white text-sm font-bold py-3 rounded-xl transition active:scale-[.98]"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}

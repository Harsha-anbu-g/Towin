import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function NavBar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [sosSent, setSosSent] = useState(false);
  const [sending, setSending] = useState(false);

  const isElder = user?.role === 'ELDER' || user?.role === 'BOTH';

  const link = (to, label) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        pathname === to
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </Link>
  );

  async function triggerSos() {
    setSending(true);
    try {
      await api.post('/emergency/sos');
      setSosSent(true);
      setTimeout(() => setSosSent(false), 5000);
    } catch {
      alert('Could not send SOS. Please call emergency services directly.');
    } finally {
      setSending(false);
    }
  }

  return (
    <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link to="/dashboard" className="text-lg font-bold text-indigo-700">ToWin</Link>
        <div className="flex items-center gap-1">
          {link('/dashboard', 'Dashboard')}
          {link('/profile', 'Profile')}
          {isElder && link('/emergency-contacts', 'Emergency Contacts')}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {isElder && (
          <button
            onClick={triggerSos}
            disabled={sending}
            className={`text-sm font-bold px-4 py-1.5 rounded-full transition-colors ${
              sosSent
                ? 'bg-green-500 text-white'
                : 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
            } disabled:opacity-50`}
          >
            {sosSent ? '✓ Help sent' : sending ? '...' : '🆘 SOS'}
          </button>
        )}
        <button onClick={logout} className="text-sm text-red-500 hover:underline">
          Sign out
        </button>
      </div>
    </nav>
  );
}

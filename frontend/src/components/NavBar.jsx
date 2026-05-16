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

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`text-sm transition-colors px-3 py-1 rounded-full ${
        pathname === to
          ? 'text-white bg-white/20'
          : 'text-white/70 hover:text-white'
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
    <nav style={{ background: '#000', height: '44px' }} className="flex items-center px-6 gap-6">
      <Link to="/dashboard" className="text-white font-semibold text-sm tracking-tight mr-4">
        ToWin
      </Link>
      <div className="flex items-center gap-1 flex-1">
        {navLink('/dashboard', 'Dashboard')}
        {navLink('/profile', 'Profile')}
        {isElder && navLink('/emergency-contacts', 'Emergency')}
      </div>
      <div className="flex items-center gap-3">
        {isElder && (
          <button
            onClick={triggerSos}
            disabled={sending}
            className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors disabled:opacity-50 ${
              sosSent
                ? 'bg-green-500 text-white'
                : 'bg-red-600 text-white hover:bg-red-500'
            }`}
          >
            {sosSent ? 'Help sent' : sending ? '...' : 'SOS'}
          </button>
        )}
        <button onClick={logout} className="text-xs text-white/50 hover:text-white/80 transition-colors">
          Sign out
        </button>
      </div>
    </nav>
  );
}

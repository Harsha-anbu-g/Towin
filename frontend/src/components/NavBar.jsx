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

  const link = (to, label) => (
    <Link to={to} style={{
      fontSize: '12px',
      fontFamily: '-apple-system, SF Pro Text, system-ui, sans-serif',
      fontWeight: pathname === to ? 500 : 400,
      letterSpacing: '-0.12px',
      color: pathname === to ? '#ffffff' : 'rgba(245,245,247,0.72)',
      textDecoration: 'none',
      padding: '4px 8px',
      borderRadius: '5px',
      transition: 'color 0.12s',
    }}>{label}</Link>
  );

  return (
    <nav style={{
      background: '#000000',
      height: '44px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 22px',
      gap: '0',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Brand */}
      <Link to="/dashboard" style={{
        fontSize: '17px',
        fontWeight: 600,
        fontFamily: '-apple-system, SF Pro Display, system-ui, sans-serif',
        letterSpacing: '-0.3px',
        color: '#ffffff',
        textDecoration: 'none',
        marginRight: '32px',
      }}>ToWin</Link>

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
        {link('/dashboard', 'Dashboard')}
        {link('/profile', 'Profile')}
        {isElder && link('/emergency-contacts', 'Emergency')}
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isElder && (
          <button
            onClick={triggerSos}
            disabled={sending}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: '-apple-system, SF Pro Text, system-ui, sans-serif',
              letterSpacing: '0.2px',
              padding: '5px 14px',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.12s',
              background: sosSent ? '#1a7a1a' : '#cc0000',
              color: '#fff',
              opacity: sending ? 0.5 : 1,
            }}
          >
            {sosSent ? '✓ Help sent' : sending ? '…' : 'SOS'}
          </button>
        )}
        <button
          onClick={logout}
          style={{
            fontSize: '12px',
            fontFamily: '-apple-system, SF Pro Text, system-ui, sans-serif',
            fontWeight: 400,
            color: 'rgba(245,245,247,0.55)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            transition: 'color 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(245,245,247,0.9)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(245,245,247,0.55)'}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}

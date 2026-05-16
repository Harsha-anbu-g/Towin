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

  const navLinkStyle = (to) => ({
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: 'var(--font-body)',
    color: pathname === to ? '#fff' : 'rgba(255,255,255,0.55)',
    textDecoration: 'none',
    padding: '4px 10px',
    borderRadius: '6px',
    background: pathname === to ? 'rgba(255,255,255,0.1)' : 'transparent',
    transition: 'color 0.15s, background 0.15s',
  });

  return (
    <nav style={{
      background: '#000',
      height: '48px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: '24px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link to="/dashboard" style={{
        fontSize: '15px',
        fontWeight: 700,
        color: '#fff',
        textDecoration: 'none',
        fontFamily: 'var(--font-body)',
        letterSpacing: '-0.2px',
        marginRight: '8px',
      }}>
        ToWin
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
        <Link to="/dashboard" style={navLinkStyle('/dashboard')}>Dashboard</Link>
        <Link to="/profile" style={navLinkStyle('/profile')}>Profile</Link>
        {isElder && <Link to="/emergency-contacts" style={navLinkStyle('/emergency-contacts')}>Emergency</Link>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isElder && (
          <button
            onClick={triggerSos}
            disabled={sending}
            style={{
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.3px',
              padding: '5px 14px',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s',
              background: sosSent ? '#16a34a' : '#dc2626',
              color: '#fff',
              opacity: sending ? 0.5 : 1,
            }}
          >
            {sosSent ? 'Help sent' : sending ? '...' : 'SOS'}
          </button>
        )}
        <button
          onClick={logout}
          style={{
            fontSize: '13px',
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.45)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.target.style.color = 'rgba(255,255,255,0.8)'}
          onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.45)'}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}

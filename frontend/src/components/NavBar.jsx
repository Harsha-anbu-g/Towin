import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;

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
      // H9: error recovery — visual feedback instead of alert()
      setSosSent(false);
    } finally {
      setSending(false);
    }
  }

  const NavLink = ({ to, label, icon }) => {
    const active = pathname === to || pathname.startsWith(to + '/');
    return (
      <Link to={to} style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        fontSize: '12px', letterSpacing: '-0.12px',
        fontFamily: SF,
        fontWeight: active ? 500 : 400,
        color: active ? '#ffffff' : 'rgba(245,245,247,0.65)',
        textDecoration: 'none',
        padding: '4px 10px',
        borderRadius: '6px',
        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        transition: 'color 0.12s, background 0.12s',
        whiteSpace: 'nowrap',
      }}>
        {icon && <span style={{ opacity: active ? 1 : 0.7, fontSize: '13px' }}>{icon}</span>}
        {label}
      </Link>
    );
  };

  return (
    <nav style={{
      background: '#000000',
      height: '44px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Brand — H4: consistent brand placement */}
      <Link to="/dashboard" style={{
        fontSize: '17px', fontWeight: 600,
        fontFamily: SFD,
        letterSpacing: '-0.3px',
        color: '#ffffff',
        textDecoration: 'none',
        marginRight: '28px',
        flexShrink: 0,
      }}>
        ToWin
      </Link>

      {/* Nav links — H4: consistent navigation, same items every page */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
        <NavLink to="/dashboard" label="Dashboard" />
        {/* H4: Messages always in nav — users expect it */}
        <NavLink to="/messages" label="Messages" />
        <NavLink to="/profile" label="Profile" />
        {isElder && <NavLink to="/emergency-contacts" label="Emergency" />}
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* H1: SOS gives clear visual feedback of state */}
        {isElder && (
          <button
            onClick={triggerSos}
            disabled={sending}
            title="Send emergency alert to your contacts"
            style={{
              fontSize: '12px', fontWeight: 600,
              fontFamily: SF,
              letterSpacing: '0.2px',
              padding: '5px 14px',
              borderRadius: '9999px',
              border: 'none',
              cursor: sending ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, transform 0.1s',
              background: sosSent ? '#1a7a1a' : sending ? '#660000' : '#cc0000',
              color: '#fff',
              opacity: sending ? 0.7 : 1,
              transform: sending ? 'scale(0.97)' : 'scale(1)',
            }}
            onMouseDown={e => !sending && (e.currentTarget.style.transform = 'scale(0.95)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {sosSent ? '✓ Help sent' : sending ? 'Sending…' : 'SOS'}
          </button>
        )}

        {/* H4: consistent sign-out placement */}
        <button
          onClick={logout}
          style={{
            fontSize: '12px', fontFamily: SF,
            fontWeight: 400,
            color: 'rgba(245,245,247,0.5)',
            background: 'none', border: 'none',
            cursor: 'pointer', padding: '4px 8px',
            transition: 'color 0.12s',
            borderRadius: '4px',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(245,245,247,0.9)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(245,245,247,0.5)'}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}

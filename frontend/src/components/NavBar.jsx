import { useState, useEffect } from 'react';
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
  const isHelper = user?.role === 'HELPER' || user?.role === 'BOTH';
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetch = () => api.get('/messages/unread-count').then(r => setUnread(r.data)).catch(() => {});
    fetch();
    const id = setInterval(fetch, 30000);
    return () => clearInterval(id);
  }, [user]);

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
        display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '16px', letterSpacing: '-0.15px',
        fontFamily: SF,
        fontWeight: active ? 600 : 500,
        color: active ? '#3D8AB0' : '#5a6470',
        textDecoration: 'none',
        padding: '10px 18px',
        borderRadius: '10px',
        background: active ? '#EAF5FB' : 'transparent',
        transition: 'color 0.12s, background 0.12s',
        whiteSpace: 'nowrap',
      }}>
        {icon && <span style={{ opacity: active ? 1 : 0.8, fontSize: '17px' }}>{icon}</span>}
        {label}
      </Link>
    );
  };

  return (
    <nav style={{
      background: '#ffffff',
      height: '72px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 32px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      borderBottom: '1px solid #ececef',
    }}>
      {/* Brand — H4: consistent brand placement */}
      <Link to="/dashboard" style={{
        fontSize: '24px', fontWeight: 800,
        fontFamily: SFD,
        letterSpacing: '-0.4px',
        color: '#1a5c2e',
        textDecoration: 'none',
        marginRight: '40px',
        flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', gap: '8px',
      }}>
        <img src="/logo.png" alt="ToWin logo" style={{ width: 44, height: 44, objectFit: 'contain' }} />
        ToWin
      </Link>

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>

        {/* ── Core navigation ── */}
        <NavLink to="/dashboard" label="Dashboard" />
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <NavLink to="/messages" label="Messages" />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: '6px', right: '6px',
              background: '#cc0000', color: '#fff',
              fontSize: '10px', fontWeight: 700, fontFamily: SF,
              borderRadius: '9999px', padding: '1px 5px',
              minWidth: '16px', textAlign: 'center',
              pointerEvents: 'none',
            }}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
        <NavLink to="/profile" label="Profile" />

        {/* ── Trust Score — stands on its own ── */}
        <div style={{ width: '1px', height: '22px', background: '#e0e0e0', margin: '0 8px' }} />
        {(() => {
          const active = pathname === '/trust';
          return (
            <Link to="/trust" style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '15px', fontFamily: SF, fontWeight: 600,
              color: active ? '#fff' : '#4FA3CE',
              background: active ? '#4FA3CE' : 'rgba(79,163,206,0.1)',
              border: `1.5px solid ${active ? '#4FA3CE' : 'rgba(79,163,206,0.35)'}`,
              borderRadius: '9999px',
              padding: '6px 16px',
              textDecoration: 'none',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}>
              ⭐ Trust Score
            </Link>
          );
        })()}

        {/* ── Utility / help links (subdued) ── */}
        <div style={{ width: '1px', height: '22px', background: '#e0e0e0', margin: '0 8px' }} />
        {[
          { to: '/how-it-works', label: '📖 Guide' },
          ...(isElder ? [{ to: '/emergency-contacts', label: '🚨 Emergency' }] : []),
        ].map(({ to, label }) => {
          const active = pathname === to;
          return (
            <Link key={to} to={to} style={{
              fontSize: '14px', fontFamily: SF, fontWeight: active ? 600 : 400,
              color: active ? '#3D8AB0' : '#9a9a9f',
              textDecoration: 'none',
              padding: '8px 14px',
              borderRadius: '10px',
              background: active ? '#EAF5FB' : 'transparent',
              transition: 'color 0.12s, background 0.12s',
              whiteSpace: 'nowrap',
            }}>
              {label}
            </Link>
          );
        })}
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* H1: SOS gives clear visual feedback of state */}
        {isElder && (
          <button
            onClick={triggerSos}
            disabled={sending}
            title="Send emergency alert to your contacts"
            style={{
              fontSize: '15px', fontWeight: 700,
              fontFamily: SF,
              letterSpacing: '0.3px',
              padding: '10px 22px',
              borderRadius: '9999px',
              border: 'none',
              cursor: sending ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, transform 0.1s',
              background: sosSent ? '#3D8AB0' : sending ? '#660000' : '#cc0000',
              color: '#fff',
              opacity: sending ? 0.7 : 1,
              transform: sending ? 'scale(0.97)' : 'scale(1)',
            }}
            onMouseDown={e => !sending && (e.currentTarget.style.transform = 'scale(0.95)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {sosSent ? 'Help sent' : sending ? 'Sending…' : 'SOS'}
          </button>
        )}

        {/* H4: consistent sign-out placement */}
        <button
          onClick={logout}
          style={{
            fontSize: '15px', fontFamily: SF,
            fontWeight: 500,
            color: '#7a7a7a',
            background: 'none', border: 'none',
            cursor: 'pointer', padding: '8px 14px',
            transition: 'color 0.12s',
            borderRadius: '8px',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#1d1d1f'}
          onMouseLeave={e => e.currentTarget.style.color = '#7a7a7a'}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}

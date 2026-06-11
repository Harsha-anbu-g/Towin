import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;

export default function NavBar() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { pathname } = useLocation();
  const [sosSent, setSosSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Collapse to the hamburger drawer below 1024px — the full desktop rail
  // (logo + 6 links + Trust pill + SOS + Sign out) needs ~1000px to fit.
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

  const isElder = user?.role === 'ELDER' || user?.role === 'BOTH';
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

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
    } catch (err) {
      setSosSent(false);
      toast.error(
        err?.response?.data?.message ||
        'Could not send SOS. Please call your emergency contact directly.'
      );
    }
    finally { setSending(false); }
  }

  const NavLink = ({ to, label }) => {
    const active = pathname === to || pathname.startsWith(to + '/');
    return (
      <Link to={to} style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '16px', fontFamily: SF,
        fontWeight: active ? 600 : 500,
        color: active ? '#4FA3CE' : '#5a6470',
        textDecoration: 'none',
        padding: '10px 18px',
        borderRadius: '10px',
        background: active ? 'rgba(79,163,206,0.08)' : 'transparent',
        transition: 'color 0.12s, background 0.12s',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </Link>
    );
  };

  // Mobile menu link
  const MenuLink = ({ to, label }) => {
    const active = pathname === to || pathname.startsWith(to + '/');
    return (
      <Link to={to} onClick={() => setMenuOpen(false)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 0',
        borderBottom: '1px solid #f0f0f0',
        fontSize: '17px', fontFamily: SF,
        fontWeight: active ? 700 : 500,
        color: active ? '#4FA3CE' : '#1d1d1f',
        textDecoration: 'none',
      }}>
        {label}
        {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4FA3CE' }} />}
      </Link>
    );
  };

  const trustActive = pathname === '/trust';

  return (
    <>
      <nav style={{
        background: '#ffffff',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '1px solid #ececef',
      }}>
        {/* Brand */}
        <Link to="/dashboard" style={{
          fontSize: '22px', fontWeight: 800, fontFamily: SFD,
          letterSpacing: '-0.4px', color: '#1a5c2e',
          textDecoration: 'none', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          marginRight: isMobile ? 0 : '32px',
        }}>
          <img src="/logo.png" alt="ToWin logo" style={{ width: 38, height: 38, objectFit: 'contain' }} />
          {!isMobile && 'ToWin'}
        </Link>

        {/* Desktop nav */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
            <NavLink to="/dashboard" label="Dashboard" />
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <NavLink to="/messages" label="Messages" />
              {unread > 0 && (
                <span style={{
                  position: 'absolute', top: '6px', right: '6px',
                  background: '#9b3535', color: '#fff',
                  fontSize: '10px', fontWeight: 700, fontFamily: SF,
                  borderRadius: '9999px', padding: '1px 5px',
                  minWidth: '16px', textAlign: 'center', pointerEvents: 'none',
                }}>{unread > 99 ? '99+' : unread}</span>
              )}
            </div>
            <NavLink to="/profile" label="Profile" />
            <div style={{ width: '1px', height: '22px', background: '#e0e0e0', margin: '0 8px' }} />
            <Link to="/trust" style={{
              display: 'flex', alignItems: 'center',
              fontSize: '15px', fontFamily: SF, fontWeight: 600,
              color: trustActive ? '#fff' : '#4FA3CE',
              background: trustActive ? '#4FA3CE' : 'rgba(79,163,206,0.1)',
              border: `1.5px solid ${trustActive ? '#4FA3CE' : 'rgba(79,163,206,0.35)'}`,
              borderRadius: '9999px', padding: '6px 16px',
              textDecoration: 'none', transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>Trust Score</Link>
            <div style={{ width: '1px', height: '22px', background: '#e0e0e0', margin: '0 8px' }} />
            {[
              { to: '/how-it-works', label: 'Guide' },
              ...(isElder ? [{ to: '/emergency-contacts', label: 'Emergency' }] : []),
            ].map(({ to, label }) => {
              const active = pathname === to;
              return (
                <Link key={to} to={to} style={{
                  fontSize: '14px', fontFamily: SF, fontWeight: active ? 600 : 400,
                  color: active ? '#4FA3CE' : '#9a9a9f',
                  textDecoration: 'none', padding: '8px 14px', borderRadius: '10px',
                  background: active ? 'rgba(79,163,206,0.08)' : 'transparent',
                  whiteSpace: 'nowrap',
                }}>{label}</Link>
              );
            })}
          </div>
        )}

        {/* Desktop right actions */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {isElder && (
              <button onClick={triggerSos} disabled={sending} style={{
                fontSize: '15px', fontWeight: 700, fontFamily: SF,
                padding: '10px 22px', borderRadius: '9999px', border: 'none',
                cursor: sending ? 'not-allowed' : 'pointer',
                background: sosSent ? '#4FA3CE' : sending ? '#7a2a2a' : '#9b3535',
                color: '#fff', opacity: sending ? 0.7 : 1,
              }}>{sosSent ? 'Help sent' : sending ? 'Sending…' : 'SOS'}</button>
            )}
            <button onClick={logout} style={{
              fontSize: '15px', fontFamily: SF, fontWeight: 500,
              color: '#7a7a7a', background: 'none', border: 'none',
              cursor: 'pointer', padding: '8px 14px', borderRadius: '8px',
            }}>Sign out</button>
          </div>
        )}

        {/* Mobile right — unread badge + SOS + hamburger */}
        {isMobile && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {unread > 0 && (
              <Link to="/messages" style={{ textDecoration: 'none' }}>
                <span style={{
                  background: '#9b3535', color: '#fff', fontSize: '11px',
                  fontWeight: 700, fontFamily: SF, borderRadius: '9999px',
                  padding: '3px 8px',
                }}>{unread}</span>
              </Link>
            )}
            {isElder && (
              <button onClick={triggerSos} disabled={sending} style={{
                fontSize: '13px', fontWeight: 700, fontFamily: SF,
                padding: '7px 14px', borderRadius: '9999px', border: 'none',
                cursor: sending ? 'not-allowed' : 'pointer',
                background: sosSent ? '#4FA3CE' : '#9b3535',
                color: '#fff',
              }}>{sosSent ? 'Sent' : 'SOS'}</button>
            )}
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Menu"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}
            >
              <span style={{ display: 'block', width: 22, height: 2, background: menuOpen ? '#4FA3CE' : '#1d1d1f', borderRadius: 2, transition: 'all 0.2s', transform: menuOpen ? 'rotate(45deg) translateY(7px)' : 'none' }} />
              <span style={{ display: 'block', width: 22, height: 2, background: menuOpen ? 'transparent' : '#1d1d1f', borderRadius: 2, transition: 'all 0.2s' }} />
              <span style={{ display: 'block', width: 22, height: 2, background: menuOpen ? '#4FA3CE' : '#1d1d1f', borderRadius: 2, transition: 'all 0.2s', transform: menuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' }} />
            </button>
          </div>
        )}
      </nav>

      {/* Mobile drawer */}
      {isMobile && menuOpen && (
        <>
          {/* Backdrop */}
          <div onClick={() => setMenuOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)',
            zIndex: 98, top: '60px',
          }} />
          {/* Drawer */}
          <div style={{
            position: 'fixed', top: '60px', left: 0, right: 0,
            background: '#ffffff', zIndex: 99,
            padding: '0 24px 24px',
            borderBottom: '1px solid #e0e0e0',
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
          }}>
            <MenuLink to="/dashboard" label="Dashboard" />
            <MenuLink to="/messages" label={`Messages${unread > 0 ? ` (${unread})` : ''}`} />
            <MenuLink to="/profile" label="Profile" />
            <MenuLink to="/trust" label="Trust Score" />
            <MenuLink to="/how-it-works" label="Guide" />
            {isElder && <MenuLink to="/emergency-contacts" label="Emergency Contacts" />}
            <button onClick={() => { setMenuOpen(false); logout(); }} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '16px 0', marginTop: '4px',
              fontSize: '17px', fontFamily: SF, fontWeight: 500,
              color: '#7a7a7a', background: 'none', border: 'none',
              cursor: 'pointer',
            }}>Sign out</button>
          </div>
        </>
      )}
    </>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, MessageCircle, User, ShieldCheck, HelpCircle, LogOut, Siren, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from './ConfirmDialog';
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
  const [accountOpen, setAccountOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  // The beta banner sits above the nav, so the nav isn't always at viewport
  // top — measure its real bottom edge to anchor the mobile drawer below it.
  const navRef = useRef(null);
  const accountRef = useRef(null);
  const [drawerTop, setDrawerTop] = useState(60);
  // Collapse to the hamburger drawer below 1024px — the desktop rail
  // (logo + core links + Trust pill + SOS + account) needs ~1000px to fit.
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

  const isElder = user?.role === 'ELDER' || user?.role === 'BOTH';
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close menus on route change
  useEffect(() => { setMenuOpen(false); setAccountOpen(false); }, [pathname]);

  // Close the account dropdown on outside click or Esc
  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (e) => { if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setAccountOpen(false); };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); window.removeEventListener('keydown', onKey); };
  }, [accountOpen]);

  // Esc closes the open mobile drawer — user control & freedom (H3/H7)
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Anchor the drawer to the nav's actual bottom (banner may sit above it).
  useEffect(() => {
    if (!menuOpen) return;
    const measure = () => {
      if (navRef.current) setDrawerTop(Math.round(navRef.current.getBoundingClientRect().bottom));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [menuOpen]);

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

  const NavLink = ({ to, label, icon: Icon }) => {
    const active = pathname === to || pathname.startsWith(to + '/');
    return (
      <Link to={to} style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '16px', fontFamily: SF,
        fontWeight: active ? 600 : 500,
        color: active ? '#4FA3CE' : '#5a6470',
        textDecoration: 'none',
        padding: '10px 16px',
        borderRadius: '10px',
        background: active ? 'rgba(79,163,206,0.08)' : 'transparent',
        transition: 'color 0.12s, background 0.12s',
        whiteSpace: 'nowrap',
      }}>
        {Icon && <Icon size={18} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />}
        {label}
      </Link>
    );
  };

  // Mobile menu link
  const MenuLink = ({ to, label, icon: Icon }) => {
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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '14px' }}>
          {Icon && <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />}
          {label}
        </span>
        {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)' }} />}
      </Link>
    );
  };

  const trustActive = pathname === '/trust';

  return (
    <>
      <nav ref={navRef} style={{
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
          fontSize: '21px', fontWeight: 600, fontFamily: SFD,
          letterSpacing: '-0.374px', color: 'var(--green-deep)',
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
            <NavLink to="/dashboard" label="Dashboard" icon={Home} />
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <NavLink to="/messages" label="Messages" icon={MessageCircle} />
              {unread > 0 && (
                <span style={{
                  position: 'absolute', top: '6px', right: '6px',
                  background: 'var(--red-deep)', color: '#fff',
                  fontSize: '10px', fontWeight: 700, fontFamily: SF,
                  borderRadius: '9999px', padding: '1px 5px',
                  minWidth: '16px', textAlign: 'center', pointerEvents: 'none',
                }}>{unread > 99 ? '99+' : unread}</span>
              )}
            </div>
            <div style={{ width: '1px', height: '22px', background: 'var(--border)', margin: '0 8px' }} />
            <Link to="/trust" style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              fontSize: '16px', fontFamily: SF, fontWeight: 600,
              color: trustActive ? '#fff' : '#9C7A3C',
              background: trustActive ? '#9C7A3C' : 'rgba(156,122,60,0.1)',
              border: `1.5px solid ${trustActive ? '#9C7A3C' : 'rgba(156,122,60,0.35)'}`,
              borderRadius: '9999px', padding: '6px 16px',
              textDecoration: 'none', transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>
              <ShieldCheck size={17} strokeWidth={2.2} aria-hidden="true" />
              Trust Score
            </Link>
            {/* Asking for help is the elder's main action, so it sits right by the
                Trust Score pill as the primary blue CTA — not buried in a tab bar. */}
            {isElder && (
              <Link to="/dashboard?post=1" style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                fontSize: '16px', fontFamily: SF, fontWeight: 600,
                color: '#4FA3CE', background: 'rgba(79,163,206,0.1)',
                border: '1.5px solid rgba(79,163,206,0.35)',
                borderRadius: '9999px', padding: '6px 16px',
                textDecoration: 'none', transition: 'all 0.15s', whiteSpace: 'nowrap',
                marginLeft: '8px',
              }}>
                <Plus size={17} strokeWidth={2.4} aria-hidden="true" />
                Post New Help
              </Link>
            )}
          </div>
        )}

        {/* Desktop right actions */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <NavLink to="/how-it-works" label="Guide" icon={HelpCircle} />
            {isElder && (
              <button onClick={triggerSos} disabled={sending}
                title="Send an urgent alert to all your emergency contacts"
                aria-label="Send SOS alert to your emergency contacts"
                style={{
                fontSize: '16px', fontWeight: 700, fontFamily: SF,
                padding: '10px 22px', borderRadius: '9999px', border: 'none',
                cursor: sending ? 'not-allowed' : 'pointer',
                background: sosSent ? '#4FA3CE' : sending ? '#7a2a2a' : '#9b3535',
                color: '#fff', opacity: sending ? 0.7 : 1,
              }}>{sosSent ? 'Help sent' : sending ? 'Sending…' : 'SOS'}</button>
            )}

            {/* Account circle — Profile & Log out live here */}
            <div ref={accountRef} style={{ position: 'relative' }}>
              <button onClick={() => setAccountOpen(o => !o)}
                aria-label="Account menu" aria-haspopup="true" aria-expanded={accountOpen}
                style={{
                  width: '40px', height: '40px', borderRadius: '50%', border: 'none',
                  cursor: 'pointer', background: 'var(--blue)', color: '#fff',
                  fontSize: '16px', fontWeight: 600, fontFamily: SF,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M12 14c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6z" />
                </svg>
              </button>
              {accountOpen && (
                <div role="menu" style={{
                  position: 'absolute', top: '52px', right: 0,
                  background: '#fff', borderRadius: '14px',
                  border: '1px solid #ececef', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  padding: '8px', minWidth: '210px', zIndex: 110,
                }}>
                  <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid #f0f0f0', marginBottom: '6px' }}>
                    <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', margin: 0, fontFamily: SF }}>
                      {user?.name || 'Your account'}
                    </p>
                    {user?.username && (
                      <p style={{ fontSize: '14px', color: 'var(--ink-4)', margin: '2px 0 0' }}>@{user.username}</p>
                    )}
                  </div>
                  <Link to="/profile" role="menuitem" onClick={() => setAccountOpen(false)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', borderRadius: '10px', textDecoration: 'none',
                    color: 'var(--ink)', fontSize: '16px', fontWeight: 500, fontFamily: SF,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f7'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <User size={18} strokeWidth={2} aria-hidden="true" />Profile
                  </Link>
                  {isElder && (
                    <Link to="/emergency-contacts" role="menuitem" onClick={() => setAccountOpen(false)} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', borderRadius: '10px', textDecoration: 'none',
                      color: 'var(--ink)', fontSize: '16px', fontWeight: 500, fontFamily: SF,
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f7'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Siren size={18} strokeWidth={2} aria-hidden="true" />Emergency Contacts
                    </Link>
                  )}
                  <button role="menuitem" onClick={() => { setAccountOpen(false); setConfirmSignOut(true); }} style={{
                    display: 'flex', width: '100%', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', borderRadius: '10px', background: 'none', border: 'none',
                    cursor: 'pointer', color: 'var(--ink-3)', fontSize: '16px', fontWeight: 500,
                    fontFamily: SF, textAlign: 'left',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f7'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <LogOut size={18} strokeWidth={2} aria-hidden="true" />Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile right — unread badge + SOS + hamburger */}
        {isMobile && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {unread > 0 && (
              <Link to="/messages" style={{ textDecoration: 'none' }}>
                <span style={{
                  background: 'var(--red-deep)', color: '#fff', fontSize: '12px',
                  fontWeight: 700, fontFamily: SF, borderRadius: '9999px',
                  padding: '3px 8px',
                }}>{unread}</span>
              </Link>
            )}
            {isElder && (
              <button onClick={triggerSos} disabled={sending}
                title="Send an urgent alert to all your emergency contacts"
                aria-label="Send SOS alert to your emergency contacts"
                style={{
                fontSize: '14px', fontWeight: 700, fontFamily: SF,
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
            zIndex: 98, top: drawerTop,
          }} />
          {/* Drawer */}
          <div style={{
            position: 'fixed', top: drawerTop, left: 0, right: 0,
            background: '#ffffff', zIndex: 99,
            padding: '0 24px 24px',
            borderBottom: '1px solid #e0e0e0',
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
          }}>
            <MenuLink to="/dashboard" label="Dashboard" icon={Home} />
            <MenuLink to="/messages" label={`Messages${unread > 0 ? ` (${unread})` : ''}`} icon={MessageCircle} />
            <MenuLink to="/profile" label="Profile" icon={User} />
            {isElder && <MenuLink to="/emergency-contacts" label="Emergency Contacts" icon={Siren} />}
            {isElder && <MenuLink to="/dashboard?post=1" label="Post New Help" icon={Plus} />}
            <MenuLink to="/trust" label="Trust Score" icon={ShieldCheck} />
            <MenuLink to="/how-it-works" label="Guide" icon={HelpCircle} />
            <button onClick={() => { setMenuOpen(false); setConfirmSignOut(true); }} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '16px 0', marginTop: '4px',
              fontSize: '17px', fontFamily: SF, fontWeight: 500,
              color: 'var(--ink-3)', background: 'none', border: 'none',
              cursor: 'pointer',
            }}>Log out</button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmSignOut}
        title="Log out of ToWin?"
        message="You can log back in any time with your email and password."
        confirmLabel="Log Out"
        cancelLabel="Stay Logged In"
        onConfirm={() => { setConfirmSignOut(false); logout(); }}
        onCancel={() => setConfirmSignOut(false)}
      />
    </>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import api from '../api/axios';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const TRUST_LABELS = {
  DISCOVERED: 'Just Connected',
  MESSAGING: 'Messaging',
  PHONE_CALL: 'Phone Ready',
  VIDEO_CALL: 'Video Ready',
  VERIFIED: 'Verified',
  FIRST_MEET: 'Ready to Meet',
  TRUSTED: 'Fully Trusted',
};

function timeAgo(iso) {
  if (!iso) return '';
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60)   return 'now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  const d = Math.floor(secs / 86400);
  if (d < 7)  return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}w`;
  return `${Math.floor(d / 30)}mo`;
}

const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

const Avatar = ({ name, size = 52 }) => (
  <div style={{
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: 'var(--blue-wash)',
    border: '1px solid #BFD9EA',
    color: 'var(--blue)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${Math.round(size * 0.36)}px`,
    fontWeight: 600,
    fontFamily: SF,
  }}>
    {initials(name)}
  </div>
);

export default function MessagesInbox() {
  const navigate = useNavigate();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get('/connections')
      .then(r => setConnections(r.data || []))
      .catch(() => setConnections([]))
      .finally(() => setLoading(false));
  }, []);

  const active = connections
    .filter(c => c.status === 'ACTIVE')
    .sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt) : new Date(a.createdAt);
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt) : new Date(b.createdAt);
      return tb - ta;
    });

  const q = query.trim().toLowerCase();
  const filtered = q
    ? active.filter(c =>
        (c.otherUserName || '').toLowerCase().includes(q) ||
        (c.lastMessagePreview || '').toLowerCase().includes(q))
    : active;

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>
      <NavBar />

      <BlurFade delay={1}>
        <div style={{
          background: 'linear-gradient(180deg, #EAF5FB 0%, #f5f5f7 100%)',
          borderBottom: '1px solid #DCEBF4',
          padding: 'clamp(28px, 6vw, 48px) 20px clamp(20px, 4vw, 32px)',
          textAlign: 'center',
        }}>
          <h1 style={{
            fontSize: 'clamp(28px, 7vw, 40px)',
            fontWeight: 600,
            color: 'var(--ink)',
            fontFamily: SF,
            letterSpacing: '-0.8px',
            marginBottom: '8px',
          }}>
            Messages
          </h1>
          <p style={{ fontSize: '16px', color: '#5a6b75', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
            Your conversations with trusted connections.
          </p>
        </div>
      </BlurFade>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px 60px' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                background: '#fff', borderRadius: '14px', height: '76px',
                animation: 'shimmer 1.5s ease-in-out infinite',
                border: '1px solid #ececef',
              }} />
            ))}
          </div>
        )}

        {!loading && active.length === 0 && (
          <BlurFade delay={2}>
            <div style={{
              background: '#ffffff',
              border: '1px solid #ececef',
              borderRadius: '18px',
              padding: '56px 24px',
              textAlign: 'center',
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'var(--blue-wash)', margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px', fontFamily: SF }}>
                No conversations yet
              </p>
              <p style={{ fontSize: '15px', color: 'var(--ink-3)', marginBottom: '20px' }}>
                Connect with someone on your dashboard to start chatting.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  background: 'var(--blue)', color: '#fff', border: 'none',
                  borderRadius: '9999px', padding: '10px 22px',
                  fontSize: '15px', fontWeight: 600, fontFamily: SFText, cursor: 'pointer',
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </BlurFade>
        )}

        {!loading && active.length > 0 && (
          <>
            {/* Search */}
            <BlurFade delay={1}>
              <div style={{ position: 'relative', marginBottom: '18px' }}>
                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a0a0a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </span>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search conversations"
                  aria-label="Search conversations"
                  style={{
                    width: '100%', boxSizing: 'border-box', height: '48px',
                    border: '1.5px solid #e0e0e0', borderRadius: '9999px',
                    padding: '0 18px 0 44px', fontSize: '16px', fontFamily: SFText,
                    color: 'var(--ink)', background: '#fff', outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#4FA3CE'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e0e0e0'}
                />
              </div>
            </BlurFade>

            {filtered.length === 0 ? (
              <div style={{
                background: '#ffffff', border: '1px solid #ececef',
                borderRadius: '18px', padding: '40px 24px', textAlign: 'center',
              }}>
                <p style={{ fontSize: '16px', color: 'var(--ink-3)', margin: 0 }}>
                  No conversations match “{query.trim()}”.
                </p>
              </div>
            ) : (
              <div style={{
                background: '#ffffff',
                border: '1px solid #ececef',
                borderRadius: '18px',
                overflow: 'hidden',
              }}>
                {filtered.map((c, i) => {
                  const trustLabel = TRUST_LABELS[c.currentTrustLevel];
                  return (
                  <BlurFade key={c.id} delay={1 + i * 0.3}>
                    <button
                      onClick={() => navigate(`/messages/${c.id}`)}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: i === filtered.length - 1 ? 'none' : '1px solid #ececef',
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: SFText,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Avatar name={c.otherUserName} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{
                              fontSize: '16px', fontWeight: c.unreadCount > 0 ? 700 : 600,
                              color: 'var(--ink)', fontFamily: SF,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {c.otherUserName || 'User'}
                            </span>
                            {trustLabel && (
                              <span style={{
                                fontSize: '12px', fontWeight: 600, fontFamily: SFText,
                                color: 'var(--blue)', background: 'var(--surface)',
                                border: '1px solid #e0e0e0', borderRadius: '9999px',
                                padding: '1px 8px', whiteSpace: 'nowrap', flexShrink: 0,
                                letterSpacing: '0.1px',
                              }}>
                                {trustLabel}
                              </span>
                            )}
                          </span>
                          <span style={{ fontSize: '13px', color: 'var(--ink-4)', flexShrink: 0, fontFamily: SFText }}>
                            {timeAgo(c.lastMessageAt)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <p style={{
                            fontSize: '14px', margin: 0,
                            color: c.unreadCount > 0 ? '#1d1d1f' : '#7a7a7a',
                            fontWeight: c.unreadCount > 0 ? 500 : 400,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {c.lastMessagePreview || 'No messages yet'}
                          </p>
                          {c.unreadCount > 0 && (
                            <span style={{
                              background: 'var(--blue)', color: '#fff',
                              fontSize: '12px', fontWeight: 600, fontFamily: SFText,
                              borderRadius: '9999px', padding: '2px 7px',
                              flexShrink: 0, minWidth: '20px', textAlign: 'center',
                            }}>
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <svg width="10" height="16" viewBox="0 0 10 16" fill="none" style={{ flexShrink: 0, marginLeft: '4px' }}>
                        <path d="M1.5 1L8.5 8L1.5 15" stroke="#c0c0c5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </BlurFade>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import api from '../api/axios';
import SmoothInput from '../components/SmoothInput';
import { parseServerDate } from '../lib/utils';

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
  const date = parseServerDate(iso);
  if (!date) return '';
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
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
    background: 'var(--slate-tint)',
    border: '1px solid var(--slate-soft)',
    color: 'var(--ink-slate)',
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

const headingStyle = {
  fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--ink-4)', fontFamily: SFText, margin: '0 4px 8px',
};
const listCardStyle = {
  background: 'var(--canvas)', border: '1px solid var(--border)',
  borderRadius: '18px', overflow: 'hidden', marginBottom: '16px',
};
const rowStyle = (isLast) => ({
  width: '100%', background: 'transparent', border: 'none',
  borderBottom: isLast ? 'none' : '1px solid var(--border)',
  padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px',
  cursor: 'pointer', textAlign: 'left', fontFamily: SFText, minHeight: '44px',
});

// The inbox is grouped by who each chat is with. A helper's chat with a family
// member, and a family member's chat with their parent, both belong under
// "Family". Order is fixed; empty sections never render.
const SECTION_ORDER = ['Elders', 'Helpers', 'Family'];
function sectionOf(c) {
  if (c.otherUserRole === 'HELPER') return 'Helpers';
  if (c.otherUserRole === 'FAMILY') return 'Family';
  if (c.type === 'FAMILY') return 'Family';   // a parent↔family chat, the family member's side
  return 'Elders';
}

export default function MessagesInbox() {
  const navigate = useNavigate();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [journeyThreads, setJourneyThreads] = useState([]);

  useEffect(() => {
    api.get('/connections')
      .then(r => setConnections(r.data || []))
      .catch(() => setConnections([]))
      .finally(() => setLoading(false));
    // Family updates threads a linked family member can read (their parents'
    // shared friendships at Ready to Meet or beyond).
    api.get('/family/journey').then(r => {
      const rows = [];
      for (const e of (r.data?.elders || [])) {
        for (const h of (e.sharedHelpers || [])) {
          if (h.stageIndex >= 5) {
            rows.push({ id: h.connectionId, title: `${e.elderName} & ${h.helperName}`, photo: h.helperPhotoUrl || null });
          }
        }
      }
      setJourneyThreads(rows);
    }).catch(() => {});
  }, []);

  // As a participant, my own shared friendships carry the same group thread.
  const participantThreads = connections
    .filter(c => c.status === 'ACTIVE' && c.sharedWithFamily
      && (c.currentTrustLevel === 'FIRST_MEET' || c.currentTrustLevel === 'TRUSTED'))
    .map(c => ({ id: c.id, title: `You & ${c.otherUserName}`, photo: null }));
  const groupThreads = [
    ...participantThreads,
    ...journeyThreads.filter(t => !participantThreads.some(p => p.id === t.id)),
  ];

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
        (c.otherUserContext || '').toLowerCase().includes(q) ||
        (c.lastMessagePreview || '').toLowerCase().includes(q))
    : active;

  const buckets = { Elders: [], Helpers: [], Family: [] };
  for (const c of filtered) buckets[sectionOf(c)].push(c);
  const hasAnyConversation = active.length > 0 || groupThreads.length > 0;

  const groupRow = (t, i, arr) => (
    <button
      key={t.id}
      onClick={() => navigate(`/messages/${t.id}?channel=family`)}
      style={rowStyle(i === arr.length - 1)}
    >
      <span style={{
        width: '46px', height: '46px', borderRadius: '50%', flexShrink: 0,
        background: 'var(--blue-wash)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--blue-deep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>
          Family updates
        </span>
        <span style={{ display: 'block', fontSize: '14px', color: 'var(--ink-3)', marginTop: '2px' }}>
          {t.title} — everyone reads the same notes
        </span>
      </span>
    </button>
  );

  const convRow = (c, i, arr) => {
    const trustLabel = TRUST_LABELS[c.currentTrustLevel];
    return (
      <button
        key={c.id}
        onClick={() => navigate(`/messages/${c.id}`)}
        style={{ ...rowStyle(i === arr.length - 1), transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-wash)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <Avatar name={c.otherUserName} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
            {/* flexWrap: on narrow screens the trust pill drops under the name
                instead of squeezing it. */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px 8px', minWidth: 0, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '16px', fontWeight: c.unreadCount > 0 ? 700 : 600,
                color: 'var(--ink)', fontFamily: SF,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {c.otherUserName || 'User'}
                {/* A helper sees whose family this person is: "Sarah (Margaret's family)". */}
                {c.otherUserContext && (
                  <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}> ({c.otherUserContext})</span>
                )}
              </span>
              {trustLabel && (
                <span className="inbox-trust-pill" style={{
                  fontSize: '13px', fontWeight: 600, fontFamily: SFText,
                  color: 'var(--blue-deep)', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: '9999px',
                  padding: '1px 8px', whiteSpace: 'nowrap', flexShrink: 0,
                  letterSpacing: '0.1px',
                }}>
                  {trustLabel}
                </span>
              )}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)', flexShrink: 0, fontFamily: SFText }}>
              {timeAgo(c.lastMessageAt)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <p style={{
              fontSize: '14px', margin: 0,
              color: c.unreadCount > 0 ? 'var(--ink)' : 'var(--ink-3)',
              fontWeight: c.unreadCount > 0 ? 500 : 400,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {c.lastMessagePreview || 'No messages yet'}
            </p>
            {c.unreadCount > 0 && (
              <span style={{
                background: 'var(--action-fill)', color: 'var(--action-ink)',
                fontSize: '13px', fontWeight: 600, fontFamily: SFText,
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
    );
  };

  const renderSection = (title, rows, renderRow) => rows.length === 0 ? null : (
    <div key={title}>
      <h2 style={headingStyle}>{title}</h2>
      <div style={listCardStyle}>{rows.map((r, i) => renderRow(r, i, rows))}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>
      <NavBar />

      <BlurFade delay={1}>
        <div style={{
          background: 'linear-gradient(180deg, var(--blue-wash) 0%, var(--surface) 100%)',
          borderBottom: '1px solid var(--sky-line)',
          padding: 'clamp(28px, 6vw, 48px) 20px clamp(20px, 4vw, 32px)',
          textAlign: 'center',
        }}>
          <h1 style={{
            fontSize: 'clamp(28px, 7vw, 40px)',            fontWeight: 400,
            color: 'var(--ink)',
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.02em',
            marginBottom: '8px',
          }}>
            Messages
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--ink-slate-2)', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
            Your conversations with trusted connections.
          </p>
        </div>
      </BlurFade>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px 60px' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                background: 'var(--canvas)', borderRadius: '14px', height: '76px',
                animation: 'shimmer 1.5s ease-in-out infinite',
                border: '1px solid var(--border)',
              }} />
            ))}
          </div>
        )}

        {!loading && !hasAnyConversation && (
          <BlurFade delay={2}>
            <div style={{
              background: 'var(--canvas)',
              border: '1px solid var(--border)',
              borderRadius: '18px',
              padding: '56px 24px',
              textAlign: 'center',
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'var(--blue-wash)', margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px', fontFamily: SF }}>
                No conversations yet
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', marginBottom: '20px' }}>
                Connect with someone on your dashboard to start chatting.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  background: 'var(--action-fill)', color: 'var(--action-ink)', border: 'none',
                  borderRadius: '9999px', padding: '10px 22px',
                  fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: SFText, cursor: 'pointer',
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </BlurFade>
        )}

        {!loading && hasAnyConversation && (
          <>
            {/* Search */}
            <BlurFade delay={1}>
              <div style={{ position: 'relative', marginBottom: '18px' }}>
                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </span>
                <SmoothInput
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search conversations"
                  aria-label="Search conversations"
                  style={{
                    width: '100%', boxSizing: 'border-box', height: '48px',
                    border: '1.5px solid var(--border)', borderRadius: '9999px',
                    padding: '0 18px 0 44px', fontSize: '16px', fontFamily: SFText,
                    color: 'var(--ink)', background: 'var(--canvas)', outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--blue)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
              </div>
            </BlurFade>

            {/* Groups first, then one-to-one chats grouped by who they're with. */}
            {renderSection('Groups', q ? [] : groupThreads, groupRow)}
            {SECTION_ORDER.map(name => renderSection(name, buckets[name], convRow))}

            {q && filtered.length === 0 && (
              <div style={{
                background: 'var(--canvas)', border: '1px solid var(--border)',
                borderRadius: '18px', padding: '40px 24px', textAlign: 'center',
              }}>
                <p style={{ fontSize: '16px', color: 'var(--ink-3)', margin: 0 }}>
                  No conversations match “{query.trim()}”.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

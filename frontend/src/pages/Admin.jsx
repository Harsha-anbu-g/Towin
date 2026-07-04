import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Users as UsersIcon, ShieldCheck, Flag, Star, Database, MessageSquare,
  Search, LogOut, RefreshCw,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import SegmentedTabs from '../components/SegmentedTabs';
import api from '../api/axios';
import SmoothInput from '../components/SmoothInput';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

// Section nav — each entry is one screen of the console.
const NAV = [
  { id: 'Users', label: 'Users', icon: UsersIcon, blurb: 'Every account on ToWin. Search, suspend, or remove.' },
  { id: 'Verifications', label: 'Verifications', icon: ShieldCheck, blurb: 'People waiting for their ID check.' },
  { id: 'Reports', label: 'Reports', icon: Flag, blurb: 'Things people flagged. Look at these first.' },
  { id: 'Reviews', label: 'Reviews', icon: Star, blurb: 'What people said after helping each other.' },
  { id: 'Data', label: 'Data', icon: Database, blurb: 'Raw records: connections, needs, and messages.' },
  { id: 'Feedback', label: 'Feedback', icon: MessageSquare, blurb: 'Ratings and notes from the feedback form.' },
];

const DATA_TABS = ['Connections', 'Needs', 'Messages'];

function ConfirmButton({ label, style, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span style={{ display: 'flex', gap: '4px' }}>
        <button onClick={() => { onConfirm(); setConfirming(false); }}
          style={{ fontSize: 'var(--text-xs)', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontFamily: SFText }}>
          Sure?
        </button>
        <button onClick={() => setConfirming(false)}
          style={{ fontSize: 'var(--text-xs)', background: 'var(--border)', color: 'var(--ink)', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontFamily: SFText }}>
          No
        </button>
      </span>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} style={style}>{label}</button>
  );
}

const actionBtn = (color, bg) => ({
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color,
  background: bg,
  border: 'none',
  borderRadius: '6px',
  padding: '5px 10px',
  cursor: 'pointer',
  fontFamily: SFText,
});

const redBtn = actionBtn('#cc0000', 'rgba(204,0,0,0.08)');
const greenBtn = actionBtn('#3D8AB0', 'rgba(79,163,206,0.10)');
const yellowBtn = actionBtn('#b45309', 'rgba(245,158,11,0.1)');
const grayBtn = actionBtn('#7a7a7a', 'rgba(160,160,165,0.1)');

const roleBadge = (role) => {
  const colors = { ADMIN: ['#3D8B5A', 'rgba(61,139,90,0.12)'], ELDER: ['#4FA3CE', 'rgba(0,102,204,0.1)'], HELPER: ['#3D8AB0', 'rgba(79,163,206,0.10)'], BOTH: ['#f59e0b', 'rgba(245,158,11,0.1)'] };
  const [c, bg] = colors[role] || ['#7a7a7a', 'rgba(160,160,165,0.1)'];
  return (
    <span style={{ fontSize: '12px', fontWeight: 600, color: c, background: bg, padding: '3px 8px', borderRadius: '9999px' }}>
      {role}
    </span>
  );
};

const statusBadge = (active) => (
  <span style={{
    fontSize: '12px',
    fontWeight: 600,
    color: active ? '#3D8AB0' : '#cc0000',
    background: active ? 'rgba(79,163,206,0.10)' : 'rgba(204,0,0,0.1)',
    padding: '3px 8px',
    borderRadius: '9999px',
  }}>
    {active ? 'Active' : 'Suspended'}
  </span>
);

const trustColor = (score) => {
  if (score >= 80) return '#3D8AB0';
  if (score >= 50) return '#4FA3CE';
  if (score >= 30) return '#f59e0b';
  return '#cc0000';
};

const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--ink-4)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  fontFamily: SFText,
  borderBottom: '1px solid #e0e0e0',
  background: 'var(--surface-pearl)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '14px 16px',
  fontSize: 'var(--text-sm)',
  color: 'var(--ink)',
  fontFamily: SFText,
  borderBottom: '1px solid #f5f5f7',
  verticalAlign: 'middle',
};

const card = {
  background: '#ffffff',
  borderRadius: '18px',
  border: '1px solid #e0e0e0',
  overflow: 'hidden',
};

// ——— Shared table states ———

function SkeletonRows() {
  return (
    <div style={{ padding: '24px 20px' }} aria-hidden="true">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="admin-skel" style={{
          height: '15px', borderRadius: '8px', background: '#f5f5f7',
          marginBottom: i === 4 ? 0 : '16px', width: `${92 - i * 8}%`,
          animation: 'adminPulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.08}s`,
        }} />
      ))}
    </div>
  );
}

function EmptyBlock({ icon: Icon, text }) {
  return (
    <div style={{ padding: '56px 24px', textAlign: 'center' }}>
      <div style={{
        width: '52px', height: '52px', borderRadius: '50%', background: 'var(--blue-wash)',
        margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={22} color="#4FA3CE" strokeWidth={1.8} />
      </div>
      <p style={{ fontSize: '15px', color: 'var(--ink-slate)', margin: 0, fontFamily: SFText }}>{text}</p>
    </div>
  );
}

function ErrorBlock({ onRetry }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: '15px', color: 'var(--ink-slate)', margin: '0 0 16px', fontFamily: SFText }}>
        Could not load this. Please try again.
      </p>
      <button onClick={onRetry} style={{
        background: '#4FA3CE', color: '#ffffff', border: 'none', borderRadius: '9999px',
        padding: '9px 22px', fontSize: '14px', fontWeight: 600, fontFamily: SFText, cursor: 'pointer',
      }}>
        Try again
      </button>
    </div>
  );
}

// Table zone: skeleton while loading, retry on error, friendly empty state,
// otherwise a real table inside its own horizontal-scroll wrapper.
function TableZone({ headers, minWidth = 640, loading, error, onRetry, empty, emptyIcon, emptyText, children }) {
  if (loading) return <SkeletonRows />;
  if (error && empty) return <ErrorBlock onRetry={onRetry} />;
  if (empty) return <EmptyBlock icon={emptyIcon} text={emptyText} />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="admin-tbl" style={{ width: '100%', minWidth: `${minWidth}px`, borderCollapse: 'collapse', fontFamily: SFText }}>
        <thead>
          <tr>{headers.map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ——— Feedback ———

const RATING_LABELS = [
  { key: 'ratingIdea', label: 'Idea' },
  { key: 'ratingUi', label: 'UI' },
  { key: 'ratingTheme', label: 'Theme' },
  { key: 'ratingSecurity', label: 'Security' },
  { key: 'ratingEaseOfUse', label: 'Ease of use' },
  { key: 'ratingPerformance', label: 'Speed' },
  { key: 'ratingOverall', label: 'Overall' },
];

function avgRating(rows, key) {
  const vals = rows.map(r => r[key]).filter(v => v != null);
  if (!vals.length) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

function FeedbackTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function load() {
    setLoading(true);
    setError(false);
    api.get('/admin/feedback')
      .then(({ data }) => setRows(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      {!loading && !error && rows.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '20px',
          background: '#ffffff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e0e0e0',
        }}>
          {RATING_LABELS.map(({ key, label }) => {
            const a = avgRating(rows, key);
            return (
              <div key={key} style={{ textAlign: 'center', minWidth: '72px' }}>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--blue)', fontFamily: SF, fontVariantNumeric: 'tabular-nums' }}>
                  {a ?? '—'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ink-3)', fontFamily: SFText }}>{label}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={card}>
        <TableZone
          headers={['Date', 'Name', 'Email', 'Phone', ...RATING_LABELS.map(r => r.label), 'Message']}
          minWidth={980}
          loading={loading}
          error={error}
          onRetry={load}
          empty={rows.length === 0}
          emptyIcon={MessageSquare}
          emptyText="No feedback yet."
        >
          {rows.map(r => (
            <tr key={r.id}>
              <td style={{ ...tdStyle, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                {new Date(r.createdAt).toLocaleDateString()}
              </td>
              <td style={tdStyle}>{r.name ?? '—'}</td>
              <td style={tdStyle}>{r.email ?? '—'}</td>
              <td style={tdStyle}>{r.phone ?? '—'}</td>
              {RATING_LABELS.map(({ key }) => (
                <td key={key} style={{ ...tdStyle, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                  {r[key] != null ? <>{r[key]} <span style={{ color: '#f59e0b' }}>★</span></> : '—'}
                </td>
              ))}
              <td style={{ ...tdStyle, maxWidth: '240px' }}>{r.message}</td>
            </tr>
          ))}
        </TableZone>
      </div>
    </div>
  );
}

export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [narrow, setNarrow] = useState(window.innerWidth <= 1024);
  const [tab, setTab] = useState('Users');
  const [dataTab, setDataTab] = useState('Connections');
  const [search, setSearch] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [demoReset, setDemoReset] = useState('idle'); // idle | working | done | failed

  const [users, setUsers] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [reports, setReports] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [safetyOnly, setSafetyOnly] = useState(false);
  const [userPage, setUserPage] = useState(0);
  const [connections, setConnections] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [messages, setMessages] = useState([]);

  // One loading/error pair for whatever view is on screen.
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const booted = useRef(false);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load users + verifications + reports together so the overview numbers
  // and the nav badges are right from the first paint.
  useEffect(() => {
    (async () => {
      setBusy(true);
      setFailed(false);
      try {
        const [u, v, r] = await Promise.all([
          api.get('/admin/users'),
          api.get('/admin/verifications'),
          api.get('/admin/reports'),
        ]);
        setUsers(u.data);
        setVerifications(v.data);
        setReports(r.data);
      } catch {
        setFailed(true);
      }
      setBusy(false);
    })();
  }, []);

  useEffect(() => {
    if (!booted.current) { booted.current = true; return; }
    fetchTab(tab);
  }, [tab]);
  useEffect(() => { if (tab === 'Reviews') fetchReviews(); }, [safetyOnly]);
  useEffect(() => { if (tab === 'Data') fetchDataTab(dataTab); }, [dataTab]);

  async function guarded(hasRows, work) {
    setFailed(false);
    if (!hasRows) setBusy(true);
    try {
      await work();
    } catch {
      setFailed(true);
    }
    setBusy(false);
  }

  function fetchTab(t) {
    if (t === 'Users') return guarded(users.length > 0, async () => { const r = await api.get('/admin/users'); setUsers(r.data); });
    if (t === 'Verifications') return guarded(verifications.length > 0, async () => { const r = await api.get('/admin/verifications'); setVerifications(r.data); });
    if (t === 'Reports') return guarded(reports.length > 0, async () => { const r = await api.get('/admin/reports'); setReports(r.data); });
    if (t === 'Reviews') return fetchReviews();
    if (t === 'Data') return fetchDataTab(dataTab);
    if (t === 'Feedback') { setBusy(false); setFailed(false); }
  }

  function fetchReviews() {
    return guarded(false, async () => {
      const r = await api.get(`/admin/reviews?safetyOnly=${safetyOnly}`);
      setReviews(r.data);
    });
  }

  function fetchDataTab(dt) {
    if (dt === 'Connections') return guarded(connections.length > 0, async () => { const r = await api.get('/admin/connections'); setConnections(r.data); });
    if (dt === 'Needs') return guarded(needs.length > 0, async () => { const r = await api.get('/admin/needs'); setNeeds(r.data); });
    if (dt === 'Messages') return guarded(messages.length > 0, async () => { const r = await api.get('/admin/messages'); setMessages(r.data); });
  }

  // Puts the demo accounts back to their seeded baseline (removes any
  // connection/trust built between Margaret and Harsha while recording).
  async function resetDemo() {
    if (demoReset === 'working') return;
    setDemoReset('working');
    try {
      await api.post('/admin/demo/reset');
      await fetchTab(tab);
      setDemoReset('done');
    } catch {
      setDemoReset('failed');
    }
    setTimeout(() => setDemoReset('idle'), 3000);
  }

  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.email?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q);
  });

  // /admin/users returns the full list, so paging is client-side
  const USERS_PER_PAGE = 20;
  const userPageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const clampedPage = Math.min(userPage, userPageCount - 1);
  const pagedUsers = filteredUsers.slice(clampedPage * USERS_PER_PAGE, (clampedPage + 1) * USERS_PER_PAGE);
  const rangeStart = filteredUsers.length === 0 ? 0 : clampedPage * USERS_PER_PAGE + 1;
  const rangeEnd = Math.min(filteredUsers.length, (clampedPage + 1) * USERS_PER_PAGE);

  const statsData = [
    { label: 'Users', value: users.length },
    { label: 'Active elders', value: users.filter(u => (u.role === 'ELDER' || u.role === 'BOTH') && u.isActive).length },
    { label: 'Active helpers', value: users.filter(u => (u.role === 'HELPER' || u.role === 'BOTH') && u.isActive).length },
    { label: 'Open reports', value: reports.length },
    { label: 'Waiting ID checks', value: verifications.length },
    { label: 'Average trust', value: users.length ? Math.round(users.reduce((s, u) => s + (u.trustScore || 0), 0) / users.length) : '—' },
  ];

  const active = NAV.find(n => n.id === tab);
  const safetyCount = safetyOnly ? reviews.length : reviews.filter(r => r.safetyConcern).length;

  const navBadge = (id) => {
    if (id === 'Reports' && reports.length > 0) {
      return (
        <span style={{
          minWidth: '20px', padding: '1px 7px', borderRadius: '9999px', textAlign: 'center',
          fontSize: '12px', fontWeight: 700, color: '#ffffff', background: 'var(--red)',
        }}>
          {reports.length}
        </span>
      );
    }
    if (id === 'Verifications' && verifications.length > 0) {
      return (
        <span style={{
          minWidth: '20px', padding: '1px 7px', borderRadius: '9999px', textAlign: 'center',
          fontSize: '12px', fontWeight: 700, color: '#2E7DA6', background: 'var(--blue-tint)',
        }}>
          {verifications.length}
        </span>
      );
    }
    return null;
  };

  const brand = (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      fontSize: '20px', fontWeight: 600, fontFamily: SF, letterSpacing: '-0.374px',
      color: 'var(--green-deep)',
    }}>
      <img src="/logo.png" alt="ToWin logo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
      ToWin
      <span style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
        color: '#2E7DA6', background: 'var(--blue-tint)', borderRadius: '9999px', padding: '3px 9px',
        fontFamily: SFText,
      }}>
        Admin
      </span>
    </span>
  );

  const demoResetLabel = {
    idle: 'Demo reset',
    working: 'Resetting demo…',
    done: 'Demo is fresh ✓',
    failed: 'Reset failed — try again',
  }[demoReset];

  const demoResetBtnStyle = (full) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
    width: full ? '100%' : 'auto',
    fontSize: '14px', fontWeight: 500, fontFamily: SFText,
    color: demoReset === 'failed' ? 'var(--red)' : '#5a6b75',
    background: '#ffffff', border: '1px solid #DCEBF4',
    borderRadius: '9999px', padding: '9px 16px',
    cursor: demoReset === 'working' ? 'wait' : 'pointer',
  });

  const navItem = (item) => {
    const isActive = tab === item.id;
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        onClick={() => setTab(item.id)}
        aria-current={isActive ? 'page' : undefined}
        className="admin-nav-item"
        style={{
          display: 'flex', alignItems: 'center', gap: '11px', width: '100%',
          padding: '11px 14px', borderRadius: '12px', border: 'none',
          background: isActive ? 'var(--blue-tint)' : 'transparent',
          color: isActive ? '#2E7DA6' : 'var(--ink-2)',
          fontSize: '15px', fontWeight: isActive ? 700 : 500, fontFamily: SFText,
          cursor: 'pointer', textAlign: 'left',
          transition: 'background 0.15s ease, color 0.15s ease',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f5f5f7'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{item.label}</span>
        {navBadge(item.id)}
      </button>
    );
  };

  const pill = (item) => {
    const isActive = tab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setTab(item.id)}
        aria-current={isActive ? 'page' : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px', flexShrink: 0,
          height: '42px', padding: '0 18px', borderRadius: '9999px',
          fontSize: '15px', fontWeight: isActive ? 700 : 500, fontFamily: SFText,
          color: isActive ? '#ffffff' : '#1d1d1f',
          background: isActive ? '#4FA3CE' : '#ffffff',
          border: isActive ? '1px solid #4FA3CE' : '1px solid #e0e0e0',
          boxShadow: isActive ? '0 2px 12px rgba(79,163,206,0.18)' : 'none',
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        {item.label}
        {item.id === 'Reports' && reports.length > 0 && (
          <span style={{
            fontSize: '12px', fontWeight: 700, color: '#ffffff', background: 'var(--red)',
            borderRadius: '9999px', padding: '1px 7px',
          }}>
            {reports.length}
          </span>
        )}
      </button>
    );
  };

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText, display: 'flex', flexDirection: narrow ? 'column' : 'row' }}>
      <style>{`
        .admin-tbl tbody tr { transition: background 0.12s ease; }
        .admin-tbl tbody tr:hover { background: #fafafc; }
        .admin-nav-scroll { scrollbar-width: none; }
        .admin-nav-scroll::-webkit-scrollbar { display: none; }
        @keyframes adminPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        @media (prefers-reduced-motion: reduce) { .admin-skel { animation: none !important; } }
      `}</style>

      {/* ——— Navigation: sidebar on desktop, top bar + pills on small screens ——— */}
      {narrow ? (
        <header style={{ background: '#ffffff', borderBottom: '1px solid #ececef', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '12px 16px' }}>
            {brand}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={resetDemo} disabled={demoReset === 'working'} style={demoResetBtnStyle(false)}>
                <RefreshCw size={14} strokeWidth={2} />
                {demoResetLabel}
              </button>
              <button
                onClick={() => setConfirmSignOut(true)}
                aria-label="Sign out"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '44px', height: '44px', borderRadius: '9999px',
                  background: '#ffffff', border: '1px solid #DCEBF4', color: '#5a6b75', cursor: 'pointer',
                }}
              >
                <LogOut size={17} strokeWidth={1.8} />
              </button>
            </div>
          </div>
          <nav className="admin-nav-scroll" aria-label="Admin sections" style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '2px 16px 12px' }}>
            {NAV.map(pill)}
          </nav>
        </header>
      ) : (
        <aside style={{
          width: '236px', flexShrink: 0, background: '#ffffff', borderRight: '1px solid #ececef',
          position: 'sticky', top: 0, height: '100svh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', padding: '22px 14px 18px',
        }}>
          <div style={{ padding: '0 8px 22px' }}>{brand}</div>

          <nav aria-label="Admin sections" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {NAV.map(navItem)}
          </nav>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '18px', borderTop: '1px solid #ececef' }}>
            <button onClick={resetDemo} disabled={demoReset === 'working'} style={demoResetBtnStyle(true)}>
              <RefreshCw size={14} strokeWidth={2} />
              {demoResetLabel}
            </button>
            <button
              onClick={() => setConfirmSignOut(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', width: '100%',
                fontSize: '14px', fontWeight: 500, fontFamily: SFText, color: '#5a6b75',
                background: 'transparent', border: 'none', borderRadius: '9999px',
                padding: '9px 16px', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f7'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <LogOut size={15} strokeWidth={1.8} />
              Sign out
            </button>
          </div>
        </aside>
      )}

      {/* ——— Main content ——— */}
      <main style={{ flex: 1, minWidth: 0, padding: narrow ? '20px 16px 48px' : '30px 36px 64px', maxWidth: '1200px' }}>

        <header style={{ marginBottom: '22px' }}>
          <h1 style={{
            fontSize: narrow ? 'var(--text-xl)' : 'var(--text-2xl)', fontWeight: 600, color: 'var(--ink)',
            fontFamily: SF, letterSpacing: '-0.6px', margin: '0 0 6px',
          }}>
            {active.label}
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--ink-slate)', margin: 0, lineHeight: 1.5 }}>
            {active.blurb}
          </p>
        </header>

        {/* Overview numbers — shown on the home (Users) section */}
        {tab === 'Users' && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px',
            marginBottom: '22px',
          }}>
            {statsData.map(stat => (
              <div key={stat.label} style={{
                background: '#ffffff',
                border: '1px solid #DCEBF4',
                borderRadius: '14px',
                padding: '16px 18px',
              }}>
                <p style={{ fontSize: '26px', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, letterSpacing: '-0.5px', lineHeight: 1, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {busy ? '—' : stat.value}
                </p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', fontWeight: 500, margin: '6px 0 0' }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Users */}
        {tab === 'Users' && (
          <div style={card}>
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid #e0e0e0',
              display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '9px',
                flex: '1 1 240px', maxWidth: '360px',
                border: '1.5px solid #e0e0e0', borderRadius: '9999px',
                padding: '8px 16px', background: 'var(--surface-pearl)',
              }}>
                <Search size={16} color="#a0a0a5" strokeWidth={2} style={{ flexShrink: 0 }} />
                <SmoothInput
                  value={search}
                  onChange={e => { setSearch(e.target.value); setUserPage(0); }}
                  placeholder="Search by email or username…"
                  aria-label="Search users"
                  wrapperStyle={{ flex: 1, minWidth: 0, width: 'auto' }}
                  style={{
                    width: '100%', border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 'var(--text-sm)', fontFamily: SFText, color: 'var(--ink)', padding: 0,
                  }}
                />
              </div>
              {!busy && (
                <span style={{ fontSize: '14px', color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
                  {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
                </span>
              )}
            </div>

            <TableZone
              headers={['User', 'Role', 'Trust score', 'Tier', 'Status', 'Verified', 'Joined', 'Actions']}
              minWidth={860}
              loading={busy}
              error={failed}
              onRetry={() => fetchTab('Users')}
              empty={filteredUsers.length === 0}
              emptyIcon={search ? Search : UsersIcon}
              emptyText={search ? 'No one matches your search.' : 'No users yet.'}
            >
              {pagedUsers.map(u => {
                const lowTrust = (u.trustScore || 0) < 20;
                return (
                  <tr key={u.id} style={lowTrust ? { background: 'rgba(204,0,0,0.03)' } : undefined}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: lowTrust ? 'rgba(204,0,0,0.15)' : 'rgba(0,102,204,0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 600,
                          color: lowTrust ? '#cc0000' : '#4FA3CE',
                          flexShrink: 0,
                        }}>
                          {u.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '14px', color: 'var(--ink)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.email}
                          </span>
                          {u.username && (
                            <span
                              title="Click to copy username"
                              onClick={() => navigator.clipboard?.writeText(u.username)}
                              style={{ fontSize: '12px', color: 'var(--ink-4)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                              @{u.username}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>{roleBadge(u.role)}</td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: trustColor(u.trustScore || 0), fontSize: '16px', fontVariantNumeric: 'tabular-nums' }}>
                        {u.trustScore ?? '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', fontWeight: 500 }}>{u.trustTier || '—'}</span>
                    </td>
                    <td style={tdStyle}>{statusBadge(u.isActive)}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>{u.verificationStatus}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {u.isActive
                          ? <button onClick={() => api.put(`/admin/users/${u.id}/suspend`).then(() => fetchTab('Users'))} style={yellowBtn}>Suspend</button>
                          : <button onClick={() => api.put(`/admin/users/${u.id}/unsuspend`).then(() => fetchTab('Users'))} style={greenBtn}>Unsuspend</button>
                        }
                        {u.photoUrl && (
                          <ConfirmButton label="Remove photo" style={grayBtn}
                            onConfirm={() => api.delete(`/admin/users/${u.id}/photo`).then(() => fetchTab('Users'))} />
                        )}
                        <ConfirmButton label="Delete" style={redBtn}
                          onConfirm={() => api.delete(`/admin/users/${u.id}`).then(() => fetchTab('Users'))} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </TableZone>

            {!busy && !failed && filteredUsers.length > 0 && (
              <div style={{
                padding: '14px 20px', borderTop: '1px solid #e0e0e0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: '14px', color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
                  Showing {rangeStart}–{rangeEnd} of {filteredUsers.length}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
                    Page {clampedPage + 1} of {userPageCount}
                  </span>
                  <button
                    onClick={() => setUserPage(p => Math.max(0, p - 1))}
                    disabled={clampedPage === 0}
                    style={{
                      background: 'transparent',
                      color: clampedPage === 0 ? '#c8c8cd' : '#4FA3CE',
                      border: '1.5px solid #e0e0e0',
                      borderRadius: '9999px',
                      padding: '7px 18px',
                      fontSize: '14px',
                      fontWeight: 600,
                      fontFamily: SFText,
                      cursor: clampedPage === 0 ? 'default' : 'pointer',
                    }}>Prev</button>
                  <button
                    onClick={() => setUserPage(p => Math.min(userPageCount - 1, p + 1))}
                    disabled={clampedPage >= userPageCount - 1}
                    style={{
                      background: clampedPage >= userPageCount - 1 ? '#e0e0e0' : '#4FA3CE',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '7px 18px',
                      fontSize: '14px',
                      fontWeight: 600,
                      fontFamily: SFText,
                      cursor: clampedPage >= userPageCount - 1 ? 'default' : 'pointer',
                    }}>Next</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Verifications */}
        {tab === 'Verifications' && (
          <div style={card}>
            <TableZone
              headers={['Email', 'ID document', 'Submitted', 'Actions']}
              loading={busy}
              error={failed}
              onRetry={() => fetchTab('Verifications')}
              empty={verifications.length === 0}
              emptyIcon={ShieldCheck}
              emptyText="No one is waiting for an ID check."
            >
              {verifications.map(v => (
                <tr key={v.userId}>
                  <td style={tdStyle}>{v.email}</td>
                  <td style={tdStyle}>
                    {v.idDocumentUrl
                      ? <a href={v.idDocumentUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontSize: '14px', fontWeight: 600 }}>View document</a>
                      : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                  </td>
                  <td style={tdStyle}>{new Date(v.createdAt).toLocaleDateString()}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => api.put(`/admin/verifications/${v.userId}/approve`).then(() => fetchTab('Verifications'))} style={greenBtn}>
                        Approve
                      </button>
                      <ConfirmButton label="Reject" style={redBtn}
                        onConfirm={() => api.put(`/admin/verifications/${v.userId}/reject`).then(() => fetchTab('Verifications'))} />
                    </div>
                  </td>
                </tr>
              ))}
            </TableZone>
          </div>
        )}

        {/* Reports */}
        {tab === 'Reports' && (
          <div style={card}>
            <TableZone
              headers={['Reporter', 'Reported', 'Reason', 'Description', 'Date', 'Actions']}
              minWidth={760}
              loading={busy}
              error={failed}
              onRetry={() => fetchTab('Reports')}
              empty={reports.length === 0}
              emptyIcon={Flag}
              emptyText="No reports. All is calm."
            >
              {reports.map(r => (
                <tr key={r.id}>
                  <td style={tdStyle}>{r.reporterEmail}</td>
                  <td style={tdStyle}>{r.reportedEmail}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--red)', background: 'rgba(204,0,0,0.08)', padding: '3px 8px', borderRadius: '9999px' }}>
                      {r.reason}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.description}>
                    {r.description}
                  </td>
                  <td style={tdStyle}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td style={tdStyle}>
                    <ConfirmButton label="Delete" style={redBtn}
                      onConfirm={() => api.delete(`/admin/reports/${r.id}`).then(() => fetchTab('Reports'))} />
                  </td>
                </tr>
              ))}
            </TableZone>
          </div>
        )}

        {/* Reviews */}
        {tab === 'Reviews' && (
          <div>
            <div style={{ marginBottom: '18px' }}>
              <SegmentedTabs
                segments={[
                  { id: 'all', label: 'All reviews' },
                  { id: 'safety', label: 'Safety flags', color: '#cc0000', notify: true, count: safetyCount },
                ]}
                value={safetyOnly ? 'safety' : 'all'}
                onChange={id => setSafetyOnly(id === 'safety')}
              />
            </div>
            <div style={card}>
              <TableZone
                headers={['Reviewer', 'Reviewee', 'Rating', 'Tags', 'Safety', 'Date', 'Actions']}
                minWidth={760}
                loading={busy}
                error={failed}
                onRetry={fetchReviews}
                empty={reviews.length === 0}
                emptyIcon={Star}
                emptyText={safetyOnly ? 'No safety flags. All is calm.' : 'No reviews yet.'}
              >
                {reviews.map(r => (
                  <tr key={r.id} style={r.safetyConcern ? { background: 'rgba(204,0,0,0.03)' } : undefined}>
                    <td style={tdStyle}>{r.reviewerEmail}</td>
                    <td style={tdStyle}>{r.revieweeEmail}</td>
                    <td style={tdStyle}><span style={{ color: '#f59e0b' }}>{'★'.repeat(r.rating)}</span></td>
                    <td style={tdStyle}>{r.tags?.join(', ')}</td>
                    <td style={tdStyle}>
                      {r.safetyConcern
                        ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', fontWeight: 600 }}>Safety flag</span>
                        : <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)' }}>—</span>}
                    </td>
                    <td style={tdStyle}>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td style={tdStyle}>
                      <ConfirmButton label="Delete" style={redBtn}
                        onConfirm={() => api.delete(`/admin/reviews/${r.id}`).then(fetchReviews)} />
                    </td>
                  </tr>
                ))}
              </TableZone>
            </div>
          </div>
        )}

        {/* Feedback */}
        {tab === 'Feedback' && <FeedbackTab />}

        {/* Data */}
        {tab === 'Data' && (
          <div>
            <div style={{ marginBottom: '18px' }}>
              <SegmentedTabs
                segments={DATA_TABS.map(dt => ({ id: dt, label: dt }))}
                value={dataTab}
                onChange={setDataTab}
              />
            </div>

            {dataTab === 'Connections' && (
              <div style={card}>
                <TableZone
                  headers={['User A', 'User B', 'Trust level', 'Status', 'Created', 'Actions']}
                  minWidth={760}
                  loading={busy}
                  error={failed}
                  onRetry={() => fetchDataTab('Connections')}
                  empty={connections.length === 0}
                  emptyIcon={Database}
                  emptyText="No connections yet."
                >
                  {connections.map(c => (
                    <tr key={c.id}>
                      <td style={tdStyle}>{c.userAEmail}</td>
                      <td style={tdStyle}>{c.userBEmail}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--blue)', fontWeight: 600 }}>{c.trustLevel}</span>
                      </td>
                      <td style={tdStyle}>{c.status}</td>
                      <td style={tdStyle}>{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td style={tdStyle}>
                        <ConfirmButton label="Delete" style={redBtn}
                          onConfirm={() => api.delete(`/admin/connections/${c.id}`).then(() => fetchDataTab('Connections'))} />
                      </td>
                    </tr>
                  ))}
                </TableZone>
              </div>
            )}

            {dataTab === 'Needs' && (
              <div style={card}>
                <TableZone
                  headers={['Elder', 'Category', 'Status', 'Created', 'Actions']}
                  loading={busy}
                  error={failed}
                  onRetry={() => fetchDataTab('Needs')}
                  empty={needs.length === 0}
                  emptyIcon={Database}
                  emptyText="No needs yet."
                >
                  {needs.map(n => (
                    <tr key={n.id}>
                      <td style={tdStyle}>{n.elderEmail}</td>
                      <td style={tdStyle}>{n.category}</td>
                      <td style={tdStyle}>{n.status}</td>
                      <td style={tdStyle}>{new Date(n.createdAt).toLocaleDateString()}</td>
                      <td style={tdStyle}>
                        <ConfirmButton label="Delete" style={redBtn}
                          onConfirm={() => api.delete(`/admin/needs/${n.id}`).then(() => fetchDataTab('Needs'))} />
                      </td>
                    </tr>
                  ))}
                </TableZone>
              </div>
            )}

            {dataTab === 'Messages' && (
              <div style={card}>
                <TableZone
                  headers={['Sender', 'Content', 'Date', 'Actions']}
                  loading={busy}
                  error={failed}
                  onRetry={() => fetchDataTab('Messages')}
                  empty={messages.length === 0}
                  emptyIcon={Database}
                  emptyText="No messages yet."
                >
                  {messages.map(m => (
                    <tr key={m.id}>
                      <td style={tdStyle}>{m.senderEmail}</td>
                      <td style={{ ...tdStyle, maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.content}>
                        {m.content}
                      </td>
                      <td style={tdStyle}>{new Date(m.createdAt).toLocaleDateString()}</td>
                      <td style={tdStyle}>
                        <ConfirmButton label="Delete" style={redBtn}
                          onConfirm={() => api.delete(`/admin/messages/${m.id}`).then(() => fetchDataTab('Messages'))} />
                      </td>
                    </tr>
                  ))}
                </TableZone>
              </div>
            )}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out of the admin console?"
        message="You can sign back in any time with your admin account."
        confirmLabel="Sign Out"
        cancelLabel="Stay Signed In"
        onConfirm={() => { setConfirmSignOut(false); logout(); navigate('/login'); }}
        onCancel={() => setConfirmSignOut(false)}
      />
    </div>
  );
}

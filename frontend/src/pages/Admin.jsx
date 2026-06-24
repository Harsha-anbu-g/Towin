import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import api from '../api/axios';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const TABS = ['Users', 'Verifications', 'Reports', 'Reviews', 'Data', 'Feedback'];
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

const RATING_LABELS = [
  { key: 'ratingIdea', label: 'Idea' },
  { key: 'ratingUi', label: 'UI' },
  { key: 'ratingTheme', label: 'Theme' },
  { key: 'ratingSecurity', label: 'Security' },
  { key: 'ratingEaseOfUse', label: 'Ease' },
  { key: 'ratingPerformance', label: 'Perf' },
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

  useEffect(() => {
    api.get('/admin/feedback')
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ fontFamily: SFText, color: 'var(--ink-3)', padding: '24px' }}>Loading feedback…</p>;
  if (!rows.length) return <p style={{ fontFamily: SFText, color: 'var(--ink-3)', padding: '24px' }}>No feedback yet.</p>;

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '28px',
        background: '#fff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e0e0e0',
      }}>
        {RATING_LABELS.map(({ key, label }) => {
          const a = avgRating(rows, key);
          return (
            <div key={key} style={{ textAlign: 'center', minWidth: '72px' }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--blue)', fontFamily: SF }}>
                {a ?? '—'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ink-3)', fontFamily: SFText }}>{label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SFText, fontSize: '14px' }}>
          <thead>
            <tr style={{ background: 'var(--surface)', textAlign: 'left' }}>
              {['Date', 'Name', 'Email', 'Phone', ...RATING_LABELS.map(r => r.label), 'Message'].map(h => (
                <th key={h} style={{ padding: '10px 12px', color: 'var(--ink)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 12px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '10px 12px' }}>{r.name ?? '—'}</td>
                <td style={{ padding: '10px 12px' }}>{r.email ?? '—'}</td>
                <td style={{ padding: '10px 12px' }}>{r.phone ?? '—'}</td>
                {RATING_LABELS.map(({ key }) => (
                  <td key={key} style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {r[key] != null ? `${r[key]} ⭐` : '—'}
                  </td>
                ))}
                <td style={{ padding: '10px 12px', maxWidth: '240px', color: 'var(--ink)' }}>{r.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('Users');
  const [dataTab, setDataTab] = useState('Connections');
  const [search, setSearch] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const [users, setUsers] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [reports, setReports] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [safetyOnly, setSafetyOnly] = useState(false);
  const [userPage, setUserPage] = useState(0);
  const [connections, setConnections] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [messages, setMessages] = useState([]);

  useEffect(() => { fetchTab(tab); }, [tab]);
  useEffect(() => { if (tab === 'Reviews') fetchReviews(); }, [safetyOnly]);
  useEffect(() => { if (tab === 'Data') fetchDataTab(dataTab); }, [dataTab]);

  async function fetchTab(t) {
    if (t === 'Users') { const r = await api.get('/admin/users'); setUsers(r.data); }
    if (t === 'Verifications') { const r = await api.get('/admin/verifications'); setVerifications(r.data); }
    if (t === 'Reports') { const r = await api.get('/admin/reports'); setReports(r.data); }
    if (t === 'Reviews') fetchReviews();
    if (t === 'Data') fetchDataTab(dataTab);
  }

  async function fetchReviews() {
    const r = await api.get(`/admin/reviews?safetyOnly=${safetyOnly}`);
    setReviews(r.data);
  }

  async function fetchDataTab(dt) {
    if (dt === 'Connections') { const r = await api.get('/admin/connections'); setConnections(r.data); }
    if (dt === 'Needs') { const r = await api.get('/admin/needs'); setNeeds(r.data); }
    if (dt === 'Messages') { const r = await api.get('/admin/messages'); setMessages(r.data); }
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

  const statsData = [
    { label: 'Total Users', value: users.length },
    { label: 'Active Elders', value: users.filter(u => (u.role === 'ELDER' || u.role === 'BOTH') && u.isActive).length },
    { label: 'Active Helpers', value: users.filter(u => (u.role === 'HELPER' || u.role === 'BOTH') && u.isActive).length },
    { label: 'Reports', value: reports.length },
    { label: 'Verifications', value: verifications.length },
    { label: 'Avg Trust', value: users.length ? Math.round(users.reduce((s, u) => s + (u.trustScore || 0), 0) / users.length) : '—' },
  ];

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

  const subTabStyle = (active, accent = '#4FA3CE') => ({
    fontSize: 'var(--text-sm)',
    fontWeight: active ? 700 : 500,
    color: active ? '#ffffff' : '#1d1d1f',
    background: active ? accent : '#ffffff',
    border: active ? `1px solid ${accent}` : '1px solid #e0e0e0',
    borderRadius: '9999px',
    padding: '9px 20px',
    cursor: 'pointer',
    fontFamily: SFText,
    transition: 'all 0.15s',
  });

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>

      {/* Hero header — calm sky-blue, matches the rest of the app */}
      <div style={{
        background: 'linear-gradient(180deg, #EAF5FB 0%, #f5f5f7 100%)',
        borderBottom: '1px solid #DCEBF4',
        padding: '40px 24px 32px',
        textAlign: 'center',
        position: 'relative',
      }}>
        <button
          onClick={() => setConfirmSignOut(true)}
          style={{
            position: 'absolute', top: '20px', right: '24px',
            fontSize: '14px', color: '#5a6b75',
            background: '#ffffff', border: '1px solid #DCEBF4',
            borderRadius: '9999px', padding: '6px 16px',
            cursor: 'pointer', fontFamily: SFText, fontWeight: 500,
          }}
        >
          Sign out
        </button>

        <div style={{
          width: '60px', height: '60px', borderRadius: '16px',
          background: '#ffffff', border: '1px solid #BFD9EA',
          margin: '0 auto 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(79,163,206,0.15)',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
          </svg>
        </div>
        <h1 style={{
          fontSize: 'var(--text-3xl)', fontWeight: 600, color: 'var(--ink)',
          fontFamily: SF, letterSpacing: '-0.8px', marginBottom: '8px',
        }}>
          Admin
        </h1>
        <p style={{ fontSize: '16px', color: '#5a6b75', maxWidth: '460px', margin: '0 auto 28px', lineHeight: 1.5 }}>
          Care for the community: users, trust, and safety in one place.
        </p>

        {/* Stats — light, airy cards */}
        <div style={{
          maxWidth: '960px', margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px',
        }}>
          {statsData.map(stat => (
            <div key={stat.label} style={{
              background: '#ffffff',
              border: '1px solid #DCEBF4',
              borderRadius: '14px',
              padding: '16px 18px',
              textAlign: 'left',
            }}>
              <p style={{ fontSize: '26px', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, letterSpacing: '-0.5px', lineHeight: 1, margin: 0 }}>
                {stat.value}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', marginTop: '6px', fontWeight: 500, margin: '6px 0 0' }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 32px 64px' }}>

        {/* Prominent pill tab bar — matches elder/helper dashboards */}
        <div style={{
          display: 'flex', gap: '10px', flexWrap: 'wrap',
          marginBottom: '32px',
        }}>
          {TABS.map(t => {
            const active = tab === t;
            const hasBadge = t === 'Reports' && reports.length > 0;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: '1 1 auto', minWidth: '140px',
                  height: '64px', padding: '0 24px',
                  fontSize: '17px', letterSpacing: '-0.2px',
                  fontWeight: active ? 700 : 500,
                  color: active ? '#ffffff' : '#1d1d1f',
                  background: active ? '#4FA3CE' : '#ffffff',
                  border: active ? '1px solid #4FA3CE' : '1px solid #e0e0e0',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'background 0.18s ease, color 0.18s ease, border-color 0.18s ease',
                  whiteSpace: 'nowrap',
                  fontFamily: SFText,
                  boxShadow: active ? '0 2px 12px rgba(79,163,206,0.18)' : 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f5f5f7'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = '#ffffff'; }}
              >
                {t}
                {hasBadge && (
                  <span style={{
                    fontSize: '12px', fontWeight: 600,
                    color: '#ffffff', background: 'var(--red)',
                    borderRadius: '9999px', padding: '1px 8px',
                  }}>
                    {reports.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div>

        {/* Users tab */}
        {tab === 'Users' && (
          <div style={card}>
            {/* Search bar */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0' }}>
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setUserPage(0); }}
                placeholder="Search users by email or username…"
                style={{
                  width: '320px',
                  padding: '9px 16px',
                  borderRadius: '9999px',
                  border: '1.5px solid #e0e0e0',
                  fontSize: 'var(--text-sm)',
                  fontFamily: SFText,
                  color: 'var(--ink)',
                  outline: 'none',
                  background: 'var(--surface-pearl)',
                }}
              />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', display: 'block', overflowX: 'auto' }}>
              <thead>
                <tr>
                  {['User', 'Role', 'Trust Score', 'Tier', 'Status', 'Verified', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map(u => {
                  const lowTrust = (u.trustScore || 0) < 20;
                  return (
                    <tr key={u.id} style={{ background: lowTrust ? 'rgba(204,0,0,0.03)' : 'transparent' }}>
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
                        <span style={{ fontWeight: 600, color: trustColor(u.trustScore || 0), fontSize: '16px' }}>
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
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)' }}>
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
                            <ConfirmButton label="Del Photo" style={grayBtn}
                              onConfirm={() => api.delete(`/admin/users/${u.id}/photo`).then(() => fetchTab('Users'))} />
                          )}
                          <ConfirmButton label="Delete" style={redBtn}
                            onConfirm={() => api.delete(`/admin/users/${u.id}`).then(() => fetchTab('Users'))} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination controls */}
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', borderTop: '1px solid #e0e0e0' }}>
              <span style={{ fontSize: '14px', color: 'var(--ink-3)', fontFamily: SFText }}>
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

        {/* Verifications tab */}
        {tab === 'Verifications' && (
          <div style={card}>
            {verifications.length === 0 && (
              <p style={{ padding: '40px 24px', color: 'var(--ink-4)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
                No pending verifications.
              </p>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', display: 'block', overflowX: 'auto' }}>
              <thead>
                <tr>
                  {['Email', 'ID Document', 'Submitted', 'Actions'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {verifications.map(v => (
                  <tr key={v.userId}>
                    <td style={tdStyle}>{v.email}</td>
                    <td style={tdStyle}>
                      {v.idDocumentUrl
                        ? <a href={v.idDocumentUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontSize: '14px', fontWeight: 600 }}>View Document</a>
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
              </tbody>
            </table>
          </div>
        )}

        {/* Reports tab */}
        {tab === 'Reports' && (
          <div style={card}>
            {reports.length === 0 && (
              <p style={{ padding: '40px 24px', color: 'var(--ink-4)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
                No reports.
              </p>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', display: 'block', overflowX: 'auto' }}>
              <thead>
                <tr>
                  {['Reporter', 'Reported', 'Reason', 'Description', 'Date', 'Actions'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.reporterEmail}</td>
                    <td style={tdStyle}>{r.reportedEmail}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--red)', background: 'rgba(204,0,0,0.08)', padding: '3px 8px', borderRadius: '9999px' }}>
                        {r.reason}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.description}
                    </td>
                    <td style={tdStyle}>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td style={tdStyle}>
                      <ConfirmButton label="Delete" style={redBtn}
                        onConfirm={() => api.delete(`/admin/reports/${r.id}`).then(() => fetchTab('Reports'))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reviews tab */}
        {tab === 'Reviews' && (
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button onClick={() => setSafetyOnly(false)} style={subTabStyle(!safetyOnly)}>All Reviews</button>
              <button onClick={() => setSafetyOnly(true)} style={subTabStyle(safetyOnly, '#cc0000')}>Safety Flags</button>
            </div>
            <div style={card}>
              {reviews.length === 0 && (
                <p style={{ padding: '40px 24px', color: 'var(--ink-4)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>No reviews.</p>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse', display: 'block', overflowX: 'auto' }}>
                <thead>
                  <tr>
                    {['Reviewer', 'Reviewee', 'Rating', 'Tags', 'Safety', 'Date', 'Actions'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reviews.map(r => (
                    <tr key={r.id} style={{ background: r.safetyConcern ? 'rgba(204,0,0,0.03)' : 'transparent' }}>
                      <td style={tdStyle}>{r.reviewerEmail}</td>
                      <td style={tdStyle}>{r.revieweeEmail}</td>
                      <td style={tdStyle}><span style={{ color: '#f59e0b' }}>{'★'.repeat(r.rating)}</span></td>
                      <td style={tdStyle}>{r.tags?.join(', ')}</td>
                      <td style={tdStyle}>
                        {r.safetyConcern
                          ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', fontWeight: 600 }}>Safety Flag</span>
                          : <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)' }}>—</span>}
                      </td>
                      <td style={tdStyle}>{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td style={tdStyle}>
                        <ConfirmButton label="Delete" style={redBtn}
                          onConfirm={() => api.delete(`/admin/reviews/${r.id}`).then(fetchReviews)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Feedback tab */}
        {tab === 'Feedback' && <FeedbackTab />}

        {/* Data tab */}
        {tab === 'Data' && (
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {DATA_TABS.map(dt => (
                <button key={dt} onClick={() => setDataTab(dt)} style={subTabStyle(dataTab === dt)}>
                  {dt}
                </button>
              ))}
            </div>

            {dataTab === 'Connections' && (
              <div style={card}>
                <table style={{ width: '100%', borderCollapse: 'collapse', display: 'block', overflowX: 'auto' }}>
                  <thead>
                    <tr>
                      {['User A', 'User B', 'Trust Level', 'Status', 'Created', 'Actions'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
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
                  </tbody>
                </table>
              </div>
            )}

            {dataTab === 'Needs' && (
              <div style={card}>
                <table style={{ width: '100%', borderCollapse: 'collapse', display: 'block', overflowX: 'auto' }}>
                  <thead>
                    <tr>
                      {['Elder', 'Category', 'Status', 'Created', 'Actions'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
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
                  </tbody>
                </table>
              </div>
            )}

            {dataTab === 'Messages' && (
              <div style={card}>
                <table style={{ width: '100%', borderCollapse: 'collapse', display: 'block', overflowX: 'auto' }}>
                  <thead>
                    <tr>
                      {['Sender', 'Content', 'Date', 'Actions'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map(m => (
                      <tr key={m.id}>
                        <td style={tdStyle}>{m.senderEmail}</td>
                        <td style={{ ...tdStyle, maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.content}
                        </td>
                        <td style={tdStyle}>{new Date(m.createdAt).toLocaleDateString()}</td>
                        <td style={tdStyle}>
                          <ConfirmButton label="Delete" style={redBtn}
                            onConfirm={() => api.delete(`/admin/messages/${m.id}`).then(() => fetchDataTab('Messages'))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        </div>
      </div>

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

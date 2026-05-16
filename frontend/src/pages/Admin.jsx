import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const TABS = ['Users', 'Verifications', 'Reports', 'Reviews', 'Data'];
const DATA_TABS = ['Connections', 'Needs', 'Messages'];

function ConfirmButton({ label, style, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span style={{ display: 'flex', gap: '4px' }}>
        <button onClick={() => { onConfirm(); setConfirming(false); }}
          style={{ fontSize: '12px', background: '#cc0000', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontFamily: SFText }}>
          Sure?
        </button>
        <button onClick={() => setConfirming(false)}
          style={{ fontSize: '12px', background: '#e0e0e0', color: '#1d1d1f', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontFamily: SFText }}>
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
  fontSize: '12px',
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
const greenBtn = actionBtn('#1a7a3c', 'rgba(52,199,89,0.1)');
const yellowBtn = actionBtn('#b45309', 'rgba(245,158,11,0.1)');
const grayBtn = actionBtn('#7a7a7a', 'rgba(160,160,165,0.1)');

const roleBadge = (role) => {
  const colors = { ADMIN: ['#5856d6', 'rgba(88,86,214,0.1)'], ELDER: ['#0066cc', 'rgba(0,102,204,0.1)'], HELPER: ['#1a7a3c', 'rgba(52,199,89,0.1)'], BOTH: ['#f59e0b', 'rgba(245,158,11,0.1)'] };
  const [c, bg] = colors[role] || ['#7a7a7a', 'rgba(160,160,165,0.1)'];
  return (
    <span style={{ fontSize: '11px', fontWeight: 600, color: c, background: bg, padding: '3px 8px', borderRadius: '9999px' }}>
      {role}
    </span>
  );
};

const statusBadge = (active) => (
  <span style={{
    fontSize: '11px',
    fontWeight: 600,
    color: active ? '#1a7a3c' : '#cc0000',
    background: active ? 'rgba(52,199,89,0.1)' : 'rgba(204,0,0,0.1)',
    padding: '3px 8px',
    borderRadius: '9999px',
  }}>
    {active ? 'Active' : 'Suspended'}
  </span>
);

const trustColor = (score) => {
  if (score >= 80) return '#1a7a3c';
  if (score >= 50) return '#0066cc';
  if (score >= 30) return '#f59e0b';
  return '#cc0000';
};

export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('Users');
  const [dataTab, setDataTab] = useState('Connections');
  const [search, setSearch] = useState('');

  const [users, setUsers] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [reports, setReports] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [safetyOnly, setSafetyOnly] = useState(false);
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

  const filteredUsers = users.filter(u =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase())
  );

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
    fontSize: '11px',
    fontWeight: 700,
    color: '#a0a0a5',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontFamily: SFText,
    borderBottom: '1px solid #e0e0e0',
    background: '#fafafc',
  };

  const tdStyle = {
    padding: '14px 16px',
    fontSize: '14px',
    color: '#1d1d1f',
    fontFamily: SFText,
    borderBottom: '1px solid #f5f5f7',
    verticalAlign: 'middle',
  };

  const card = {
    background: '#ffffff',
    borderRadius: '18px',
    overflow: 'hidden',
  };

  return (
    <div style={{ minHeight: '100svh', background: '#f5f5f7', fontFamily: SFText }}>

      {/* Top nav */}
      <div style={{
        background: '#000000',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '52px',
      }}>
        <p style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', fontFamily: SF, letterSpacing: '-0.2px' }}>
          ToWin Admin
        </p>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          style={{
            fontSize: '13px',
            color: '#a0a0a5',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: SFText,
          }}
        >
          Sign out
        </button>
      </div>

      {/* Stats bar */}
      <div style={{
        background: '#1d1d1f',
        padding: '20px 32px',
        display: 'flex',
        gap: '12px',
        overflowX: 'auto',
      }}>
        {statsData.map(stat => (
          <div key={stat.label} style={{
            background: '#272729',
            borderRadius: '14px',
            padding: '14px 20px',
            minWidth: '120px',
            flexShrink: 0,
          }}>
            <p style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', fontFamily: SF, letterSpacing: '-0.5px', lineHeight: 1 }}>
              {stat.value}
            </p>
            <p style={{ fontSize: '12px', color: '#a0a0a5', marginTop: '4px', fontWeight: 500 }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #e0e0e0',
        padding: '0 32px',
        display: 'flex',
        gap: '4px',
      }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '14px 18px',
              fontSize: '14px',
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#0066cc' : '#7a7a7a',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid #0066cc' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: SFText,
              transition: 'color 0.15s',
            }}
          >
            {t}
            {t === 'Reports' && reports.length > 0 && (
              <span style={{
                marginLeft: '6px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#ffffff',
                background: '#cc0000',
                borderRadius: '9999px',
                padding: '1px 7px',
                verticalAlign: 'middle',
              }}>
                {reports.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Users tab */}
        {tab === 'Users' && (
          <div style={card}>
            {/* Search bar */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search users by email…"
                style={{
                  width: '320px',
                  padding: '9px 16px',
                  borderRadius: '9999px',
                  border: '1.5px solid #e0e0e0',
                  fontSize: '14px',
                  fontFamily: SFText,
                  color: '#1d1d1f',
                  outline: 'none',
                  background: '#fafafc',
                }}
              />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['User', 'Role', 'Trust Score', 'Tier', 'Status', 'Verified', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => {
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
                            fontSize: '13px',
                            fontWeight: 700,
                            color: lowTrust ? '#cc0000' : '#0066cc',
                            flexShrink: 0,
                          }}>
                            {u.email?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span style={{ fontSize: '13px', color: '#1d1d1f', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.email}
                          </span>
                        </div>
                      </td>
                      <td style={tdStyle}>{roleBadge(u.role)}</td>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 700, color: trustColor(u.trustScore || 0), fontSize: '15px' }}>
                          {u.trustScore ?? '—'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '12px', color: '#7a7a7a', fontWeight: 500 }}>{u.trustTier || '—'}</span>
                      </td>
                      <td style={tdStyle}>{statusBadge(u.isActive)}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '12px', color: '#7a7a7a' }}>{u.verificationStatus}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '12px', color: '#a0a0a5' }}>
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
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e0e0e0' }}>
              <button style={{
                background: 'transparent',
                color: '#0066cc',
                border: '1.5px solid #e0e0e0',
                borderRadius: '9999px',
                padding: '7px 18px',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: SFText,
                cursor: 'pointer',
              }}>Prev</button>
              <button style={{
                background: '#0066cc',
                color: '#ffffff',
                border: 'none',
                borderRadius: '9999px',
                padding: '7px 18px',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: SFText,
                cursor: 'pointer',
              }}>Next</button>
            </div>
          </div>
        )}

        {/* Verifications tab */}
        {tab === 'Verifications' && (
          <div style={card}>
            {verifications.length === 0 && (
              <p style={{ padding: '40px 24px', color: '#a0a0a5', fontSize: '14px', textAlign: 'center' }}>
                No pending verifications.
              </p>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                        ? <a href={v.idDocumentUrl} target="_blank" rel="noreferrer" style={{ color: '#0066cc', fontSize: '13px', fontWeight: 600 }}>View Document</a>
                        : <span style={{ color: '#a0a0a5' }}>—</span>}
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
              <p style={{ padding: '40px 24px', color: '#a0a0a5', fontSize: '14px', textAlign: 'center' }}>
                No reports.
              </p>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#cc0000', background: 'rgba(204,0,0,0.08)', padding: '3px 8px', borderRadius: '9999px' }}>
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
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <button
                onClick={() => setSafetyOnly(false)}
                style={{
                  fontSize: '14px',
                  fontWeight: !safetyOnly ? 600 : 400,
                  color: !safetyOnly ? '#0066cc' : '#7a7a7a',
                  background: !safetyOnly ? 'rgba(0,102,204,0.08)' : 'transparent',
                  border: '1.5px solid',
                  borderColor: !safetyOnly ? '#0066cc' : '#e0e0e0',
                  borderRadius: '9999px',
                  padding: '7px 18px',
                  cursor: 'pointer',
                  fontFamily: SFText,
                }}
              >
                All Reviews
              </button>
              <button
                onClick={() => setSafetyOnly(true)}
                style={{
                  fontSize: '14px',
                  fontWeight: safetyOnly ? 600 : 400,
                  color: safetyOnly ? '#cc0000' : '#7a7a7a',
                  background: safetyOnly ? 'rgba(204,0,0,0.08)' : 'transparent',
                  border: '1.5px solid',
                  borderColor: safetyOnly ? '#cc0000' : '#e0e0e0',
                  borderRadius: '9999px',
                  padding: '7px 18px',
                  cursor: 'pointer',
                  fontFamily: SFText,
                }}
              >
                Safety Flags
              </button>
            </div>
            <div style={card}>
              {reviews.length === 0 && (
                <p style={{ padding: '40px 24px', color: '#a0a0a5', fontSize: '14px', textAlign: 'center' }}>No reviews.</p>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                          ? <span style={{ fontSize: '12px', color: '#cc0000', fontWeight: 700 }}>⚠ Flag</span>
                          : <span style={{ fontSize: '12px', color: '#a0a0a5' }}>—</span>}
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

        {/* Data tab */}
        {tab === 'Data' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              {DATA_TABS.map(dt => (
                <button
                  key={dt}
                  onClick={() => setDataTab(dt)}
                  style={{
                    fontSize: '14px',
                    fontWeight: dataTab === dt ? 600 : 400,
                    color: dataTab === dt ? '#0066cc' : '#7a7a7a',
                    background: dataTab === dt ? 'rgba(0,102,204,0.08)' : 'transparent',
                    border: '1.5px solid',
                    borderColor: dataTab === dt ? '#0066cc' : '#e0e0e0',
                    borderRadius: '9999px',
                    padding: '7px 18px',
                    cursor: 'pointer',
                    fontFamily: SFText,
                  }}
                >
                  {dt}
                </button>
              ))}
            </div>

            {dataTab === 'Connections' && (
              <div style={card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                          <span style={{ fontSize: '12px', color: '#0066cc', fontWeight: 600 }}>{c.trustLevel}</span>
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
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
  );
}

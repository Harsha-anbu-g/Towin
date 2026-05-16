import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const TABS = ['Users', 'Verifications', 'Reports', 'Reviews', 'Data'];
const DATA_TABS = ['Connections', 'Needs', 'Messages'];

function ConfirmButton({ label, className, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex gap-1">
        <button onClick={() => { onConfirm(); setConfirming(false); }}
          className="text-xs bg-red-600 text-white px-2 py-1 rounded">Sure?</button>
        <button onClick={() => setConfirming(false)}
          className="text-xs bg-gray-300 px-2 py-1 rounded">No</button>
      </span>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} className={className}>{label}</button>
  );
}

export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('Users');
  const [dataTab, setDataTab] = useState('Connections');

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

  const btn = 'text-xs px-2 py-1 rounded';
  const red = `${btn} bg-red-100 text-red-700 hover:bg-red-200`;
  const green = `${btn} bg-green-100 text-green-700 hover:bg-green-200`;
  const yellow = `${btn} bg-yellow-100 text-yellow-700 hover:bg-yellow-200`;
  const gray = `${btn} bg-gray-100 text-gray-600 hover:bg-gray-200`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <h1 className="font-bold text-gray-800">ToWin Admin</h1>
        <button onClick={() => { logout(); navigate('/login'); }}
          className="text-xs text-gray-500 hover:text-red-500">Logout</button>
      </div>

      <div className="flex border-b bg-white px-6">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {tab === 'Users' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>{['Email','Role','Score','Tier','Active','Verified','Joined','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{u.role}</td>
                    <td className="px-4 py-3">{u.trustScore}</td>
                    <td className="px-4 py-3">{u.trustTier}</td>
                    <td className="px-4 py-3">{u.isActive ? '✅' : '🚫'}</td>
                    <td className="px-4 py-3">{u.verificationStatus}</td>
                    <td className="px-4 py-3">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {u.isActive
                          ? <button onClick={() => api.put(`/admin/users/${u.id}/suspend`).then(() => fetchTab('Users'))} className={yellow}>Suspend</button>
                          : <button onClick={() => api.put(`/admin/users/${u.id}/unsuspend`).then(() => fetchTab('Users'))} className={green}>Unsuspend</button>
                        }
                        {u.photoUrl && (
                          <ConfirmButton label="Del Photo" className={gray}
                            onConfirm={() => api.delete(`/admin/users/${u.id}/photo`).then(() => fetchTab('Users'))} />
                        )}
                        <ConfirmButton label="Delete" className={red}
                          onConfirm={() => api.delete(`/admin/users/${u.id}`).then(() => fetchTab('Users'))} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Verifications' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {verifications.length === 0 && <p className="px-6 py-8 text-gray-400 text-sm">No pending verifications.</p>}
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>{['Email','ID Document','Submitted','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {verifications.map(v => (
                  <tr key={v.userId}>
                    <td className="px-4 py-3">{v.email}</td>
                    <td className="px-4 py-3">
                      {v.idDocumentUrl
                        ? <a href={v.idDocumentUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline text-xs">View Document</a>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">{new Date(v.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 flex gap-1">
                      <button onClick={() => api.put(`/admin/verifications/${v.userId}/approve`).then(() => fetchTab('Verifications'))} className={green}>✓ Approve</button>
                      <ConfirmButton label="✗ Reject" className={red}
                        onConfirm={() => api.put(`/admin/verifications/${v.userId}/reject`).then(() => fetchTab('Verifications'))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Reports' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {reports.length === 0 && <p className="px-6 py-8 text-gray-400 text-sm">No reports.</p>}
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>{['Reporter','Reported','Reason','Description','Date','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">{r.reporterEmail}</td>
                    <td className="px-4 py-3">{r.reportedEmail}</td>
                    <td className="px-4 py-3">{r.reason}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{r.description}</td>
                    <td className="px-4 py-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <ConfirmButton label="Delete" className={red}
                        onConfirm={() => api.delete(`/admin/reports/${r.id}`).then(() => fetchTab('Reports'))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Reviews' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setSafetyOnly(false)} className={!safetyOnly ? 'text-sm font-medium text-indigo-600 border-b-2 border-indigo-600 pb-1' : 'text-sm text-gray-500'}>All Reviews</button>
              <button onClick={() => setSafetyOnly(true)} className={safetyOnly ? 'text-sm font-medium text-red-600 border-b-2 border-red-600 pb-1' : 'text-sm text-gray-500'}>⚠ Safety Flags</button>
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {reviews.length === 0 && <p className="px-6 py-8 text-gray-400 text-sm">No reviews.</p>}
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>{['Reviewer','Reviewee','Rating','Tags','Safety','Date','Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reviews.map(r => (
                    <tr key={r.id} className={r.safetyConcern ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3">{r.reviewerEmail}</td>
                      <td className="px-4 py-3">{r.revieweeEmail}</td>
                      <td className="px-4 py-3">{'★'.repeat(r.rating)}</td>
                      <td className="px-4 py-3">{r.tags?.join(', ')}</td>
                      <td className="px-4 py-3">{r.safetyConcern ? '⚠️' : '—'}</td>
                      <td className="px-4 py-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <ConfirmButton label="Delete" className={red}
                          onConfirm={() => api.delete(`/admin/reviews/${r.id}`).then(fetchReviews)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'Data' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {DATA_TABS.map(dt => (
                <button key={dt} onClick={() => setDataTab(dt)}
                  className={dataTab === dt ? 'text-sm font-medium text-indigo-600 border-b-2 border-indigo-600 pb-1' : 'text-sm text-gray-500'}>
                  {dt}
                </button>
              ))}
            </div>

            {dataTab === 'Connections' && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>{['User A','User B','Trust Level','Status','Created','Actions'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {connections.map(c => (
                      <tr key={c.id}>
                        <td className="px-4 py-3">{c.userAEmail}</td>
                        <td className="px-4 py-3">{c.userBEmail}</td>
                        <td className="px-4 py-3">{c.trustLevel}</td>
                        <td className="px-4 py-3">{c.status}</td>
                        <td className="px-4 py-3">{new Date(c.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <ConfirmButton label="Delete" className={red}
                            onConfirm={() => api.delete(`/admin/connections/${c.id}`).then(() => fetchDataTab('Connections'))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {dataTab === 'Needs' && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>{['Elder','Category','Status','Created','Actions'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {needs.map(n => (
                      <tr key={n.id}>
                        <td className="px-4 py-3">{n.elderEmail}</td>
                        <td className="px-4 py-3">{n.category}</td>
                        <td className="px-4 py-3">{n.status}</td>
                        <td className="px-4 py-3">{new Date(n.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <ConfirmButton label="Delete" className={red}
                            onConfirm={() => api.delete(`/admin/needs/${n.id}`).then(() => fetchDataTab('Needs'))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {dataTab === 'Messages' && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>{['Sender','Content','Date','Actions'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {messages.map(m => (
                      <tr key={m.id}>
                        <td className="px-4 py-3">{m.senderEmail}</td>
                        <td className="px-4 py-3 max-w-xs truncate">{m.content}</td>
                        <td className="px-4 py-3">{new Date(m.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <ConfirmButton label="Delete" className={red}
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

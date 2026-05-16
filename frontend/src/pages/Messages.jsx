import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function Messages() {
  const { connectionId } = useParams();
  const navigate = useNavigate();
  const myUserId = localStorage.getItem('userId');

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [otherName, setOtherName] = useState('');
  const [otherUserId, setOtherUserId] = useState(null);
  const [trustLevel, setTrustLevel] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reportForm, setReportForm] = useState({ reason: 'Inappropriate Behavior', description: '' });
  const [reporting, setReporting] = useState(false);
  const [reportMsg, setReportMsg] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    api.get('/connections').then(r => {
      const conn = r.data.find(c => c.id === connectionId);
      if (conn) {
        setOtherName(conn.otherUserName || 'User');
        setOtherUserId(conn.otherUserId);
        setTrustLevel(conn.currentTrustLevel);
      }
    }).catch(() => {});

    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [connectionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    try {
      const res = await api.get(`/messages/${connectionId}?sort=createdAt,asc&size=50`);
      setMessages(res.data.content ?? []);
      await api.post(`/messages/${connectionId}/seen`).catch(() => {});
    } catch {}
  }

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/messages/${connectionId}/send`, { content: text.trim() });
      setMessages(prev => [...prev, res.data]);
      setText('');
    } catch (err) {
      alert(err?.response?.data?.message || 'Could not send message.');
    } finally { setSending(false); }
  }

  async function submitReport(e) {
    e.preventDefault();
    if (!otherUserId) return;
    setReporting(true);
    setReportMsg('');
    try {
      await api.post('/reports', { reportedUserId: otherUserId, ...reportForm });
      setReportMsg('Report submitted. Thank you.');
      setReportForm({ reason: 'Inappropriate Behavior', description: '' });
    } catch (err) {
      setReportMsg(err?.response?.data?.message || 'Could not submit report.');
    } finally { setReporting(false); }
  }

  const fmtTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const TRUST_BANNERS = {
    PHONE_CALL: 'Ready for a phone call? Share your number when comfortable.',
    VIDEO_CALL:  'Time for a video call? Exchange details when ready.',
    VERIFIED:    'Both of you are verified. Trust is growing.',
    FIRST_MEET:  'Planning your first meet? Choose a public place.',
    TRUSTED:     'Fully trusted connection. Enjoy your friendship.',
  };

  return (
    <div style={{ minHeight: '100svh', background: '#f5f5f7', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #d2d2d7',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <button onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#6e6e73', lineHeight: 1, padding: '0 4px' }}>
          ←
        </button>
        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#d6e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: '#0066cc', flexShrink: 0 }}>
          {otherName ? otherName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'}
        </div>
        <p style={{ fontWeight: 500, fontSize: '17px', color: '#1d1d1f', flex: 1 }}>{otherName || 'Conversation'}</p>
        <button onClick={() => { setShowReport(r => !r); setReportMsg(''); }}
          style={{ fontSize: '13px', color: '#ff3b30', background: 'none', border: '1px solid #ffcdd2', borderRadius: '9999px', padding: '4px 12px', cursor: 'pointer' }}>
          Report
        </button>
      </header>

      {trustLevel && TRUST_BANNERS[trustLevel] && (
        <div style={{ background: '#d6e8ff', borderBottom: '1px solid #b3d1ff', padding: '8px 16px' }}>
          <p style={{ fontSize: '13px', color: '#004499' }}>{TRUST_BANNERS[trustLevel]}</p>
        </div>
      )}

      {showReport && (
        <div style={{ background: '#fff2f2', borderBottom: '1px solid #ffcdd2', padding: '16px' }}>
          <p style={{ fontSize: '14px', fontWeight: 500, color: '#c62828', marginBottom: '12px' }}>Report {otherName}</p>
          <form onSubmit={submitReport} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <select value={reportForm.reason} onChange={e => setReportForm(f => ({...f, reason: e.target.value}))}
              style={{ border: '1px solid #ffcdd2', borderRadius: '10px', padding: '8px 12px', fontSize: '14px', outline: 'none', background: '#fff' }}>
              <option>Inappropriate Behavior</option>
              <option>Spam</option>
              <option>Safety Concern</option>
              <option>Other</option>
            </select>
            <textarea value={reportForm.description} onChange={e => setReportForm(f => ({...f, description: e.target.value}))}
              placeholder="Describe what happened (optional)..." rows={2}
              style={{ border: '1px solid #ffcdd2', borderRadius: '10px', padding: '8px 12px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} />
            {reportMsg && <p style={{ fontSize: '13px', color: reportMsg.includes('Thank') ? '#155724' : '#c62828' }}>{reportMsg}</p>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={reporting}
                style={{ background: '#c62828', color: '#fff', border: 'none', borderRadius: '9999px', padding: '7px 16px', fontSize: '13px', cursor: 'pointer' }}>
                {reporting ? 'Submitting...' : 'Submit Report'}
              </button>
              <button type="button" onClick={() => setShowReport(false)}
                style={{ background: '#fff', color: '#6e6e73', border: '1px solid #d2d2d7', borderRadius: '9999px', padding: '7px 16px', fontSize: '13px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', color: '#86868b', fontSize: '14px', marginTop: '32px' }}>No messages yet. Say hello!</p>
        )}
        {messages.map(m => {
          const isMe = m.senderId === myUserId;
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '70%',
                padding: '10px 14px',
                borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: isMe ? '#0066cc' : '#fff',
                border: isMe ? 'none' : '1px solid #d2d2d7',
                color: isMe ? '#fff' : '#1d1d1f',
              }}>
                <p style={{ fontSize: '15px', lineHeight: 1.4 }}>{m.content}</p>
                <p style={{ fontSize: '11px', marginTop: '4px', color: isMe ? 'rgba(255,255,255,0.6)' : '#86868b' }}>
                  {fmtTime(m.createdAt)}
                  {isMe && m.seenAt && ' · Seen'}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} style={{
        background: '#fff',
        borderTop: '1px solid #d2d2d7',
        padding: '12px 16px',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Message..."
          style={{
            flex: 1,
            border: '1px solid #d2d2d7',
            borderRadius: '9999px',
            padding: '9px 16px',
            fontSize: '15px',
            outline: 'none',
            background: '#f5f5f7',
            color: '#1d1d1f',
          }}
        />
        <button type="submit" disabled={sending || !text.trim()}
          style={{
            background: text.trim() ? '#0066cc' : '#d2d2d7',
            color: '#fff',
            border: 'none',
            borderRadius: '9999px',
            padding: '9px 20px',
            fontSize: '15px',
            fontWeight: 500,
            cursor: text.trim() ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}>
          Send
        </button>
      </form>
    </div>
  );
}

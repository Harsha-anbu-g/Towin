import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import api from '../api/axios';

const unsplash = (id, w, h) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const TRUST_BANNERS = {
  PHONE_CALL: { text: 'Ready for a phone call? Share your number when comfortable.', bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
  VIDEO_CALL:  { text: 'Time for a video call? Exchange details when ready.',         bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
  VERIFIED:    { text: 'Both of you are verified. Trust is growing.',                  bg: '#faf5ff', border: '#e9d5ff', color: '#7c3aed' },
  FIRST_MEET:  { text: 'Planning your first meet? Choose a public place.',             bg: '#fff7ed', border: '#fed7aa', color: '#c2410c' },
  TRUSTED:     { text: 'Fully trusted connection. Enjoy your friendship.',             bg: '#f0fdf4', border: '#86efac', color: '#166534' },
};

const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

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

  /* Pick a deterministic avatar photo from the other user's id (no real photo) */
  const AVATAR_PHOTOS = [
    'photo-1544005313-94ddf0286df2',
    'photo-1507679799987-c73779587ccf',
    'photo-1559839734-2b71ea197ec2',
    'photo-1438761681033-6461ffad8d80',
    'photo-1534528741775-53994a69daeb',
  ];
  const avatarId = AVATAR_PHOTOS[connectionId?.charCodeAt(0) % AVATAR_PHOTOS.length] ?? AVATAR_PHOTOS[0];

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

  const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const banner = trustLevel ? TRUST_BANNERS[trustLevel] : null;

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: 'var(--canvas)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)',
          fontSize: '22px', lineHeight: 1, padding: '0 4px', display: 'flex', alignItems: 'center',
        }}>←</button>

        {/* Avatar with photo */}
        <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid var(--border)' }}>
          <LazyLoadImage
            src={unsplash(avatarId, 76, 76)}
            alt={otherName}
            effect="blur"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
          />
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: '15px', color: 'var(--ink)' }}>{otherName || 'Conversation'}</p>
          {trustLevel && <p style={{ fontSize: '12px', color: 'var(--ink-3)' }}>{trustLevel.replace(/_/g, ' ')}</p>}
        </div>

        <button onClick={() => { setShowReport(r => !r); setReportMsg(''); }}
          style={{
            fontSize: '12px', color: 'var(--red)', background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)', borderRadius: '9999px', padding: '5px 12px', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 600,
          }}>
          Report
        </button>
      </header>

      {/* Trust level banner */}
      {banner && (
        <div style={{ background: banner.bg, borderBottom: `1px solid ${banner.border}`, padding: '10px 20px' }}>
          <p style={{ fontSize: '13px', color: banner.color, fontWeight: 500 }}>{banner.text}</p>
        </div>
      )}

      {/* Report panel */}
      {showReport && (
        <div style={{ background: '#fff5f5', borderBottom: '1px solid #fecaca', padding: '16px 20px' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--red)', marginBottom: '12px' }}>Report {otherName}</p>
          <form onSubmit={submitReport} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <select value={reportForm.reason} onChange={e => setReportForm(f => ({ ...f, reason: e.target.value }))}
              className="field" style={{ borderColor: '#fecaca' }}>
              <option>Inappropriate Behavior</option>
              <option>Spam</option>
              <option>Safety Concern</option>
              <option>Other</option>
            </select>
            <textarea value={reportForm.description} onChange={e => setReportForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe what happened (optional)..." rows={2}
              className="field" style={{ borderColor: '#fecaca', resize: 'none' }} />
            {reportMsg && <p style={{ fontSize: '13px', color: reportMsg.includes('Thank') ? 'var(--green)' : 'var(--red)' }}>{reportMsg}</p>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={reporting} className="primary-btn"
                style={{ background: 'var(--red)', fontSize: '13px', padding: '7px 16px' }}>
                {reporting ? 'Submitting...' : 'Submit Report'}
              </button>
              <button type="button" onClick={() => setShowReport(false)} className="ghost-btn">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Messages list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '48px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden', margin: '0 auto 16px', border: '3px solid var(--border)' }}>
              <LazyLoadImage
                src={unsplash(avatarId, 144, 144)}
                alt={otherName}
                effect="blur"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
              />
            </div>
            <p style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)', marginBottom: '4px' }}>{otherName}</p>
            <p style={{ fontSize: '14px', color: 'var(--ink-3)' }}>No messages yet. Say hello!</p>
          </div>
        )}
        {messages.map(m => {
          const isMe = m.senderId === myUserId;
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '8px' }}>
              {!isMe && (
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                  <LazyLoadImage
                    src={unsplash(avatarId, 56, 56)}
                    alt=""
                    effect="blur"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
                  />
                </div>
              )}
              <div style={{
                maxWidth: '68%',
                padding: '10px 14px',
                borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: isMe ? 'var(--blue)' : 'var(--canvas)',
                border: isMe ? 'none' : '1px solid var(--border)',
                color: isMe ? '#fff' : 'var(--ink)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}>
                <p style={{ fontSize: '15px', lineHeight: 1.45 }}>{m.content}</p>
                <p style={{ fontSize: '11px', marginTop: '4px', color: isMe ? 'rgba(255,255,255,0.55)' : 'var(--ink-3)' }}>
                  {fmtTime(m.createdAt)}{isMe && m.seenAt && ' · Seen'}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={send} style={{
        background: 'var(--canvas)',
        borderTop: '1px solid var(--border)',
        padding: '12px 16px',
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
      }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Message…"
          className="field"
          style={{ flex: 1, borderRadius: '9999px', padding: '10px 18px' }}
        />
        <button type="submit" disabled={sending || !text.trim()}
          style={{
            background: text.trim() ? 'var(--blue)' : 'var(--border)',
            color: '#fff',
            border: 'none',
            borderRadius: '9999px',
            width: '40px', height: '40px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: text.trim() ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
            flexShrink: 0,
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const unsplash = (id, w, h) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const TRUST_LABELS = {
  DISCOVERED: 'Just Connected',
  MESSAGING: 'Messaging',
  PHONE_CALL: 'Phone Ready',
  VIDEO_CALL: 'Video Ready',
  VERIFIED: 'Verified',
  FIRST_MEET: 'Ready to Meet',
  TRUSTED: 'Fully Trusted',
};

const TRUST_BANNERS = {
  PHONE_CALL: { text: 'Ready for a phone call? Share your number when comfortable.', bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
  VIDEO_CALL:  { text: 'Time for a video call? Exchange details when ready.',         bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
  VERIFIED:    { text: 'Both of you are verified. Trust is growing.',                  bg: '#faf5ff', border: '#e9d5ff', color: '#7c3aed' },
  FIRST_MEET:  { text: 'Planning your first meet? Choose a public place.',             bg: '#fff7ed', border: '#fed7aa', color: '#c2410c' },
  TRUSTED:     { text: 'Fully trusted connection. Enjoy your friendship.',             bg: '#f0fdf4', border: '#86efac', color: '#166534' },
};

const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

export default function Messages() {
  const { connectionId } = useParams();
  const navigate = useNavigate();
  const myUserId = localStorage.getItem('userId');
  const { toast } = useToast();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [otherName, setOtherName] = useState('');
  const [otherUserId, setOtherUserId] = useState(null);
  const [trustLevel, setTrustLevel] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reportForm, setReportForm] = useState({ reason: 'Inappropriate Behavior', description: '' });
  const [reporting, setReporting] = useState(false);
  const [reportMsg, setReportMsg] = useState('');
  const bottomRef = useRef(null);

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
      setLoadError('');
      await api.post(`/messages/${connectionId}/seen`).catch(() => {});
    } catch (err) {
      const msg = err?.response?.data?.message || '';
      if (msg.toLowerCase().includes('trust')) {
        setLoadError('trust');
      }
    }
  }

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/messages/${connectionId}/send`, { content: text.trim() });
      setMessages(prev => [...prev, res.data]);
      setText('');
      setSent(true);
      setTimeout(() => setSent(false), 1200);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Message not sent. Tap to retry.');
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
    <div style={{
      minHeight: '100svh',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: SFText,
    }}>
      {/* Chat header — iMessage style */}
      <header style={{
        background: '#fafafc',
        borderBottom: '1px solid #e0e0e0',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#0066cc',
          fontSize: '15px',
          fontFamily: SFText,
          fontWeight: 500,
          padding: '0 4px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
            <path d="M8.5 1L1.5 8L8.5 15" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>

        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          border: '2px solid #e0e0e0',
        }}>
          <LazyLoadImage
            src={unsplash(avatarId, 88, 88)}
            alt={otherName}
            effect="blur"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
          />
        </div>

        <div style={{ flex: 1 }}>
          <p style={{
            fontWeight: 600,
            fontSize: '17px',
            color: '#1d1d1f',
            fontFamily: SF,
            letterSpacing: '-0.2px',
          }}>{otherName || 'Conversation'}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34c759' }} />
            <p style={{ fontSize: '12px', color: '#7a7a7a' }}>
              {trustLevel ? (TRUST_LABELS[trustLevel] || trustLevel.replace(/_/g, ' ')) : 'Online'}
            </p>
          </div>
        </div>

        <button
          onClick={() => { setShowReport(r => !r); setReportMsg(''); }}
          style={{
            fontSize: '13px',
            color: '#cc3333',
            background: 'rgba(204,51,51,0.08)',
            border: '1px solid rgba(204,51,51,0.2)',
            borderRadius: '9999px',
            padding: '6px 14px',
            cursor: 'pointer',
            fontFamily: SFText,
            fontWeight: 600,
          }}
        >
          Report
        </button>
      </header>

      {/* Trust level banner */}
      {banner && (
        <div style={{
          background: banner.bg,
          borderBottom: `1px solid ${banner.border}`,
          padding: '10px 20px',
        }}>
          <p style={{ fontSize: '13px', color: banner.color, fontWeight: 500, fontFamily: SFText }}>
            {banner.text}
          </p>
        </div>
      )}

      {/* Report panel */}
      {showReport && (
        <div style={{
          background: '#fff5f5',
          borderBottom: '1px solid #fecaca',
          padding: '16px 20px',
        }}>
          <p style={{ fontSize: '15px', fontWeight: 600, color: '#cc3333', marginBottom: '12px', fontFamily: SF }}>
            Report {otherName}
          </p>
          <form onSubmit={submitReport} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <select
              value={reportForm.reason}
              onChange={e => setReportForm(f => ({ ...f, reason: e.target.value }))}
              className="field"
              style={{ borderColor: '#fecaca' }}
            >
              <option>Inappropriate Behavior</option>
              <option>Spam</option>
              <option>Safety Concern</option>
              <option>Other</option>
            </select>
            <textarea
              value={reportForm.description}
              onChange={e => setReportForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe what happened (optional)..."
              rows={2}
              className="field"
              style={{ borderColor: '#fecaca', resize: 'none' }}
            />
            {reportMsg && (
              <p style={{ fontSize: '13px', color: reportMsg.includes('Thank') ? '#34c759' : '#cc3333' }}>
                {reportMsg}
              </p>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                disabled={reporting}
                className="primary-btn"
                style={{ background: '#cc3333', fontSize: '13px', padding: '7px 16px' }}
              >
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
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        background: '#ffffff',
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '64px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              overflow: 'hidden',
              margin: '0 auto 20px',
              border: '3px solid #e0e0e0',
            }}>
              <LazyLoadImage
                src={unsplash(avatarId, 160, 160)}
                alt={otherName}
                effect="blur"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
              />
            </div>
            <p style={{ fontWeight: 600, fontSize: '17px', color: '#1d1d1f', marginBottom: '6px', fontFamily: SF }}>
              {otherName}
            </p>
            {loadError !== 'trust' && (
              <p style={{ fontSize: '14px', color: '#a0a0a5' }}>No messages yet. Say hello to {otherName}! 👋</p>
            )}
          </div>
        )}

        {messages.map((m, idx) => {
          const isMe = m.senderId === myUserId;
          const prevMsg = messages[idx - 1];
          const showDateSep = !prevMsg || new Date(m.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

          return (
            <div key={m.id}>
              {showDateSep && (
                <div style={{ textAlign: 'center', margin: '16px 0 8px' }}>
                  <span style={{
                    fontSize: '12px',
                    color: '#a0a0a5',
                    fontFamily: SFText,
                    fontWeight: 500,
                  }}>
                    {new Date(m.createdAt).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}
              <div style={{
                display: 'flex',
                justifyContent: isMe ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
                gap: '8px',
                marginBottom: '2px',
              }}>
                {!isMe && (
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}>
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
                  background: isMe ? '#0066cc' : '#f0f0f5',
                  color: isMe ? '#ffffff' : '#1d1d1f',
                }}>
                  <p style={{ fontSize: '15px', lineHeight: 1.45, fontFamily: SFText }}>{m.content}</p>
                  <p style={{
                    fontSize: '11px',
                    marginTop: '4px',
                    color: isMe ? 'rgba(255,255,255,0.6)' : '#a0a0a5',
                  }}>
                    {fmtTime(m.createdAt)}{isMe && m.seenAt && ' · Seen'}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Trust-level lock notice */}
      {loadError === 'trust' && (
        <div style={{
          background: '#fef3c7', borderTop: '1px solid #fde68a',
          padding: '12px 20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '14px', color: '#92400e', fontFamily: SFText, margin: 0 }}>
            Messaging is locked. Both of you need to click <strong>Confirm Trust</strong> on the dashboard to unlock messages.
          </p>
        </div>
      )}

      {/* Trust badge strip if trust level set */}
      {trustLevel && (
        <div style={{
          background: '#f0f6ff',
          borderTop: '1px solid #e0e0e0',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#0066cc',
            background: '#0066cc',
            color: '#ffffff',
            padding: '4px 12px',
            borderRadius: '9999px',
          }}>
            Trust: {TRUST_LABELS[trustLevel] || trustLevel.replace(/_/g, ' ')}
          </div>
          <p style={{ fontSize: '12px', color: '#7a7a7a', fontFamily: SFText }}>
            Your connection level with {otherName}
          </p>
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={send} style={{
        background: '#fafafc',
        borderTop: '1px solid #e0e0e0',
        padding: '12px 16px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-end',
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (text.trim() && !sending) send(e);
              }
            }}
            placeholder={loadError === 'trust' ? 'Confirm trust on dashboard first…' : 'iMessage'}
            disabled={loadError === 'trust'}
            rows={2}
            className="field"
            style={{
              flex: 1,
              borderRadius: '18px',
              padding: '10px 18px',
              background: '#ffffff',
              border: '1.5px solid #e0e0e0',
              fontSize: '15px',
              fontFamily: SFText,
              color: '#1d1d1f',
              outline: 'none',
              resize: 'none',
            }}
          />
          <span style={{ fontSize: '11px', color: '#a0a0a5', marginTop: '4px', paddingLeft: '4px' }}>
            Enter to send · Shift+Enter for new line
          </span>
        </div>
        <button
          type="submit"
          disabled={sending || !text.trim() || loadError === 'trust'}
          style={{
            background: text.trim() && loadError !== 'trust' ? '#0066cc' : '#e0e0e0',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: text.trim() ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
            flexShrink: 0,
            marginBottom: '20px',
            fontSize: '16px',
          }}
        >
          {sent ? '✓' : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}

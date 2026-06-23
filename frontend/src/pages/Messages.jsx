import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

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
  PHONE_CALL: { text: 'Ready for a phone call? Share your number when comfortable.' },
  VIDEO_CALL:  { text: 'Time for a video call? Exchange details when ready.' },
  VERIFIED:    { text: 'Both of you are verified. Trust is growing.' },
  FIRST_MEET:  { text: 'Planning your first meet? Choose a public place.' },
  TRUSTED:     { text: 'Fully trusted connection. Enjoy your friendship.' },
};

const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

export default function Messages() {
  const { connectionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const myUserId = user?.userId;
  const { toast } = useToast();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [otherName, setOtherName] = useState('');
  const [otherUserId, setOtherUserId] = useState(null);
  const [otherPhotoUrl, setOtherPhotoUrl] = useState(null);
  const [otherTrustScore, setOtherTrustScore] = useState(null);
  const [trustLevel, setTrustLevel] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reportForm, setReportForm] = useState({ reason: 'Inappropriate Behavior', description: '' });
  const [reporting, setReporting] = useState(false);
  const [reportMsg, setReportMsg] = useState('');
  const bottomRef = useRef(null);
  const lastMsgIdRef = useRef(null);

  useEffect(() => {
    api.get('/connections').then(r => {
      const conn = r.data.find(c => c.id === connectionId);
      if (conn) {
        setOtherName(conn.otherUserName || 'User');
        setOtherUserId(conn.otherUserId);
        setTrustLevel(conn.currentTrustLevel);
        if (conn.otherUserId) {
          api.get(`/profile/${conn.otherUserId}`).then(p => {
            setOtherPhotoUrl(p.data.photoUrl || null);
            setOtherTrustScore(p.data.trustScore ?? null);
          }).catch(() => {});
        }
      }
    }).catch(() => {});
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [connectionId]);

  useEffect(() => {
    // Only auto-scroll when a genuinely new message arrives — never yank the
    // user back down on the 5-second poll while they're reading older messages.
    const newest = messages.length ? messages[messages.length - 1].id : null;
    if (newest && newest !== lastMsgIdRef.current) {
      lastMsgIdRef.current = newest;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  async function loadMessages() {
    try {
      // Ask for 50 messages; the newest-first backend returns the latest 50.
      // Sort by timestamp client-side so display is correct regardless of the
      // server's ordering (robust across the asc→desc backend change).
      const res = await api.get(`/messages/${connectionId}?size=50`);
      const ordered = (res.data.content ?? []).slice()
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setMessages(prev => {
        const prevLast = prev.length ? prev[prev.length - 1].id : null;
        const nextLast = ordered.length ? ordered[ordered.length - 1].id : null;
        // Skip the state update when nothing changed, so identical polls don't
        // re-render or retrigger effects.
        if (prev.length === ordered.length && prevLast === nextLast) return prev;
        return ordered;
      });
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
      height: '100svh',
      background: 'var(--surface-pearl)',
      display: 'flex',
      justifyContent: 'center',
      fontFamily: SFText,
    }}>
     <div style={{
      width: '100%',
      maxWidth: '860px',
      height: '100%',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid #e0e0e0',
      borderRight: '1px solid #e0e0e0',
     }}>
      {/* Chat header — iMessage style */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #ececef',
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
          color: 'var(--blue)',
          fontSize: '16px',
          fontFamily: SFText,
          fontWeight: 500,
          padding: '0 4px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
            <path d="M8.5 1L1.5 8L8.5 15" stroke="#4FA3CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>

        {/* Avatar — real photo or initials */}
        {otherPhotoUrl ? (
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid #e0e0e0' }}>
            <img src={otherPhotoUrl} alt={otherName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        ) : (
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#E6F2FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '16px', fontWeight: 700, color: '#2E7DA6', fontFamily: SF }}>
            {initials(otherName)}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)', fontFamily: SF, letterSpacing: '-0.2px', margin: 0 }}>
            {otherName || 'Conversation'}
          </p>
          {trustLevel && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '4px', background: '#E6F2FA', padding: '3px 10px', borderRadius: '9999px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#2E7DA6', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#2E7DA6' }}>
                {(TRUST_LABELS[trustLevel] || trustLevel.replace(/_/g, ' '))}{otherTrustScore != null ? ` · Trust ${otherTrustScore}` : ''}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => { setShowReport(r => !r); setReportMsg(''); }}
          style={{ fontSize: '14px', color: 'var(--ink-3)', background: 'transparent', border: '1px solid #e0e0e0', borderRadius: '9999px', padding: '6px 14px', cursor: 'pointer', fontFamily: SFText, fontWeight: 500 }}
        >
          Report
        </button>
      </header>

      {/* One consolidated trust hint (replaces the two stacked strips) */}
      {trustLevel && (
        <div style={{ background: '#F4FAFD', borderBottom: '1px solid #E2EEF5', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <p style={{ fontSize: '14px', color: '#5a6470', fontWeight: 500, fontFamily: SFText, margin: 0 }}>
            {banner ? banner.text : `You're at the ${TRUST_LABELS[trustLevel] || trustLevel.replace(/_/g, ' ')} stage with ${otherName}.`}
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
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#cc3333', marginBottom: '12px', fontFamily: SF }}>
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
              <p style={{ fontSize: '14px', color: reportMsg.includes('Thank') ? '#4FA3CE' : '#cc3333' }}>
                {reportMsg}
              </p>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                disabled={reporting}
                className="primary-btn"
                style={{ background: '#cc3333', fontSize: '14px', padding: '7px 16px' }}
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
            {otherPhotoUrl ? (
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', margin: '0 auto 20px', border: '1px solid #e0e0e0' }}>
                <img src={otherPhotoUrl} alt={otherName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            ) : (
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#e8e8ed', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px', fontWeight: 600, color: '#5a6470', fontFamily: SF }}>
                {initials(otherName)}
              </div>
            )}
            <p style={{ fontWeight: 600, fontSize: '17px', color: 'var(--ink)', marginBottom: '6px', fontFamily: SF }}>
              {otherName}
            </p>
            {loadError !== 'trust' && (
              <p style={{ fontSize: '15px', color: 'var(--ink-4)' }}>No messages yet. Send the first message to {otherName}.</p>
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
                    fontSize: '13px',
                    color: 'var(--ink-4)',
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
                  otherPhotoUrl ? (
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={otherPhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  ) : (
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#E6F2FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px', fontWeight: 700, color: '#2E7DA6', fontFamily: SF }}>
                      {initials(otherName)}
                    </div>
                  )
                )}
                <div style={{
                  maxWidth: '68%',
                  padding: '10px 14px',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isMe ? '#4FA3CE' : '#f0f0f5',
                  color: isMe ? '#ffffff' : '#1d1d1f',
                }}>
                  <p style={{ fontSize: '16px', lineHeight: 1.45, fontFamily: SFText }}>{m.content}</p>
                  <p style={{
                    fontSize: '12px',
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
          <p style={{ fontSize: '15px', color: '#92400e', fontFamily: SFText, margin: 0 }}>
            Messaging is locked. Both of you need to click <strong>Confirm Trust</strong> on the dashboard to unlock messages.
          </p>
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={send} style={{
        background: '#ffffff',
        borderTop: '1px solid #ececef',
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
            placeholder={loadError === 'trust' ? 'Confirm trust on dashboard first…' : 'Type a message…'}
            disabled={loadError === 'trust'}
            rows={2}
            className="field"
            style={{
              flex: 1,
              borderRadius: '18px',
              padding: '10px 18px',
              background: '#ffffff',
              border: '1.5px solid #e0e0e0',
              fontSize: '16px',
              fontFamily: SFText,
              color: 'var(--ink)',
              outline: 'none',
              resize: 'none',
            }}
          />
          <span style={{ fontSize: '12px', color: 'var(--ink-4)', marginTop: '4px', paddingLeft: '4px' }}>
            Enter to send · Shift+Enter for new line
          </span>
        </div>
        <button
          type="submit"
          disabled={sending || !text.trim() || loadError === 'trust'}
          title="Send message (Enter)"
          aria-label="Send message"
          style={{
            background: text.trim() && loadError !== 'trust' ? '#4FA3CE' : '#e0e0e0',
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
          {sent ? (
            <svg width="14" height="14" viewBox="0 0 12 10" fill="none">
              <path d="M1 5L4 8L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
            </svg>
          )}
        </button>
      </form>
     </div>
    </div>
  );
}

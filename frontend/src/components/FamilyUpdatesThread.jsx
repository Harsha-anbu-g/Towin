// Step 3: the shared FAMILY_UPDATES thread — one open feed per shared
// connection that the elder always sees. Reused by the helper card (US-003)
// and the family/elder views (US-004); only the words around it change.
import { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';

const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const POLL_MS = 5000; // same cadence as the MAIN chat

const initials = (name) =>
  name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

const fmtWhen = (iso) =>
  new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }) +
  ' · ' +
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function FamilyUpdatesThread({
  connectionId,
  placeholder,
  emptyText,
  sendLabel = 'Share note',
}) {
  const { user } = useAuth();
  const myUserId = user?.userId;
  const { toast } = useToast();

  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get(`/messages/${connectionId}?channel=FAMILY_UPDATES&size=50`);
        if (cancelled) return;
        const ordered = (res.data.content ?? []).slice()
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setNotes(prev => {
          const prevLast = prev.length ? prev[prev.length - 1].id : null;
          const nextLast = ordered.length ? ordered[ordered.length - 1].id : null;
          if (prev.length === ordered.length && prevLast === nextLast) return prev;
          return ordered;
        });
        setLoaded(true);
      } catch {
        // 409 = gate closed (e.g. share flipped off mid-session); keep quiet —
        // the parent gate hides this section on the next connections refresh.
      }
    }
    load();
    pollRef.current = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(pollRef.current); };
  }, [connectionId]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await api.post(
        `/messages/${connectionId}/send?channel=FAMILY_UPDATES`,
        { content: text.trim() },
      );
      setNotes(prev => [...prev, res.data]);
      setText('');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Note not sent. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {loaded && notes.length === 0 && (
        <p style={{ fontSize: '16px', color: 'var(--ink-slate)', fontFamily: SFText, margin: 0 }}>
          {emptyText}
        </p>
      )}

      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
          {notes.map((n) => {
            const isMe = n.senderId === myUserId;
            return (
              <div key={n.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                {n.senderPhotoUrl ? (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }} aria-hidden="true">
                    <img src={n.senderPhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--slate-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '13px', fontWeight: 700, color: 'var(--ink-slate)' }} aria-hidden="true">
                    {initials(n.senderLabel || n.senderName)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0, background: isMe ? 'var(--blue-wash)' : 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '10px 14px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-slate)', margin: '0 0 2px' }}>
                    {isMe ? 'You' : (n.senderLabel || n.senderName || 'Someone')}
                    <span style={{ fontWeight: 400, color: 'var(--ink-4)', marginLeft: '8px' }}>{fmtWhen(n.createdAt)}</span>
                  </p>
                  <p style={{ fontSize: '16px', lineHeight: 1.45, color: 'var(--ink)', fontFamily: SFText, margin: 0 }}>
                    {n.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={send} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="field"
          style={{ flex: 1, borderRadius: '14px', padding: '10px 14px', fontSize: '16px', fontFamily: SFText, color: 'var(--ink)', border: '1.5px solid var(--border)', background: 'var(--canvas)', resize: 'none', outline: 'none' }}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          style={{
            height: '44px', padding: '0 18px', borderRadius: '9999px', border: 'none',
            background: text.trim() ? 'var(--blue)' : 'var(--border)', color: '#fff',
            fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'inherit',
            cursor: text.trim() ? 'pointer' : 'not-allowed', flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          {sending ? 'Sending…' : sendLabel}
        </button>
      </form>
    </div>
  );
}

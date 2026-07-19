import { useCallback, useEffect, useState } from 'react';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import ConfirmDialog from '../components/ConfirmDialog';
import api from '../api/axios';
import { useToast } from '../context/useToast';
import SmoothInput from '../components/SmoothInput';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const FAMILY_MAX = 5;

// Simple human-silhouette avatar (matches Emergency Contacts)
const DefaultAvatar = ({ color = 'var(--blue)', size = 52 }) => (
  <div style={{
    width: `${size}px`, height: `${size}px`, borderRadius: '50%',
    background: `color-mix(in srgb, ${color} 10%, transparent)`,
    flexShrink: 0, display: 'flex', alignItems: 'flex-end',
    justifyContent: 'center', overflow: 'hidden',
  }}>
    <svg width={size * 0.75} height={size * 0.75} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M12 14c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6z" />
    </svg>
  </div>
);

const cardStyle = {
  background: 'var(--canvas)',
  borderRadius: '18px',
  border: '1px solid var(--border)',
  padding: '20px 24px',
  marginBottom: '14px',
};

const ghostBtn = {
  background: 'transparent',
  color: 'var(--ink-3)',
  border: '1.5px solid var(--border)',
  borderRadius: '9999px',
  padding: '10px 18px',
  minHeight: '44px',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  fontFamily: SFText,
  cursor: 'pointer',
};

const fillBtn = {
  background: 'var(--action-fill)',
  color: 'var(--action-ink)',
  border: 'none',
  borderRadius: '9999px',
  padding: '10px 20px',
  minHeight: '44px',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  fontFamily: SFText,
  cursor: 'pointer',
};

const sectionH = {
  fontSize: 'var(--text-xl)',
  fontWeight: 600,
  color: 'var(--ink)',
  fontFamily: SF,
  letterSpacing: '-0.3px',
  margin: 0,
};

export default function MyFamily() {
  const { toast } = useToast();
  const [family, setFamily] = useState({ activeLinks: [], incomingRequests: [], outgoingRequests: [] });
  const [loaded, setLoaded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ identifier: '', relationship: '' });
  const [sending, setSending] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(() => {
    return api.get('/family/links')
      .then(r => setFamily(r.data))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = family.activeLinks || [];
  const incoming = family.incomingRequests || [];
  const outgoing = family.outgoingRequests || [];
  // The backend cap counts everyone already linked plus every open request.
  const seatCount = active.length + incoming.length + outgoing.length;
  const canAdd = seatCount < FAMILY_MAX;

  async function sendRequest(e) {
    e.preventDefault();
    setSending(true); setFormMsg('');
    try {
      await api.post('/family/requests', {
        identifier: form.identifier.trim(),
        relationship: form.relationship.trim(),
        side: 'family',
      });
      setForm({ identifier: '', relationship: '' });
      setShowAddForm(false);
      toast.success('Request sent. It becomes a family link when they accept.');
      await load();
    } catch (err) {
      setFormMsg(err?.response?.data?.message || 'Could not send the request. Please try again.');
    } finally { setSending(false); }
  }

  async function respond(id, accept) {
    setBusyId(id);
    try {
      await api.post(`/family/requests/${id}/respond`, { accept });
      toast.success(accept ? 'They are now part of your family here.' : 'Request declined.');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally { setBusyId(null); }
  }

  async function cancelRequest(id) {
    setBusyId(id);
    try {
      await api.delete(`/family/links/${id}`);
      toast.success('Request cancelled.');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not cancel the request. Please try again.');
    } finally { setBusyId(null); }
  }

  async function removeLink(id) {
    setRemoving(true);
    try {
      await api.delete(`/family/links/${id}`);
      setPendingRemove(null);
      toast.success('Removed from your family.');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not remove them. Please try again.');
    } finally { setRemoving(false); }
  }

  async function makePrimary(id) {
    setBusyId(id);
    try {
      await api.post(`/family/links/${id}/primary`);
      toast.success('Main contact updated.');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not change your main contact. Please try again.');
    } finally { setBusyId(null); }
  }

  const f = (key) => ({ value: form[key], onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) });

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>
      <NavBar />

      {/* Big hero card removed on the user's call, 2026-07-18 — the list header below is the page title. */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 24px 60px' }}>

        {/* Plain-words promises */}
        <BlurFade delay={2}>
          <div style={{ ...cardStyle, padding: '24px' }}>
            <h2 style={{ ...sectionH, fontSize: 'var(--text-lg)', marginBottom: '12px' }}>How family works here</h2>
            <ul style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li style={{ fontSize: '16px', color: 'var(--ink-slate)', lineHeight: 1.5 }}>Your family can see you're safe.</li>
              <li style={{ fontSize: '16px', color: 'var(--ink-slate)', lineHeight: 1.5 }}>They only see the friendships you choose to share.</li>
              <li style={{ fontSize: '16px', color: 'var(--ink-slate)', lineHeight: 1.5 }}>They can never post or act for you.</li>
              <li style={{ fontSize: '16px', color: 'var(--ink-slate)', lineHeight: 1.5 }}>You can remove anyone at any time.</li>
            </ul>
            <p style={{ fontSize: '16px', color: 'var(--gold-deep)', fontWeight: 600, margin: '14px 0 0' }}>
              Family connected gives you +1 trust point — one point total, however many
              family members you add (up to 5 people).
            </p>
          </div>
        </BlurFade>

        {/* Header + add */}
        <BlurFade delay={3}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', margin: '18px 0 16px' }}>
            <h1 style={sectionH}>
              My Family
              <span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--ink-3)', marginLeft: '8px' }}>
                ({seatCount}/{FAMILY_MAX})
              </span>
            </h1>
            {canAdd && !showAddForm && (
              <button onClick={() => { setShowAddForm(true); setFormMsg(''); }} style={{ ...fillBtn, whiteSpace: 'nowrap', flexShrink: 0 }}>
                + Add a family member
              </button>
            )}
          </div>
        </BlurFade>

        {!canAdd && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: '0 0 16px' }}>
            You've reached the limit of {FAMILY_MAX} family members, counting open requests.
            Remove someone or cancel a request to add another person.
          </p>
        )}

        {/* Add form */}
        {showAddForm && (
          <div style={cardStyle}>
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, marginBottom: '6px' }}>
              Add a family member
            </p>
            <p style={{ fontSize: '16px', color: 'var(--ink-3)', marginBottom: '18px', lineHeight: 1.5 }}>
              Type their exact ToWin username, email or phone. They must say yes before anything is shared.
            </p>
            <form onSubmit={sendRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="family-identifier" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                  Username, email or phone
                </label>
                <SmoothInput id="family-identifier" {...f('identifier')} className="field" placeholder="Exactly as they use it on ToWin" required />
              </div>
              <div>
                <label htmlFor="family-relationship" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                  Relationship
                </label>
                <SmoothInput id="family-relationship" {...f('relationship')} className="field" placeholder="Daughter, Son, Niece…" />
              </div>
              {formMsg && (
                <p className="danger-text" style={{ fontSize: 'var(--text-sm)', fontWeight: 500, margin: 0 }}>{formMsg}</p>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={sending} style={{ ...fillBtn, flex: 1, fontSize: '16px' }}>
                  {sending ? 'Sending…' : 'Send request'}
                </button>
                <button type="button" onClick={() => { setShowAddForm(false); setFormMsg(''); }} style={{ ...ghostBtn, flex: 1, fontSize: '16px' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <BlurFade delay={4}>
            <div style={{ margin: '8px 0 16px' }}>
              <h2 style={{ ...sectionH, fontSize: 'var(--text-lg)', marginBottom: '12px' }}>They want to join your family</h2>
              {incoming.map(r => (
                <div key={r.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <DefaultAvatar color="var(--blue)" size={48} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, margin: 0 }}>{r.otherUserName}</p>
                      <p style={{ fontSize: '16px', color: 'var(--ink-3)', margin: '2px 0 0', lineHeight: 1.5 }}>
                        {r.relationship ? `${r.relationship} · ` : ''}wants to join as your family. It's your choice.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                    <button
                      onClick={() => respond(r.id, true)}
                      disabled={busyId === r.id}
                      style={{
                        ...ghostBtn, flex: 1,
                        color: 'var(--blue-deep)', borderColor: 'var(--blue-soft)',
                      }}
                    >
                      Accept
                    </button>
                    <button onClick={() => respond(r.id, false)} disabled={busyId === r.id} style={{ ...ghostBtn, flex: 1 }}>
                      Not now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </BlurFade>
        )}

        {/* Outgoing requests */}
        {outgoing.length > 0 && (
          <BlurFade delay={4}>
            <div style={{ margin: '8px 0 16px' }}>
              <h2 style={{ ...sectionH, fontSize: 'var(--text-lg)', marginBottom: '12px' }}>Requests you sent</h2>
              {outgoing.map(r => (
                <div key={r.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <DefaultAvatar color="var(--ink-4)" size={48} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, margin: 0 }}>{r.otherUserName}</p>
                      {r.relationship && (
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: '2px 0 0' }}>{r.relationship}</p>
                      )}
                      <p style={{ fontSize: '16px', color: 'var(--ink-3)', margin: '4px 0 0', lineHeight: 1.5 }}>
                        Waiting for {r.otherUserName} to accept — only they can say yes. You can cancel any time.
                      </p>
                    </div>
                  </div>
                  <div style={{ marginTop: '14px' }}>
                    <button onClick={() => cancelRequest(r.id)} disabled={busyId === r.id} style={{ ...ghostBtn, width: '100%' }}>
                      Cancel request
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </BlurFade>
        )}

        {/* Family list */}
        <BlurFade delay={5}>
          <div>
            {loaded && active.length === 0 && (
              <div style={{ ...cardStyle, padding: '40px 24px', textAlign: 'center' }}>
                <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px', fontFamily: SF }}>
                  No family linked yet
                </p>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: 0 }}>
                  Add up to {FAMILY_MAX} people. Each one must accept before they're linked to you.
                </p>
              </div>
            )}

            {active.map(l => (
              <div key={l.id} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <DefaultAvatar color={l.isPrimary ? 'var(--gold-deep)' : 'var(--blue)'} size={52} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, margin: 0 }}>
                      {l.otherUserName}
                    </p>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: '2px 0 0' }}>
                      {l.relationship || 'Family member'}
                    </p>
                  </div>
                  {l.isPrimary && (
                    <span style={{
                      fontSize: '14px', fontWeight: 600, color: 'var(--gold-deep)',
                      background: 'var(--gold-wash)', border: '1px solid var(--gold-line)',
                      borderRadius: '9999px', padding: '6px 14px', whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      Main contact
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                  {!l.isPrimary && (
                    <button onClick={() => makePrimary(l.id)} disabled={busyId === l.id} style={{ ...ghostBtn, flex: 1, color: 'var(--gold-deep)', borderColor: 'var(--gold-line)' }}>
                      Make main contact
                    </button>
                  )}
                  <button onClick={() => setPendingRemove(l)} style={{ ...ghostBtn, flex: 1 }}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </BlurFade>
      </div>

      <ConfirmDialog
        open={!!pendingRemove}
        danger
        title={`Remove ${pendingRemove?.otherUserName || 'this person'} from your family?`}
        message="They will no longer see that you're safe or any friendship you shared. If they're your last family member here, your family trust point goes too. You can add them again later — they would need to accept again."
        confirmLabel="Remove from family"
        cancelLabel="Keep"
        loading={removing}
        onConfirm={() => pendingRemove && removeLink(pendingRemove.id)}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import api from '../api/axios';
import { useToast } from '../context/useToast';
import SmoothInput from '../components/SmoothInput';
import TrustBadge from '../components/TrustBadge';
import FamilyHelperUpdates from '../components/FamilyHelperUpdates';
import FamilyHelperConnect from '../components/FamilyHelperConnect';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

// Plain-words framing for each alert type — the body carries the details,
// this line explains what kind of news it is.
const ALERT_KINDS = {
  SOS: {
    label: 'Urgent help',
    explain: 'They pressed their SOS button and asked for urgent help. A call right now matters.',
    color: 'var(--red-deep)',
  },
  INACTIVITY: {
    label: 'Quiet lately',
    explain: 'They have not checked in for a while. A friendly call could help.',
    color: 'var(--gold-deep)',
  },
  FIRST_MEET: {
    label: 'First meeting',
    explain: "They're meeting a friend in person for the first time — a friendship they chose to share with you.",
    color: 'var(--blue-deep)',
  },
};

// Simple human-silhouette avatar (matches My Family / Emergency Contacts)
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

function friendlyDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) +
    ' at ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function FamilyHome() {
  const { toast } = useToast();
  const [family, setFamily] = useState({ activeLinks: [], incomingRequests: [], outgoingRequests: [] });
  const [alerts, setAlerts] = useState([]);
  const [journey, setJourney] = useState([]);
  const [myConns, setMyConns] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ identifier: '', relationship: '' });
  const [sending, setSending] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    return Promise.all([
      api.get('/family/links').then(r => setFamily(r.data)).catch(() => {}),
      api.get('/family/alerts').then(r => setAlerts(r.data?.alerts || [])).catch(() => {}),
      api.get('/family/journey').then(r => setJourney(r.data?.elders || [])).catch(() => {}),
      // Step 4: my own connections, to show waiting/connected states on helper cards.
      api.get('/connections').then(r => setMyConns(r.data || [])).catch(() => {}),
    ]).finally(() => setLoaded(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  // This screen is the FAMILY seat: only show links where I'm the family side.
  const familySide = (list) => (list || []).filter(l => !l.iAmElder);
  const elders = familySide(family.activeLinks);
  const incoming = familySide(family.incomingRequests);
  const outgoing = familySide(family.outgoingRequests);

  async function sendRequest(e) {
    e.preventDefault();
    setSending(true); setFormMsg('');
    try {
      await api.post('/family/requests', {
        identifier: form.identifier.trim(),
        relationship: form.relationship.trim(),
        side: 'elder',
      });
      setForm({ identifier: '', relationship: '' });
      setShowAddForm(false);
      toast.success('Request sent. You become family here once they accept.');
      await load();
    } catch (err) {
      setFormMsg(err?.response?.data?.message || 'Could not send the request. Please try again.');
    } finally { setSending(false); }
  }

  async function respond(id, accept) {
    setBusyId(id);
    try {
      await api.post(`/family/requests/${id}/respond`, { accept });
      toast.success(accept ? "You're now linked as their family." : 'Request declined.');
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

  const f = (key) => ({ value: form[key], onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) });

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>
      <NavBar />

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 24px 60px' }}>

        {/* Header + add-parent (page title — the big hero card was removed on the user's call, 2026-07-18) */}
        <BlurFade delay={2}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', margin: '0 0 16px' }}>
            <h1 style={sectionH}>My Parents</h1>
            {!showAddForm && (
              <button onClick={() => { setShowAddForm(true); setFormMsg(''); }} style={{ ...fillBtn, whiteSpace: 'nowrap', flexShrink: 0 }}>
                + Add your parent
              </button>
            )}
          </div>
        </BlurFade>

        {/* Add-parent form */}
        {showAddForm && (
          <div style={cardStyle}>
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, marginBottom: '6px' }}>
              Add your parent
            </p>
            <p style={{ fontSize: '16px', color: 'var(--ink-3)', marginBottom: '18px', lineHeight: 1.5 }}>
              Type their exact ToWin username, email or phone. They must say yes before you see anything.
            </p>
            <form onSubmit={sendRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="parent-identifier" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                  Username, email or phone
                </label>
                <SmoothInput id="parent-identifier" {...f('identifier')} className="field" placeholder="Exactly as they use it on ToWin" required />
              </div>
              <div>
                <label htmlFor="parent-relationship" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                  Relationship (what you are to them)
                </label>
                <SmoothInput id="parent-relationship" {...f('relationship')} className="field" placeholder="Daughter, Son, Niece…" />
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

        {/* Incoming requests — an elder invited me */}
        {incoming.length > 0 && (
          <BlurFade delay={3}>
            <div style={{ margin: '8px 0 16px' }}>
              <h2 style={{ ...sectionH, fontSize: 'var(--text-lg)', marginBottom: '12px' }}>They added you as family</h2>
              {incoming.map(r => (
                <div key={r.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <DefaultAvatar color="var(--blue)" size={48} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, margin: 0 }}>{r.otherUserName}</p>
                      <p style={{ fontSize: '16px', color: 'var(--ink-3)', margin: '2px 0 0', lineHeight: 1.5 }}>
                        wants you as their family here{r.relationship ? ` (as their ${r.relationship.toLowerCase()})` : ''}. It's your choice.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                    <button
                      onClick={() => respond(r.id, true)}
                      disabled={busyId === r.id}
                      style={{ ...ghostBtn, flex: 1, color: 'var(--blue-deep)', borderColor: 'var(--blue-soft)' }}
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

        {/* Outgoing requests — waiting on the parent */}
        {outgoing.length > 0 && (
          <BlurFade delay={3}>
            <div style={{ margin: '8px 0 16px' }}>
              <h2 style={{ ...sectionH, fontSize: 'var(--text-lg)', marginBottom: '12px' }}>Requests you sent</h2>
              {outgoing.map(r => (
                <div key={r.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <DefaultAvatar color="var(--ink-4)" size={48} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, margin: 0 }}>{r.otherUserName}</p>
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

        {/* Linked elder cards */}
        <BlurFade delay={4}>
          <div>
            {loaded && elders.length === 0 && (
              <div style={{ ...cardStyle, padding: '40px 24px', textAlign: 'center' }}>
                <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px', fontFamily: SF }}>
                  No parent linked yet
                </p>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: 0 }}>
                  Add your parent above. They must accept before you're linked.
                </p>
              </div>
            )}

            {elders.map(l => {
              const j = journey.find(e => e.elderId === l.elderId);
              return (
                <div key={l.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <DefaultAvatar color="var(--blue)" size={52} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, margin: 0 }}>
                        {l.otherUserName}
                      </p>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: '2px 0 0' }}>
                        {l.relationship ? `You're their ${l.relationship.toLowerCase()}` : 'Your family member'}
                      </p>
                    </div>
                    <span style={{
                      fontSize: '14px', fontWeight: 600, color: 'var(--green-deep)',
                      background: 'color-mix(in srgb, var(--green-deep) 8%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--green-deep) 25%, transparent)',
                      borderRadius: '9999px', padding: '6px 14px', whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      Linked
                    </span>
                  </div>

                  {/* US-002: parent status line — check-in chip + open help requests */}
                  {j && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        fontSize: '14px', fontWeight: 600,
                        color: j.checkedInToday ? 'var(--green-deep)' : 'var(--ink-3)',
                        background: j.checkedInToday
                          ? 'color-mix(in srgb, var(--green-deep) 8%, transparent)'
                          : 'color-mix(in srgb, var(--ink-3) 7%, transparent)',
                        border: j.checkedInToday
                          ? '1px solid color-mix(in srgb, var(--green-deep) 25%, transparent)'
                          : '1px solid var(--border)',
                        borderRadius: '9999px', padding: '5px 12px', whiteSpace: 'nowrap',
                      }}>
                        {j.checkedInToday ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v5l3 2" />
                          </svg>
                        )}
                        {j.checkedInToday ? 'Checked in today' : 'No check-in yet today'}
                      </span>
                      {j.openNeedsCount > 0 && (
                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink-3)' }}>
                          {j.openNeedsCount} help request{j.openNeedsCount === 1 ? '' : 's'} open
                        </span>
                      )}
                    </div>
                  )}

                  {/* US-003: shared helper journey — only the friendships the parent chose to share */}
                  {j && (
                    <div style={{ marginTop: '18px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, margin: '0 0 10px' }}>
                        Friendships shared with you
                      </p>

                      {(j.sharedHelpers || []).length === 0 && (
                        <p style={{ fontSize: '16px', color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>
                          No friendships shared with you yet. Your parent chooses what to share.
                        </p>
                      )}

                      {(j.sharedHelpers || []).map(h => (
                        <div
                          key={h.connectionId}
                          style={{
                            border: h.readyToMeet
                              ? '1px solid color-mix(in srgb, var(--blue-deep) 35%, transparent)'
                              : '1px solid var(--border)',
                            background: h.readyToMeet
                              ? 'color-mix(in srgb, var(--blue) 6%, transparent)'
                              : 'transparent',
                            borderRadius: '14px',
                            padding: '12px 14px',
                            marginBottom: '10px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {h.helperPhotoUrl ? (
                              <img
                                src={h.helperPhotoUrl}
                                alt=""
                                style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                              />
                            ) : (
                              <DefaultAvatar color="var(--ink-4)" size={44} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, margin: 0 }}>
                                  {h.helperName}
                                </p>
                                <TrustBadge tier={h.tier} score={h.trustScore} />
                              </div>
                              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gold-deep)', margin: '4px 0 0' }}>
                                Stage {h.stageIndex + 1} of 7 · {h.stageLabel}
                              </p>
                            </div>
                          </div>
                          {h.readyToMeet && (
                            <p style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              fontSize: '14px', fontWeight: 600, color: 'var(--blue-deep)',
                              margin: '10px 0 0', lineHeight: 1.4,
                            }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                              They're getting ready to meet in person
                            </p>
                          )}
                          {/* Step 4: direct family ↔ helper connection (helper decides) */}
                          <FamilyHelperConnect
                            helper={h}
                            myConnection={(myConns || []).find(c => c.otherUserId === h.helperUserId)}
                            onChanged={load}
                          />
                          {/* US-004 (Step 3): the shared updates thread — read + reply */}
                          <FamilyHelperUpdates helper={h} elderName={l.otherUserName} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </BlurFade>

        {/* Alert feed */}
        <BlurFade delay={5}>
          <div style={{ marginTop: '28px' }}>
            <h2 style={{ ...sectionH, marginBottom: '6px' }}>News about your family</h2>
            <p style={{ fontSize: '16px', color: 'var(--ink-3)', margin: '0 0 14px', lineHeight: 1.5 }}>
              Alerts appear here when something needs your attention — nothing is sent by text or email.
            </p>

            {loaded && alerts.length === 0 && (
              <div style={{ ...cardStyle, padding: '32px 24px', textAlign: 'center' }}>
                <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px', fontFamily: SF }}>
                  No alerts right now
                </p>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: 0 }}>
                  That's good news — you'll see it here if your parent asks for help,
                  goes quiet for a while, or shares a first meeting with a friend.
                </p>
              </div>
            )}

            {alerts.map(a => {
              const kind = ALERT_KINDS[a.type] || { label: 'Update', explain: '', color: 'var(--ink-3)' };
              return (
                <div key={a.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '14px', fontWeight: 700, color: kind.color,
                      border: `1px solid color-mix(in srgb, ${kind.color} 30%, transparent)`,
                      background: `color-mix(in srgb, ${kind.color} 7%, transparent)`,
                      borderRadius: '9999px', padding: '4px 12px', whiteSpace: 'nowrap',
                    }}>
                      {kind.label}
                    </span>
                    {a.createdAt && (
                      <span style={{ fontSize: '14px', color: 'var(--ink-4)' }}>{friendlyDate(a.createdAt)}</span>
                    )}
                  </div>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', margin: '12px 0 4px', lineHeight: 1.5 }}>
                    {a.body}
                  </p>
                  {kind.explain && (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>
                      {kind.explain}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </BlurFade>
      </div>
    </div>
  );
}

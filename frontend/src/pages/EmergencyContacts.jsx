import { useEffect, useState } from 'react';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import ConfirmDialog from '../components/ConfirmDialog';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import SmoothInput from '../components/SmoothInput';

const unsplash = (id, w, h) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const ROLE_ACCENT = {
  GP: 'var(--blue)',
  Doctor: 'var(--blue)',
  Family: 'var(--ink-3)',
  Neighbour: '#0a9396',
  Neighbor: '#0a9396',
  Friend: 'var(--leaf)',
};
const roleAccent = (rel) => {
  if (!rel) return 'var(--ink-4)';
  const key = Object.keys(ROLE_ACCENT).find(k => rel.toLowerCase().includes(k.toLowerCase()));
  return key ? ROLE_ACCENT[key] : 'var(--ink-4)';
};

// Simple WhatsApp-style default avatar (human silhouette in a circle)
const DefaultAvatar = ({ color = 'var(--blue)', size = 52 }) => (
  <div style={{
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: `${color}1A`,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    overflow: 'hidden',
  }}>
    <svg width={size * 0.75} height={size * 0.75} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M12 14c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6z" />
    </svg>
  </div>
);

export default function EmergencyContacts() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', relationship: '', inactivityDays: 5 });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const [sosMsg, setSosMsg] = useState('');
  const [sosSent, setSosSent] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [removing, setRemoving] = useState(false);
  useEffect(() => {
    api.get('/emergency/contacts').then(r => setContacts(r.data)).catch(() => {});
  }, []);

  const f = (key) => ({ value: form[key], onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) });

  async function addContact(e) {
    e.preventDefault();
    setAdding(true); setMsg('');
    try {
      const res = await api.post('/emergency/contacts', { ...form, inactivityDays: Number(form.inactivityDays) });
      setContacts(prev => [...prev, res.data]);
      setForm({ name: '', phone: '', relationship: '', inactivityDays: 5 });
      setMsg('Contact added.');
      setShowAddForm(false);
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Failed to add contact.');
    } finally { setAdding(false); }
  }

  async function remove(contactId) {
    setRemoving(true);
    try {
      await api.delete(`/emergency/contacts/${contactId}`);
      setContacts(prev => prev.filter(c => c.id !== contactId));
      setPendingRemove(null);
      toast.success('Contact removed.');
    } catch { toast.error('Could not remove contact. Please try again.'); }
    finally { setRemoving(false); }
  }

  async function triggerSos() {
    setSosMsg('');
    try {
      await api.post('/emergency/sos');
      setSosSent(true);
      setSosMsg('SOS sent to all emergency contacts.');
    } catch { setSosMsg('Failed to send SOS.'); }
  }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>
      <NavBar />

      {/* Hero tile — calm sky-blue, matches dashboard theme */}
      <BlurFade delay={1}>
        <div style={{
          background: 'linear-gradient(180deg, var(--blue-wash) 0%, var(--surface) 100%)',
          borderBottom: '1px solid var(--sky-line)',
          padding: 'clamp(32px, 7vw, 64px) 20px clamp(24px, 5vw, 48px)',
          textAlign: 'center',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'var(--canvas)',
            border: '1px solid var(--blue-soft)',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(79,163,206,0.15)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 style={{
            fontSize: 'clamp(28px, 8vw, 48px)',
            fontWeight: 400,
            color: 'var(--ink)',
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.02em',
            marginBottom: '12px',
            lineHeight: 1.1,
          }}>
            Emergency Contacts
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--ink-slate-2)', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
            We'll alert these people if you don't check in for several days.
          </p>
        </div>
      </BlurFade>

      {/* SOS mega-button */}
      <BlurFade delay={2}>
        <div style={{ padding: '32px 24px 0', maxWidth: '640px', margin: '0 auto' }}>
          <button
            onClick={triggerSos}
            style={{
              display: 'block',
              width: '100%',
              background: sosSent ? 'var(--blue-teal)' : 'var(--red)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9999px',
              height: '56px',
              fontSize: '17px',
              fontWeight: 600,
              fontFamily: SF,
              cursor: 'pointer',
              letterSpacing: '0.3px',
              transition: 'background 0.2s',
              boxShadow: sosSent ? '0 4px 24px rgba(26,122,60,0.3)' : '0 4px 24px rgba(204,0,0,0.35)',
            }}
          >
            {sosSent ? 'SOS Sent' : 'SOS: Call All Contacts Now'}
          </button>
          {sosMsg && (
            <p style={{
              textAlign: 'center',
              marginTop: '12px',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              color: sosSent ? 'var(--blue-teal)' : 'var(--red)',
            }}>
              {sosMsg}
            </p>
          )}
        </div>
      </BlurFade>

      {/* Contacts section */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 24px 60px' }}>

        {/* Section header */}
        <BlurFade delay={3}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}>
            <h2 style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 600,
              color: 'var(--ink)',
              fontFamily: SF,
              letterSpacing: '-0.3px',
            }}>
              My Contacts
              <span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--ink-3)', marginLeft: '8px' }}>
                ({contacts.length}/3)
              </span>
            </h2>
            {contacts.length < 3 && (
              <button
                onClick={() => setShowAddForm(v => !v)}
                style={{
                  background: 'var(--blue)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '8px 20px',
                  minHeight: '44px',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  fontFamily: SFText,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                + Add Contact
              </button>
            )}
          </div>
        </BlurFade>

        {/* Empty state */}
        {contacts.length === 0 && (
          <BlurFade delay={4}>
            <div style={{
              background: 'var(--canvas)',
              borderRadius: '18px',
              padding: '48px 24px',
              textAlign: 'center',
              marginBottom: '20px',
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(204,0,0,0.08)',
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px', fontFamily: SF }}>
                No contacts yet
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>Add up to 3 people who care about you.</p>
            </div>
          </BlurFade>
        )}

        {/* Contact cards */}
        {contacts.map((c, i) => {
          const accent = roleAccent(c.relationship);
          return (
            <BlurFade key={c.id} delay={4 + i * 0.5}>
              <div style={{
                background: 'var(--canvas)',
                borderRadius: '18px',
                overflow: 'hidden',
                marginBottom: '14px',
                border: '1px solid var(--border)',
              }}>
                {/* Colored top accent bar */}
                <div style={{ height: '4px', background: accent }} />
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    {/* Default human-silhouette avatar */}
                    <DefaultAvatar color={accent} size={52} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, marginBottom: '4px' }}>
                        {c.name}
                      </p>
                      {c.relationship && (
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', marginBottom: '6px' }}>
                          {c.relationship}
                        </p>
                      )}
                      <p style={{ fontSize: '16px', color: 'var(--ink)', fontWeight: 500, marginBottom: '2px' }}>
                        {c.phone}
                      </p>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)' }}>
                        Alerts after {c.inactivityDays} inactive days
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <a href={`tel:${c.phone}`} style={{
                      flex: 1,
                      background: 'var(--blue)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '10px 0',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      fontFamily: SFText,
                      cursor: 'pointer',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      Call Now
                    </a>
                    <button
                      onClick={() => setPendingRemove(c)}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        color: 'var(--ink-3)',
                        border: '1.5px solid var(--border)',
                        borderRadius: '9999px',
                        padding: '10px 0',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        fontFamily: SFText,
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </BlurFade>
          );
        })}

        {/* Add contact form */}
        {contacts.length < 3 && showAddForm && (
          <BlurFade delay={5}>
            <div style={{
              background: 'var(--canvas)',
              borderRadius: '18px',
              padding: '28px 24px',
              marginBottom: '20px',
            }}>
              <p style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--ink)',
                fontFamily: SF,
                marginBottom: '20px',
                letterSpacing: '-0.3px',
              }}>
                Add Contact
              </p>
              <form onSubmit={addContact} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="two-col-grid" style={{ gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                      Name
                    </label>
                    <SmoothInput {...f('name')} className="field" placeholder="Contact name" required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                      Phone
                    </label>
                    <SmoothInput {...f('phone')} className="field" placeholder="+1 555 000 0000" required />
                  </div>
                </div>
                <div className="two-col-grid" style={{ gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                      Relationship
                    </label>
                    <SmoothInput {...f('relationship')} className="field" placeholder="Daughter, Doctor…" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                      Alert after (days)
                    </label>
                    <SmoothInput {...f('inactivityDays')} type="number" min={1} max={30} className="field" />
                  </div>
                </div>
                {msg && (
                  <p style={{ fontSize: 'var(--text-sm)', color: msg.includes('added') ? 'var(--blue-teal)' : 'var(--red)', fontWeight: 500 }}>
                    {msg}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="submit"
                    disabled={adding}
                    style={{
                      flex: 1,
                      background: 'var(--blue)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '12px 0',
                      fontSize: '16px',
                      fontWeight: 600,
                      fontFamily: SFText,
                      cursor: 'pointer',
                    }}
                  >
                    {adding ? 'Adding…' : 'Add Contact'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      color: 'var(--ink-3)',
                      border: '1.5px solid var(--border)',
                      borderRadius: '9999px',
                      padding: '12px 0',
                      fontSize: '16px',
                      fontWeight: 600,
                      fontFamily: SFText,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </BlurFade>
        )}

      </div>

      <ConfirmDialog
        open={!!pendingRemove}
        danger
        title={`Remove ${pendingRemove?.name || 'this contact'}?`}
        message="They will no longer be alerted if you trigger an SOS or go inactive. You can add them again later."
        confirmLabel="Remove Contact"
        cancelLabel="Keep"
        loading={removing}
        onConfirm={() => pendingRemove && remove(pendingRemove.id)}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  );
}

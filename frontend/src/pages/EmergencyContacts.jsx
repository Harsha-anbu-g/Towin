import { useEffect, useState } from 'react';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import ConfirmDialog from '../components/ConfirmDialog';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const unsplash = (id, w, h) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const ROLE_ACCENT = {
  GP: '#4FA3CE',
  Doctor: '#4FA3CE',
  Family: '#7a7a7a',
  Neighbour: '#0a9396',
  Neighbor: '#0a9396',
  Friend: '#3D8B5A',
};
const roleAccent = (rel) => {
  if (!rel) return '#a0a0a5';
  const key = Object.keys(ROLE_ACCENT).find(k => rel.toLowerCase().includes(k.toLowerCase()));
  return key ? ROLE_ACCENT[key] : '#a0a0a5';
};

// Simple WhatsApp-style default avatar (human silhouette in a circle)
const DefaultAvatar = ({ color = '#4FA3CE', size = 52 }) => (
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
    <div style={{ minHeight: '100svh', background: '#fafafc', fontFamily: SFText }}>
      <NavBar />

      {/* Hero tile — calm sky-blue, matches dashboard theme */}
      <BlurFade delay={1}>
        <div style={{
          background: 'linear-gradient(180deg, #EAF5FB 0%, #f5f5f7 100%)',
          borderBottom: '1px solid #DCEBF4',
          padding: 'clamp(32px, 7vw, 64px) 20px clamp(24px, 5vw, 48px)',
          textAlign: 'center',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: '#ffffff',
            border: '1px solid #BFD9EA',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(79,163,206,0.15)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 style={{
            fontSize: 'clamp(28px, 8vw, 48px)',
            fontWeight: 600,
            color: '#1d1d1f',
            fontFamily: SF,
            letterSpacing: '-1px',
            marginBottom: '12px',
            lineHeight: 1.1,
          }}>
            Emergency Contacts
          </h1>
          <p style={{ fontSize: '17px', color: '#5a6b75', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
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
              background: sosSent ? '#3D8AB0' : '#cc0000',
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
              fontSize: '14px',
              fontWeight: 500,
              color: sosSent ? '#3D8AB0' : '#cc0000',
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
              fontSize: '28px',
              fontWeight: 600,
              color: '#1d1d1f',
              fontFamily: SF,
              letterSpacing: '-0.3px',
            }}>
              My Contacts
              <span style={{ fontSize: '16px', fontWeight: 400, color: '#7a7a7a', marginLeft: '8px' }}>
                ({contacts.length}/3)
              </span>
            </h2>
            {contacts.length < 3 && (
              <button
                onClick={() => setShowAddForm(v => !v)}
                style={{
                  background: '#4FA3CE',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '8px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: SFText,
                  cursor: 'pointer',
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
              background: '#ffffff',
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cc0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px', fontFamily: SF }}>
                No contacts yet
              </p>
              <p style={{ fontSize: '14px', color: '#7a7a7a' }}>Add up to 3 people who care about you.</p>
            </div>
          </BlurFade>
        )}

        {/* Contact cards */}
        {contacts.map((c, i) => {
          const accent = roleAccent(c.relationship);
          return (
            <BlurFade key={c.id} delay={4 + i * 0.5}>
              <div style={{
                background: '#ffffff',
                borderRadius: '18px',
                overflow: 'hidden',
                marginBottom: '14px',
                border: '1px solid #ececef',
              }}>
                {/* Colored top accent bar */}
                <div style={{ height: '4px', background: accent }} />
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    {/* Default human-silhouette avatar */}
                    <DefaultAvatar color={accent} size={52} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '18px', fontWeight: 600, color: '#1d1d1f', fontFamily: SF, marginBottom: '4px' }}>
                        {c.name}
                      </p>
                      {c.relationship && (
                        <p style={{ fontSize: '14px', color: '#7a7a7a', marginBottom: '6px' }}>
                          {c.relationship}
                        </p>
                      )}
                      <p style={{ fontSize: '15px', color: '#1d1d1f', fontWeight: 500, marginBottom: '2px' }}>
                        {c.phone}
                      </p>
                      <p style={{ fontSize: '12px', color: '#a0a0a5' }}>
                        Alerts after {c.inactivityDays} inactive days
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <a href={`tel:${c.phone}`} style={{
                      flex: 1,
                      background: '#4FA3CE',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '10px 0',
                      fontSize: '14px',
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
                        color: '#7a7a7a',
                        border: '1.5px solid #e0e0e0',
                        borderRadius: '9999px',
                        padding: '10px 0',
                        fontSize: '14px',
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
              background: '#ffffff',
              borderRadius: '18px',
              padding: '28px 24px',
              marginBottom: '20px',
            }}>
              <p style={{
                fontSize: '22px',
                fontWeight: 600,
                color: '#1d1d1f',
                fontFamily: SF,
                marginBottom: '20px',
                letterSpacing: '-0.3px',
              }}>
                Add Contact
              </p>
              <form onSubmit={addContact} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="two-col-grid" style={{ gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>
                      Name
                    </label>
                    <input {...f('name')} className="field" placeholder="Contact name" required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>
                      Phone
                    </label>
                    <input {...f('phone')} className="field" placeholder="+1 555 000 0000" required />
                  </div>
                </div>
                <div className="two-col-grid" style={{ gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>
                      Relationship
                    </label>
                    <input {...f('relationship')} className="field" placeholder="Daughter, Doctor…" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>
                      Alert after (days)
                    </label>
                    <input {...f('inactivityDays')} type="number" min={1} max={30} className="field" />
                  </div>
                </div>
                {msg && (
                  <p style={{ fontSize: '14px', color: msg.includes('added') ? '#3D8AB0' : '#cc0000', fontWeight: 500 }}>
                    {msg}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="submit"
                    disabled={adding}
                    style={{
                      flex: 1,
                      background: '#4FA3CE',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '12px 0',
                      fontSize: '15px',
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
                      color: '#7a7a7a',
                      border: '1.5px solid #e0e0e0',
                      borderRadius: '9999px',
                      padding: '12px 0',
                      fontSize: '15px',
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

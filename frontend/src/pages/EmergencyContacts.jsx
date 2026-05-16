import { useEffect, useState } from 'react';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import api from '../api/axios';

const unsplash = (id, w, h) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const ROLE_ACCENT = {
  GP: '#0066cc',
  Doctor: '#0066cc',
  Family: '#7a7a7a',
  Neighbour: '#0a9396',
  Neighbor: '#0a9396',
  Friend: '#5856d6',
};
const roleAccent = (rel) => {
  if (!rel) return '#a0a0a5';
  const key = Object.keys(ROLE_ACCENT).find(k => rel.toLowerCase().includes(k.toLowerCase()));
  return key ? ROLE_ACCENT[key] : '#a0a0a5';
};

const ROLE_EMOJI = { GP: '👨‍⚕️', Doctor: '👨‍⚕️', Family: '👨‍👩‍👧', Neighbour: '🏡', Neighbor: '🏡', Friend: '👋' };
const roleEmoji = (rel) => {
  if (!rel) return '👤';
  const key = Object.keys(ROLE_EMOJI).find(k => rel.toLowerCase().includes(k.toLowerCase()));
  return key ? ROLE_EMOJI[key] : '👤';
};

export default function EmergencyContacts() {
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', relationship: '', inactivityDays: 5 });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const [sosMsg, setSosMsg] = useState('');
  const [sosSent, setSosSent] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [safetyToggles, setSafetyToggles] = useState({ shareLocation: true, autoAlert: true });
  const toggleSafety = (key) => setSafetyToggles(p => ({ ...p, [key]: !p[key] }));

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
    try {
      await api.delete(`/emergency/contacts/${contactId}`);
      setContacts(prev => prev.filter(c => c.id !== contactId));
    } catch { alert('Could not remove contact.'); }
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
    <div style={{ minHeight: '100svh', background: '#f5f5f7', fontFamily: SFText }}>
      <NavBar />

      {/* Hero tile */}
      <BlurFade delay={1}>
        <div style={{
          background: '#1d1d1f',
          padding: '64px 24px 48px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'rgba(204,0,0,0.15)',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cc0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 700,
            color: '#ffffff',
            fontFamily: SF,
            letterSpacing: '-1px',
            marginBottom: '12px',
            lineHeight: 1.1,
          }}>
            Emergency Contacts
          </h1>
          <p style={{ fontSize: '17px', color: '#cccccc', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
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
              background: sosSent ? '#1a7a3c' : '#cc0000',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9999px',
              height: '56px',
              fontSize: '17px',
              fontWeight: 700,
              fontFamily: SF,
              cursor: 'pointer',
              letterSpacing: '0.3px',
              transition: 'background 0.2s',
              boxShadow: sosSent ? '0 4px 24px rgba(26,122,60,0.3)' : '0 4px 24px rgba(204,0,0,0.35)',
            }}
          >
            {sosSent ? '✓ SOS Sent' : 'SOS — Call All Contacts Now'}
          </button>
          {sosMsg && (
            <p style={{
              textAlign: 'center',
              marginTop: '12px',
              fontSize: '14px',
              fontWeight: 500,
              color: sosSent ? '#1a7a3c' : '#cc0000',
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
                  background: '#0066cc',
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
          const emoji = roleEmoji(c.relationship);
          return (
            <BlurFade key={c.id} delay={4 + i * 0.5}>
              <div style={{
                background: '#ffffff',
                borderRadius: '18px',
                overflow: 'hidden',
                marginBottom: '14px',
              }}>
                {/* Colored top accent bar */}
                <div style={{ height: '4px', background: accent }} />
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    {/* Avatar emoji */}
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '14px',
                      background: `${accent}15`,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                    }}>
                      {emoji}
                    </div>
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
                      background: '#cc0000',
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
                      onClick={() => remove(c.id)}
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                  <p style={{ fontSize: '14px', color: msg.includes('added') ? '#1a7a3c' : '#cc0000', fontWeight: 500 }}>
                    {msg}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="submit"
                    disabled={adding}
                    style={{
                      flex: 1,
                      background: '#0066cc',
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

        {/* Location sharing section */}
        <BlurFade delay={6}>
          <div style={{
            background: '#272729',
            borderRadius: '18px',
            padding: '24px',
            marginTop: '8px',
          }}>
            <p style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#ffffff',
              fontFamily: SF,
              marginBottom: '16px',
              letterSpacing: '-0.2px',
            }}>
              Location Sharing
            </p>
            {[
              { label: 'Share location with contacts', sub: 'Contacts can see your approximate location', key: 'shareLocation' },
              { label: 'Auto-alert on inactivity', sub: 'Send alert if no check-in within set days', key: 'autoAlert' },
            ].map((row, idx) => {
              const on = safetyToggles[row.key];
              return (
                <div key={row.key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 0',
                  borderBottom: idx === 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                }}>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: 500, color: '#ffffff', marginBottom: '2px' }}>
                      {row.label}
                    </p>
                    <p style={{ fontSize: '13px', color: '#a0a0a5' }}>{row.sub}</p>
                  </div>
                  <div
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggleSafety(row.key)}
                    style={{
                      width: '51px',
                      height: '31px',
                      borderRadius: '9999px',
                      background: on ? '#34c759' : '#555',
                      position: 'relative',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'background 0.2s',
                    }}>
                    <div style={{
                      position: 'absolute',
                      top: '2px',
                      left: on ? '20px' : '2px',
                      width: '27px',
                      height: '27px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      transition: 'left 0.2s',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </BlurFade>
      </div>
    </div>
  );
}

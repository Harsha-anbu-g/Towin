import { useEffect, useState } from 'react';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import api from '../api/axios';

const unsplash = (id, w, h) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export default function EmergencyContacts() {
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', relationship: '', inactivityDays: 5 });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const [sosMsg, setSosMsg] = useState('');
  const [sosSent, setSosSent] = useState(false);

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
    <div style={{ minHeight: '100svh', background: 'var(--surface)' }}>
      <NavBar />
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 16px 60px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Hero banner with photo */}
        <BlurFade delay={1}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ height: '160px', position: 'relative' }}>
              <LazyLoadImage
                src={unsplash('photo-1576765974256-9b879d60a571', 700, 320)}
                alt="Community care"
                effect="blur"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to right, rgba(220,38,38,0.75) 0%, rgba(15,23,42,0.5) 100%)',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px',
              }}>
                <h1 className="font-display" style={{ fontSize: '32px', color: '#fff', marginBottom: '6px' }}>
                  Emergency Contacts
                </h1>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', maxWidth: '300px' }}>
                  We'll alert these people if you don't check in for several days.
                </p>
              </div>
            </div>

            {/* SOS trigger */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Need help right now?</p>
                <p style={{ fontSize: '13px', color: 'var(--ink-2)' }}>Immediately alert all your contacts.</p>
              </div>
              <button onClick={triggerSos} style={{
                background: sosSent ? 'var(--green)' : 'var(--red)',
                color: '#fff', border: 'none', borderRadius: '9999px',
                padding: '10px 24px', fontSize: '14px', fontWeight: 700,
                cursor: 'pointer', transition: 'background 0.2s',
                fontFamily: 'var(--font-body)', letterSpacing: '0.3px',
              }}>
                {sosSent ? '✓ Sent' : 'Send SOS'}
              </button>
            </div>
            {sosMsg && (
              <div style={{
                margin: '0 24px 16px',
                padding: '10px 14px', borderRadius: '10px',
                background: sosSent ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${sosSent ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                fontSize: '13px', color: sosSent ? 'var(--green)' : 'var(--red)', fontWeight: 500,
              }}>
                {sosMsg}
              </div>
            )}
          </div>
        </BlurFade>

        {/* Contact list */}
        {contacts.length > 0 && (
          <BlurFade delay={2}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Your contacts ({contacts.length}/3)
              </p>
              {contacts.map((c, i) => (
                <div key={c.id} className="card lift" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* Initials avatar */}
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                    background: ['linear-gradient(135deg,#2563eb,#7c3aed)', 'linear-gradient(135deg,#059669,#2563eb)', 'linear-gradient(135deg,#dc2626,#d97706)'][i % 3],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '15px', fontWeight: 700, color: '#fff',
                  }}>
                    {c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>{c.name}</p>
                    <p style={{ fontSize: '13px', color: 'var(--ink-2)', marginTop: '2px' }}>
                      {c.phone}{c.relationship ? ` · ${c.relationship}` : ''}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '2px' }}>
                      Alerts after {c.inactivityDays} inactive days
                    </p>
                  </div>
                  <button onClick={() => remove(c.id)} className="ghost-btn"
                    style={{ fontSize: '12px', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.2)', padding: '5px 12px' }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </BlurFade>
        )}

        {contacts.length === 0 && (
          <BlurFade delay={2}>
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239,68,68,0.08)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>No contacts yet</p>
              <p style={{ fontSize: '14px', color: 'var(--ink-3)' }}>Add up to 3 people who care about you.</p>
            </div>
          </BlurFade>
        )}

        {/* Add contact form */}
        {contacts.length < 3 && (
          <BlurFade delay={3}>
            <div className="card" style={{ padding: '24px' }}>
              <p className="font-display" style={{ fontSize: '22px', color: 'var(--ink)', marginBottom: '20px' }}>
                Add Contact ({contacts.length}/3)
              </p>
              <form onSubmit={addContact} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Name</label>
                    <input {...f('name')} className="field" placeholder="Contact name" required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Phone</label>
                    <input {...f('phone')} className="field" placeholder="+1 555 000 0000" required />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Relationship</label>
                    <input {...f('relationship')} className="field" placeholder="Daughter, Doctor…" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Alert after (days)</label>
                    <input {...f('inactivityDays')} type="number" min={1} max={30} className="field" />
                  </div>
                </div>
                {msg && (
                  <p style={{ fontSize: '14px', color: msg.includes('added') ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>{msg}</p>
                )}
                <button type="submit" disabled={adding} className="shimmer-btn" style={{ width: '100%' }}>
                  {adding ? 'Adding…' : 'Add Contact'}
                </button>
              </form>
            </div>
          </BlurFade>
        )}
      </div>
    </div>
  );
}

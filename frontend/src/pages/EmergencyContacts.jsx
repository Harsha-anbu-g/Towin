import { useEffect, useState } from 'react';
import NavBar from '../components/NavBar';
import api from '../api/axios';

const inputStyle = {
  width: '100%',
  border: '1px solid #d2d2d7',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '15px',
  color: '#1d1d1f',
  outline: 'none',
  background: '#fff',
  fontFamily: 'inherit',
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: '#6e6e73',
  marginBottom: '6px',
};

const card = {
  background: '#fff',
  border: '1px solid #d2d2d7',
  borderRadius: '18px',
  padding: '20px',
};

export default function EmergencyContacts() {
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', relationship: '', inactivityDays: 5 });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const [sosMsg, setSosMsg] = useState('');

  useEffect(() => {
    api.get('/emergency/contacts').then(r => setContacts(r.data)).catch(() => {});
  }, []);

  const f = (key) => ({ value: form[key], onChange: e => setForm(p => ({...p, [key]: e.target.value})) });

  async function addContact(e) {
    e.preventDefault();
    setAdding(true);
    setMsg('');
    try {
      const res = await api.post('/emergency/contacts', {
        ...form,
        inactivityDays: Number(form.inactivityDays),
      });
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
      setSosMsg('SOS sent to all emergency contacts.');
    } catch {
      setSosMsg('Failed to send SOS.');
    }
  }

  return (
    <div style={{ minHeight: '100svh', background: '#f5f5f7' }}>
      <NavBar />
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '24px', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.3px' }}>Emergency Contacts</p>
          <button onClick={triggerSos}
            style={{ background: '#ff3b30', color: '#fff', border: 'none', borderRadius: '9999px', padding: '9px 20px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
            Trigger SOS
          </button>
        </div>

        {sosMsg && (
          <p style={{ fontSize: '14px', color: sosMsg.includes('sent') ? '#155724' : '#c62828' }}>{sosMsg}</p>
        )}

        {contacts.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ fontSize: '14px', color: '#86868b' }}>No emergency contacts yet. Add up to 3.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {contacts.map(c => (
              <div key={c.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 500, fontSize: '15px', color: '#1d1d1f' }}>{c.name}</p>
                  <p style={{ fontSize: '14px', color: '#6e6e73', marginTop: '2px' }}>
                    {c.phone}{c.relationship ? ` · ${c.relationship}` : ''}
                  </p>
                  <p style={{ fontSize: '12px', color: '#86868b', marginTop: '2px' }}>Alert after {c.inactivityDays} inactive days</p>
                </div>
                <button onClick={() => remove(c.id)}
                  style={{ background: 'none', border: '1px solid #d2d2d7', borderRadius: '9999px', padding: '5px 14px', fontSize: '13px', color: '#ff3b30', cursor: 'pointer' }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {contacts.length < 3 && (
          <div style={card}>
            <p style={{ fontSize: '15px', fontWeight: 600, color: '#1d1d1f', marginBottom: '16px' }}>
              Add Contact ({contacts.length}/3)
            </p>
            <form onSubmit={addContact} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input {...f('name')} style={inputStyle} placeholder="Contact name" required
                    onFocus={e => e.target.style.borderColor = '#0066cc'}
                    onBlur={e => e.target.style.borderColor = '#d2d2d7'} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input {...f('phone')} style={inputStyle} placeholder="+1 555 000 0000" required
                    onFocus={e => e.target.style.borderColor = '#0066cc'}
                    onBlur={e => e.target.style.borderColor = '#d2d2d7'} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Relationship (optional)</label>
                  <input {...f('relationship')} style={inputStyle} placeholder="e.g. Daughter, Doctor"
                    onFocus={e => e.target.style.borderColor = '#0066cc'}
                    onBlur={e => e.target.style.borderColor = '#d2d2d7'} />
                </div>
                <div>
                  <label style={labelStyle}>Alert after (days inactive)</label>
                  <input {...f('inactivityDays')} type="number" min={1} max={30} style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#0066cc'}
                    onBlur={e => e.target.style.borderColor = '#d2d2d7'} />
                </div>
              </div>
              {msg && (
                <p style={{ fontSize: '14px', color: msg.includes('.') && msg.includes('Contact') ? '#155724' : '#c62828' }}>{msg}</p>
              )}
              <button type="submit" disabled={adding}
                style={{ width: '100%', background: adding ? '#86868b' : '#0066cc', color: '#fff', border: 'none', borderRadius: '9999px', padding: '12px', fontSize: '15px', fontWeight: 500, cursor: adding ? 'not-allowed' : 'pointer' }}>
                {adding ? 'Adding...' : 'Add Contact'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import NavBar from '../components/NavBar';
import api from '../api/axios';

const INPUT = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300';
const LABEL = 'block text-sm font-medium text-gray-700 mb-1';

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
      setMsg('Contact added!');
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Failed to add contact.');
    } finally {
      setAdding(false);
    }
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
      setSosMsg('SOS sent to all emergency contacts!');
    } catch {
      setSosMsg('Failed to send SOS.');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">🚨 Emergency Contacts</h1>
          <button
            onClick={triggerSos}
            className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700 font-medium">
            Trigger SOS
          </button>
        </div>
        {sosMsg && (
          <p className={`text-sm ${sosMsg.includes('!') ? 'text-green-600' : 'text-red-500'}`}>{sosMsg}</p>
        )}

        {contacts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
            <p className="text-4xl mb-2">📞</p>
            <p>No emergency contacts yet. Add up to 3.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map(c => (
              <div key={c.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.phone}{c.relationship ? ` · ${c.relationship}` : ''}</p>
                  <p className="text-xs text-gray-400">Alert after {c.inactivityDays} inactive days</p>
                </div>
                <button
                  onClick={() => remove(c.id)}
                  className="text-sm text-red-500 hover:text-red-700 px-2 py-1">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {contacts.length < 3 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Add Contact ({contacts.length}/3)</h2>
            <form onSubmit={addContact} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Name</label>
                  <input {...f('name')} className={INPUT} placeholder="Contact name" required />
                </div>
                <div>
                  <label className={LABEL}>Phone</label>
                  <input {...f('phone')} className={INPUT} placeholder="+1 555 000 0000" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Relationship (optional)</label>
                  <input {...f('relationship')} className={INPUT} placeholder="e.g. Daughter, Doctor" />
                </div>
                <div>
                  <label className={LABEL}>Alert after (days inactive)</label>
                  <input {...f('inactivityDays')} type="number" min={1} max={30} className={INPUT} />
                </div>
              </div>
              {msg && (
                <p className={`text-sm ${msg.includes('!') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>
              )}
              <button type="submit" disabled={adding}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {adding ? 'Adding...' : 'Add Contact'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

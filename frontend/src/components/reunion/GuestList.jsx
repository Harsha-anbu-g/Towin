// Steps 3 to 6, the guest list. One row per person; the tools change with the
// step: while finding, a state moves forward one click at a time; on the day,
// "Arrived"; at the send-off, "Home".
import { useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';
import {
  addReunionGuest,
  checkInReunionGuest,
  confirmReunionGuestHome,
  removeReunionGuest,
  reunionErrorLine,
  setReunionGuestState,
} from '../../api/reunions';
import { useToast } from '../../context/useToast';
import { guestStateLabel } from '../../lib/reunionSteps';
import { tr } from '../../i18n';

const NEXT_STATE = { REMEMBERED: 'FOUND', FOUND: 'REACHED', REACHED: 'COMING' };
const chip = {
  background: 'var(--blue-wash)', border: '1px solid var(--blue-soft)', color: 'var(--blue-deep)',
  borderRadius: 'var(--radius-pill)', padding: '8px 14px', minHeight: 40, fontSize: 'var(--text-sm)',
  fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer',
};
const label = { display: 'block', fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', marginBottom: 6 };

function statusLine(guest) {
  if (guest.homeAt) return tr('Home safe');
  if (guest.arrivedAt) return tr('Arrived');
  return guestStateLabel(guest.state);
}

export default function GuestList({ reunion, mode, canEdit, addPrimary = false, onChange }) {
  const { toast } = useToast();
  const guests = Array.isArray(reunion.guests) ? reunion.guests : [];
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);

  async function run(work, fallback) {
    setBusy(true);
    try {
      const fresh = await work();
      onChange?.(fresh);
      return true;
    } catch (err) {
      toast.error(reunionErrorLine(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError(tr('A name, at least.')); return; }
    setError(null);
    const ok = await run(
      () => addReunionGuest({ reunionId: reunion.id, name: name.trim(), phone: phone.trim(), note: note.trim() }),
      tr('Could not save that right now. Please try again.')
    );
    if (ok) { setName(''); setPhone(''); setNote(''); }
  };
  const setState = (g, state) =>
    run(() => setReunionGuestState({ reunionId: reunion.id, guestId: g.id, state }), tr('Could not save that right now. Please try again.'));
  const arrived = (g) => run(() => checkInReunionGuest({ reunionId: reunion.id, guestId: g.id }), tr('Could not save that right now. Please try again.'));
  const home = (g) => run(() => confirmReunionGuestHome({ reunionId: reunion.id, guestId: g.id }), tr('Could not save that right now. Please try again.'));
  const remove = async () => {
    const ok = await run(() => removeReunionGuest({ reunionId: reunion.id, guestId: removing.id }), tr('Could not save that right now. Please try again.'));
    if (ok) setRemoving(null);
  };

  const tools = (g) => {
    if (canEdit && (mode === 'finding' || mode === 'plan')) {
      const next = NEXT_STATE[g.state];
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {next && <button type="button" style={chip} disabled={busy} onClick={() => setState(g, next)}>{guestStateLabel(next)}</button>}
          {g.state === 'CANNOT_COME' ? (
            <button type="button" className="btn-text" disabled={busy} onClick={() => setState(g, 'COMING')}>{tr('Coming after all')}</button>
          ) : (
            <button type="button" className="btn-text" disabled={busy} onClick={() => setState(g, 'CANNOT_COME')}>{tr('Cannot come')}</button>
          )}
          <button type="button" className="btn-text" disabled={busy} onClick={() => setRemoving(g)} aria-label={tr('Take {name} off the list', { name: g.name })}>{tr('Take off')}</button>
        </div>
      );
    }
    if (mode === 'day' && g.state === 'COMING') {
      return g.arrivedAt
        ? <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--green-deep)', margin: '8px 0 0' }}>{tr('Arrived')}</p>
        : <div style={{ marginTop: 8 }}><button type="button" style={chip} disabled={busy} onClick={() => arrived(g)}>{tr('Arrived')}</button></div>;
    }
    if (mode === 'sendoff' && g.arrivedAt) {
      return g.homeAt
        ? <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--green-deep)', margin: '8px 0 0' }}>{tr('Home safe')}</p>
        : <div style={{ marginTop: 8 }}><button type="button" style={chip} disabled={busy} onClick={() => home(g)}>{tr('Home')}</button></div>;
    }
    return null;
  };

  return (
    <section className="card" style={{ padding: 24 }} aria-label={tr('Guests')}>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: 0, fontFamily: 'var(--font-body)' }}>{tr('Guests')}</h2>
      {guests.length === 0 ? (
        <p style={{ color: 'var(--ink-slate)', lineHeight: 1.6, margin: '8px 0 0' }}>
          {canEdit ? tr('Start with the names remembered. One at a time.') : tr('No guests yet.')}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
          {guests.map((g, i) => (
            <li key={g.id ?? `${g.name}-${i}`} style={{ padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{g.name}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--blue-deep)', marginTop: 2 }}>{statusLine(g)}</div>
              {g.phone && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', marginTop: 2 }}>{g.phone}</div>}
              {g.note && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', marginTop: 2, lineHeight: 1.5 }}>{g.note}</div>}
              {tools(g)}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={add} noValidate style={{ display: 'grid', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div>
            <label htmlFor="guest-name" style={label}>{tr('Name')}</label>
            <input id="guest-name" className="field" value={name} onChange={(e) => { setName(e.target.value); if (error) setError(null); }} aria-invalid={!!error} />
            {error && <p role="alert" style={{ fontSize: 'var(--text-sm)', color: 'var(--red-deep)', margin: '6px 0 0' }}>{error}</p>}
          </div>
          <div>
            <label htmlFor="guest-phone" style={label}>{tr('Phone, if known')}</label>
            <input id="guest-phone" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="guest-note" style={label}>{tr('Note')}</label>
            <input id="guest-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} />
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: '6px 0 0' }}>{tr('Mobility, hearing, diet, who has their number. Never money.')}</p>
          </div>
          <div>
            <button type="submit" className={addPrimary ? 'btn-primary' : 'btn-text'} disabled={busy}>{tr('Add to the list')}</button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={!!removing}
        title={removing ? tr('Take {name} off the list?', { name: removing.name }) : ''}
        confirmLabel={tr('Take off')}
        cancelLabel={tr('Keep')}
        danger
        loading={busy}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}

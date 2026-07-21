// Guardian mode (MANAGE_HELP_REQUESTS): the family member asks for help on the
// parent's behalf and closes a request the parent no longer needs.
//
// The list itself is always visible to family — that part was never a power.
// Only the buttons wait on the parent's say-so, and the server checks the grant
// again before it lets anything through, so a power taken back stops working
// even if this screen is still open.
import { useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/useToast';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
/* Project curve, under 300ms, opacity + transform only. The global
   reduced-motion clamp in index.css softens it to almost nothing. */
const OPEN_ANIM = 'fadeSlideUp 200ms cubic-bezier(0.23, 1, 0.32, 1)';

// The same everyday words the parent sees on their own form.
const CATEGORIES = [
  ['COMPANIONSHIP', 'Company'],
  ['TRANSPORTATION', 'Rides'],
  ['ERRANDS', 'Shopping'],
  ['CLEANING', 'Cleaning'],
  ['OTHER', 'Other'],
];

const URGENCIES = [['NORMAL', 'Normal'], ['URGENT', 'Urgent']];

const EMPTY_FORM = { title: '', description: '', category: 'COMPANIONSHIP', urgency: 'NORMAL' };

const chipBtn = (selected) => ({
  minHeight: '44px', padding: '10px 16px',
  border: `1.5px solid ${selected ? 'var(--blue)' : 'var(--border)'}`,
  background: selected ? 'var(--blue-wash)' : 'transparent',
  color: selected ? 'var(--blue-deep)' : 'var(--ink-3)',
  borderRadius: '9999px', cursor: 'pointer',
  fontSize: '16px', fontWeight: 600, fontFamily: SFText,
});

export default function FamilyNeedsForParent({
  elderId,
  elderName,
  openNeeds = [],
  canManage = false,
  onChanged,
}) {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [posting, setPosting] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const parent = elderName || 'your parent';
  const needs = openNeeds || [];

  // Nothing to say: no open requests, and no permission to add one.
  if (!canManage && needs.length === 0) return null;

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  async function postNeed(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormMsg(`Please write what ${parent} needs help with.`);
      return;
    }
    setPosting(true);
    setFormMsg('');
    try {
      await api.post('/needs', {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        urgency: form.urgency,
        // We ask; the server decides. It re-checks the parent's grant and
        // records who really typed this before the request goes out.
        onBehalfOfElderId: elderId,
      });
      setForm(EMPTY_FORM);
      setFormOpen(false);
      toast.success(`Asked for help for ${parent}. Helpers will see you asked for them.`);
      onChanged?.();
    } catch (err) {
      setFormMsg(err?.response?.data?.message || 'Could not send that request. Please try again.');
    } finally {
      setPosting(false);
    }
  }

  async function closeNeed(needId) {
    setConfirmId(null);
    setBusyId(needId);
    try {
      await api.delete(`/needs/${needId}`);
      toast.success(`Closed that request for ${parent}.`);
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not close that request. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ marginTop: '18px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, margin: '0 0 10px' }}>
        {parent}&apos;s open help requests
      </p>

      {canManage && (
        <p style={{ fontSize: '15px', color: 'var(--gold-deep)', fontFamily: SFText, margin: '0 0 12px', lineHeight: 1.5 }}>
          {parent} asked you to handle these for them. Helpers always see your name
          next to theirs on anything you do here.
        </p>
      )}

      {needs.length === 0 && (
        <p style={{ fontSize: '16px', color: 'var(--ink-3)', fontFamily: SFText, margin: '0 0 12px', lineHeight: 1.5 }}>
          {parent} has no open help requests right now.
        </p>
      )}

      {needs.map(n => (
        <div key={n.id} style={{ border: '1px solid var(--border)', borderRadius: '14px', padding: '12px 14px', marginBottom: '10px' }}>
          <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, margin: 0 }}>
            {n.title}
          </p>
          {n.description && (
            <p style={{ fontSize: '15px', color: 'var(--ink-3)', margin: '6px 0 0', lineHeight: 1.5 }}>
              {n.description}
            </p>
          )}
          {n.actedByName && (
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gold-deep)', fontFamily: SFText, margin: '6px 0 0', lineHeight: 1.4 }}>
              Asked by {n.actedByName}, for {parent}
            </p>
          )}

          {canManage && confirmId !== n.id && (
            <button
              type="button"
              onClick={() => setConfirmId(n.id)}
              disabled={busyId === n.id}
              style={{
                marginTop: '10px', minHeight: '44px', padding: '10px 18px',
                background: 'transparent', color: 'var(--ink-3)',
                border: '1.5px solid var(--border)', borderRadius: '9999px',
                fontSize: '16px', fontWeight: 600, fontFamily: SFText,
                cursor: busyId === n.id ? 'default' : 'pointer',
              }}
            >
              {busyId === n.id ? 'Closing…' : `Close this request for ${parent}`}
            </button>
          )}

          {canManage && confirmId === n.id && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
              marginTop: '10px', animation: OPEN_ANIM,
            }}>
              <span style={{ fontSize: '16px', color: 'var(--ink)', fontFamily: SFText, flex: '1 1 180px', lineHeight: 1.4 }}>
                Close this for {parent}? Helpers will stop seeing it.
              </span>
              <button
                type="button"
                onClick={() => closeNeed(n.id)}
                style={{
                  minHeight: '44px', padding: '10px 18px',
                  background: 'var(--blue)', color: '#fff', border: 'none',
                  borderRadius: '9999px', fontSize: '16px', fontWeight: 600,
                  fontFamily: SFText, cursor: 'pointer',
                }}
              >
                Yes, close it
              </button>
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                style={{
                  minHeight: '44px', padding: '10px 18px',
                  background: 'transparent', color: 'var(--ink-3)',
                  border: '1.5px solid var(--border)', borderRadius: '9999px',
                  fontSize: '16px', fontWeight: 600, fontFamily: SFText, cursor: 'pointer',
                }}
              >
                Keep it
              </button>
            </div>
          )}
        </div>
      ))}

      {canManage && !formOpen && (
        <button
          type="button"
          onClick={() => { setFormOpen(true); setFormMsg(''); }}
          style={{
            display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center',
            gap: '8px', minHeight: '44px', marginTop: '4px', padding: '10px 16px',
            background: 'var(--blue)', color: '#fff', border: 'none',
            borderRadius: '9999px', cursor: 'pointer',
            fontSize: '16px', fontWeight: 600, fontFamily: SFText,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Ask for help for {parent}
        </button>
      )}

      {canManage && formOpen && (
        <form
          onSubmit={postNeed}
          style={{
            marginTop: '4px', padding: '14px 16px',
            border: '1px solid var(--sky-line-2)', borderRadius: '14px',
            display: 'flex', flexDirection: 'column', gap: '14px',
            animation: OPEN_ANIM,
          }}
        >
          <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, margin: 0, lineHeight: 1.4 }}>
            Ask for help for {parent}
          </p>

          <div>
            <label htmlFor={`need-title-${elderId}`} style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
              What does {parent} need help with?
            </label>
            <input
              id={`need-title-${elderId}`}
              className="field"
              value={form.title}
              onChange={set('title')}
              placeholder="A ride to the doctor on Tuesday"
            />
          </div>

          <div>
            <label htmlFor={`need-desc-${elderId}`} style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
              Anything else a helper should know? (optional)
            </label>
            <textarea
              id={`need-desc-${elderId}`}
              className="field"
              value={form.description}
              onChange={set('description')}
              rows={3}
              style={{ resize: 'vertical', fontFamily: SFText, fontSize: '16px' }}
            />
          </div>

          <div>
            <p id={`need-cat-${elderId}`} style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' }}>
              What kind of help?
            </p>
            <div role="radiogroup" aria-labelledby={`need-cat-${elderId}`} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CATEGORIES.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={form.category === key}
                  onClick={() => setForm(f => ({ ...f, category: key }))}
                  style={chipBtn(form.category === key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p id={`need-urg-${elderId}`} style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' }}>
              How soon does {parent} need it?
            </p>
            <div role="radiogroup" aria-labelledby={`need-urg-${elderId}`} style={{ display: 'flex', gap: '8px' }}>
              {URGENCIES.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={form.urgency === key}
                  onClick={() => setForm(f => ({ ...f, urgency: key }))}
                  style={chipBtn(form.urgency === key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {formMsg && (
            <p className="danger-text" style={{ fontSize: '16px', fontWeight: 500, margin: 0, lineHeight: 1.4 }}>{formMsg}</p>
          )}

          <p style={{ fontSize: '15px', color: 'var(--gold-deep)', fontFamily: SFText, margin: 0, lineHeight: 1.5 }}>
            This goes out as {parent}&apos;s request, with your name on it as the person who asked.
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={posting}
              style={{
                flex: '1 1 160px', minHeight: '44px', padding: '10px 20px',
                background: 'var(--blue)', color: '#fff', border: 'none',
                borderRadius: '9999px', fontSize: '16px', fontWeight: 600,
                fontFamily: SFText, cursor: posting ? 'default' : 'pointer',
                opacity: posting ? 0.6 : 1,
              }}
            >
              {posting ? 'Sending…' : `Send for ${parent}`}
            </button>
            <button
              type="button"
              onClick={() => { setFormOpen(false); setFormMsg(''); }}
              style={{
                flex: '1 1 120px', minHeight: '44px', padding: '10px 18px',
                background: 'transparent', color: 'var(--ink-3)',
                border: '1.5px solid var(--border)', borderRadius: '9999px',
                fontSize: '16px', fontWeight: 600, fontFamily: SFText, cursor: 'pointer',
              }}
            >
              Never mind
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

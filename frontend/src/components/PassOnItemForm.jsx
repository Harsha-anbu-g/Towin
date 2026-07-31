import { useState } from 'react';
import SmoothInput from './SmoothInput';
import PersonPicker from './PersonPicker';
import { AUDIENCES, LETTERS, NOT_HERE, STORY_BOX } from './passOnLocks';

/**
 * Writing one story, or one letter — and changing one afterwards.
 *
 * It opens in place of the button that started it, so the form's own Save is the
 * only filled button on the screen. Two buttons of equal weight asking "which of
 * these did you mean" is exactly the moment an older person stops.
 *
 * A story picks its audience; a letter does not, because a letter goes to one
 * person and only that person — that is what makes it a letter. Neither offers a
 * choice about when it can be read: the after-you-are-gone half is not built, and
 * a choice that quietly does nothing is worse than no choice at all.
 *
 * Props:
 *   kind    — 'STORY' | 'LETTER'
 *   initial — the item being changed, or null when writing a new one
 *   people  — [{ id, name, note }] for the person picker
 *   saving  — disables the buttons while the save is in flight
 *   onSave({ kind, title, body, audience, audienceUserId })
 *   onCancel()
 */
export default function PassOnItemForm({ kind, initial, people, saving, onSave, onCancel }) {
  const isLetter = kind === 'LETTER';
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [audience, setAudience] = useState(initial?.audience || (isLetter ? 'PERSON' : 'FAMILY'));
  const [personId, setPersonId] = useState(initial?.audienceUserId || null);
  const [problem, setProblem] = useState('');

  const wantsPerson = isLetter || audience === 'PERSON';

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) return setProblem('Please give it a name.');
    if (!body.trim()) return setProblem(isLetter ? 'Please write something before you save it.' : 'Please tell it before you save it.');
    if (wantsPerson && !personId) return setProblem('Please choose the one person this is for.');
    setProblem('');
    onSave({
      kind,
      title: title.trim(),
      body: body.trim(),
      audience: isLetter ? 'PERSON' : audience,
      audienceUserId: wantsPerson ? personId : null,
    });
  }

  const bodyId = `passon-body-${kind.toLowerCase()}`;

  return (
    <form onSubmit={submit} style={cardStyle}>
      <div style={{ marginBottom: '18px' }}>
        <label htmlFor="passon-title" style={labelStyle}>{STORY_BOX.namePrompt}</label>
        <SmoothInput
          id="passon-title"
          className="field"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={isLetter ? 'For Sarah' : STORY_BOX.namePlaceholder}
          maxLength={120}
        />
      </div>

      <div style={{ marginBottom: '18px' }}>
        <label htmlFor={bodyId} style={labelStyle}>
          {isLetter ? LETTERS.bodyPrompt : STORY_BOX.bodyPrompt}
        </label>
        <textarea
          id={bodyId}
          className="field"
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={8}
          maxLength={20000}
          style={{ fontSize: '18px', lineHeight: 1.6, resize: 'vertical', minHeight: '180px' }}
        />
      </div>

      {!isLetter && (
        <p style={{
          fontSize: '16px', color: 'var(--gold-deep)', lineHeight: 1.5,
          margin: '0 0 18px',
        }}>
          {NOT_HERE}
        </p>
      )}

      {!isLetter && (
        <div style={{ marginBottom: wantsPerson ? '18px' : '22px' }}>
          <AudienceCards value={audience} onChange={setAudience} />
        </div>
      )}

      {wantsPerson && (
        <div style={{ marginBottom: '22px' }}>
          <PersonPicker
            people={people}
            value={personId}
            onChange={setPersonId}
            label={LETTERS.personPrompt}
            emptyMessage={LETTERS.noneToWriteTo}
          />
        </div>
      )}

      {problem && (
        <p className="danger-text" role="alert" style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 14px' }}>
          {problem}
        </p>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="submit" disabled={saving} style={{ ...fillBtn, flex: 1, minWidth: '160px' }}>
          {saving ? 'Saving…' : isLetter ? LETTERS.save : STORY_BOX.save}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} style={{ ...ghostBtn, flex: 1, minWidth: '120px' }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** The four audiences, one large tappable card each, in the elder's own words. */
function AudienceCards({ value, onChange }) {
  const onKeyDown = (e) => {
    const keys = AUDIENCES.map(a => a.key);
    const i = keys.indexOf(value);
    let next = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = keys[(i + 1) % keys.length];
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = keys[(i - 1 + keys.length) % keys.length];
    else if (e.key === 'Home') next = keys[0];
    else if (e.key === 'End') next = keys[keys.length - 1];
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    e.currentTarget.closest('[role="radiogroup"]')?.querySelector(`[data-audience="${next}"]`)?.focus();
  };

  return (
    <div>
      <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 10px' }}>
        {STORY_BOX.audiencePrompt}
      </p>
      <div role="radiogroup" aria-label={STORY_BOX.audiencePrompt}
        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {AUDIENCES.map(a => {
          const chosen = value === a.key;
          return (
            <button
              key={a.key}
              type="button"
              role="radio"
              data-audience={a.key}
              aria-checked={chosen}
              tabIndex={chosen ? 0 : -1}
              onClick={() => onChange(a.key)}
              onKeyDown={onKeyDown}
              style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                minHeight: '56px', padding: '12px 16px', borderRadius: '14px',
                border: chosen ? '1.5px solid var(--blue)' : '1px solid var(--border)',
                background: chosen ? 'var(--blue-wash)' : 'var(--canvas)',
                fontFamily: 'inherit',
                transition: 'background-color 140ms cubic-bezier(0.22, 1, 0.36, 1), border-color 140ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <span style={{ display: 'block', fontSize: '17px', fontWeight: 600, color: 'var(--ink)' }}>
                {a.title}
              </span>
              <span style={{ display: 'block', fontSize: '16px', color: 'var(--ink-3)', lineHeight: 1.45, marginTop: '2px' }}>
                {a.blurb}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const cardStyle = {
  background: 'var(--canvas)',
  borderRadius: '18px',
  border: '1px solid var(--border)',
  padding: '22px 24px',
  marginBottom: '14px',
};

const labelStyle = {
  display: 'block',
  fontSize: '17px',
  fontWeight: 600,
  color: 'var(--ink)',
  marginBottom: '8px',
};

const fillBtn = {
  background: 'var(--action-fill)',
  color: 'var(--action-ink)',
  border: 'none',
  borderRadius: '9999px',
  padding: '10px 20px',
  minHeight: '48px',
  fontSize: '17px',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const ghostBtn = {
  background: 'transparent',
  color: 'var(--ink-3)',
  border: '1.5px solid var(--border)',
  borderRadius: '9999px',
  padding: '10px 18px',
  minHeight: '48px',
  fontSize: '17px',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

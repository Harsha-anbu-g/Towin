import { useState } from 'react';
import SmoothInput from './SmoothInput';
import { SEALED_ITEMS, SEALED_KINDS } from './passOnLocks';

/**
 * Putting one thing into the Sealed box.
 *
 * It opens in place of the button that started it, so its own [Lock this away] is the only
 * filled button on the tab. Two buttons of equal weight asking "which of these did you mean"
 * is exactly the moment an older person stops.
 *
 * <b>The name is asked for with its promise attached.</b> "Nobody else ever sees this name,
 * not even your Keyholders" is not reassurance — it is what the database does. There is no
 * readable label column; the name is encrypted under the same key as the words. Saying so at
 * the moment she types it is the difference between her writing "Where the money is" and her
 * writing "Thing 1".
 *
 * <b>Nothing is edited afterwards.</b> There is no change flow here on purpose: an edit would
 * have to decrypt, show and re-encrypt, which is a second path that displays a secret. She
 * takes it out and puts a new one in, and the one path that ever shows her words stays one.
 *
 * Props:
 *   saving — disables the buttons while the save is in flight
 *   onSave({ label, body, kindHint })
 *   onCancel()
 */
export default function SealedItemForm({ saving, onSave, onCancel }) {
  const [label, setLabel] = useState('');
  const [body, setBody] = useState('');
  const [kindHint, setKindHint] = useState(null);
  const [problem, setProblem] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!label.trim()) return setProblem(SEALED_ITEMS.needsName);
    if (!body.trim()) return setProblem(SEALED_ITEMS.needsBody);
    // Asked for rather than defaulted. The chip is the one readable thing about the item and
    // it ends up on the copy her family reads, so a quiet default would file "where the money
    // is" under whatever this form happened to pick.
    if (!kindHint) return setProblem(SEALED_ITEMS.needsKind);
    setProblem('');
    onSave({ label: label.trim(), body: body.trim(), kindHint });
  }

  return (
    <form onSubmit={submit} style={cardStyle}>
      <div style={{ marginBottom: '18px' }}>
        <label htmlFor="sealed-label" style={labelStyle}>{SEALED_ITEMS.namePrompt}</label>
        <p id="sealed-label-help" style={helpStyle}>{SEALED_ITEMS.nameHelp}</p>
        <SmoothInput
          id="sealed-label"
          className="field"
          aria-describedby="sealed-label-help"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder={SEALED_ITEMS.namePlaceholder}
          maxLength={120}
        />
      </div>

      <div style={{ marginBottom: '18px' }}>
        <label htmlFor="sealed-body" style={labelStyle}>{SEALED_ITEMS.bodyPrompt}</label>
        <textarea
          id="sealed-body"
          className="field"
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={6}
          maxLength={20000}
          style={{ fontSize: '18px', lineHeight: 1.6, resize: 'vertical', minHeight: '150px' }}
        />
      </div>

      <div style={{ marginBottom: '22px' }}>
        <KindChips value={kindHint} onChange={setKindHint} />
      </div>

      {problem && (
        <p className="danger-text" role="alert" style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 14px' }}>
          {problem}
        </p>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="submit" disabled={saving} style={{ ...fillBtn, flex: 1, minWidth: '180px' }}>
          {saving ? SEALED_ITEMS.saving : SEALED_ITEMS.save}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} style={{ ...ghostBtn, flex: 1, minWidth: '120px' }}>
          {SEALED_ITEMS.cancel}
        </button>
      </div>
    </form>
  );
}

/**
 * The four kinds, as chips. Small on purpose — this is filing, not the decision the screen is
 * about — but still 48px tall and arrow-key navigable like every other choice in the app.
 */
function KindChips({ value, onChange }) {
  const keys = Object.keys(SEALED_KINDS);

  const onKeyDown = (e) => {
    const i = keys.indexOf(value);
    let next = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = keys[(i + 1) % keys.length];
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = keys[(i - 1 + keys.length) % keys.length];
    else if (e.key === 'Home') next = keys[0];
    else if (e.key === 'End') next = keys[keys.length - 1];
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    e.currentTarget.closest('[role="radiogroup"]')?.querySelector(`[data-kind="${next}"]`)?.focus();
  };

  return (
    <div>
      <p style={labelStyle}>{SEALED_ITEMS.kindPrompt}</p>
      <div role="radiogroup" aria-label={SEALED_ITEMS.kindPrompt}
        style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {keys.map((key, i) => {
          const chosen = value === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              data-kind={key}
              aria-checked={chosen}
              tabIndex={chosen || (value == null && i === 0) ? 0 : -1}
              onClick={() => onChange(key)}
              onKeyDown={onKeyDown}
              style={{
                minHeight: '48px', padding: '10px 18px', borderRadius: '9999px', cursor: 'pointer',
                fontSize: '17px', fontWeight: 600, fontFamily: 'inherit',
                color: chosen ? 'var(--blue-deep)' : 'var(--ink-3)',
                border: chosen ? '1.5px solid var(--blue)' : '1px solid var(--border)',
                background: chosen ? 'var(--blue-wash)' : 'var(--canvas)',
                transition: 'background-color 140ms cubic-bezier(0.22, 1, 0.36, 1), border-color 140ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {SEALED_KINDS[key]}
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
  margin: '0 0 8px',
};

const helpStyle = {
  fontSize: '16px',
  color: 'var(--ink-3)',
  lineHeight: 1.5,
  margin: '0 0 10px',
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

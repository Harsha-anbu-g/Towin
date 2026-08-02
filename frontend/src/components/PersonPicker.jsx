/**
 * Pick one person, from the people this elder actually knows here.
 *
 * The app's first person picker. It is deliberately a list of large, plainly
 * labelled rows rather than a dropdown: a select collapses to a control the
 * width of one name, hides everyone until it is opened, and on a phone hands the
 * choice to a native wheel that shows three rows at a time. The people on this
 * list are the elder's daughter and the helper she trusts — they are worth a
 * whole row each.
 *
 * Semantics are a real radio group with roving focus, so arrow keys move between
 * people and a screen reader announces "2 of 3" without any extra markup.
 *
 * Props:
 *   people  — [{ id, name, note }]; `note` is the quiet second line ("Daughter")
 *   value   — the chosen id, or null
 *   onChange(id)
 *   label   — the question this list answers, e.g. "Who is this for?"
 *   emptyMessage — shown instead of the list when nobody is available
 */
export default function PersonPicker({ people, value, onChange, label, emptyMessage }) {
  if (!people.length) {
    return (
      <div>
        <p style={promptStyle}>{label}</p>
        <p style={{ fontSize: '16px', color: 'var(--ink-3)', lineHeight: 1.5, margin: 0 }}>
          {emptyMessage}
        </p>
      </div>
    );
  }

  const onKeyDown = (e) => {
    const ids = people.map(p => p.id);
    const i = ids.indexOf(value);
    let next = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = ids[(i + 1) % ids.length];
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = ids[(i - 1 + ids.length) % ids.length];
    else if (e.key === 'Home') next = ids[0];
    else if (e.key === 'End') next = ids[ids.length - 1];
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    e.currentTarget.closest('[role="radiogroup"]')?.querySelector(`[data-person="${next}"]`)?.focus();
  };

  return (
    <div>
      <p style={promptStyle} id={`person-picker-${label.replace(/\W+/g, '-').toLowerCase()}`}>{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
      >
        {people.map((person, index) => {
          const chosen = value === person.id;
          return (
            <button
              key={person.id}
              type="button"
              role="radio"
              data-person={person.id}
              aria-checked={chosen}
              tabIndex={chosen || (value == null && index === 0) ? 0 : -1}
              onClick={() => onChange(person.id)}
              onKeyDown={onKeyDown}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                width: '100%', minHeight: '56px', padding: '10px 16px',
                textAlign: 'left', cursor: 'pointer',
                borderRadius: '14px',
                border: chosen ? '1.5px solid var(--blue)' : '1px solid var(--border)',
                background: chosen ? 'var(--blue-wash)' : 'var(--canvas)',
                fontFamily: 'inherit',
                transition: 'background-color 140ms cubic-bezier(0.22, 1, 0.36, 1), border-color 140ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <Mark chosen={chosen} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '17px', fontWeight: 600, color: 'var(--ink)' }}>
                  {person.name}
                </span>
                {person.note && (
                  <span style={{ display: 'block', fontSize: '15px', color: 'var(--ink-3)', marginTop: '1px' }}>
                    {person.note}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const promptStyle = {
  fontSize: '17px',
  fontWeight: 600,
  color: 'var(--ink)',
  margin: '0 0 10px',
};

// A drawn ring, never a text glyph — a ✓ character reads as a placeholder.
function Mark({ chosen }) {
  return (
    <span aria-hidden="true" style={{
      width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
      border: chosen ? '1.5px solid var(--blue)' : '1.5px solid var(--border)',
      background: chosen ? 'var(--blue)' : 'transparent',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {chosen && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--action-ink)"
          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </span>
  );
}

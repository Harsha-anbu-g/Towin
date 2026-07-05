import { useRef, useState } from 'react';

const SKY = 'var(--blue)';
const SKY_TINT = 'rgba(79,163,206,0.12)';
const SKY_BORDER = 'rgba(79,163,206,0.28)';

export default function TagInput({ value = [], onChange, placeholder = 'Type and press Enter…', style }) {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef(null);

  function addTag(raw) {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) return;
    onChange([...value, tag]);
  }

  function removeTag(idx) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(inputVal);
      setInputVal('');
    } else if (e.key === 'Backspace' && inputVal === '' && value.length > 0) {
      removeTag(value.length - 1);
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        padding: '10px 12px',
        border: '1.5px solid var(--hairline-2)',
        borderRadius: '12px',
        background: 'var(--canvas)',
        cursor: 'text',
        minHeight: '46px',
        alignItems: 'center',
        ...style,
      }}
    >
      {value.map((tag, i) => (
        <span key={i} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          background: SKY_TINT,
          border: `1px solid ${SKY_BORDER}`,
          color: SKY,
          borderRadius: '9999px',
          padding: '3px 10px 3px 12px',
          fontSize: '14px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          {tag}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); removeTag(i); }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: SKY,
              padding: '0',
              lineHeight: 1,
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.7,
            }}
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ''}
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: '16px',
          color: 'var(--ink)',
          minWidth: '120px',
          flex: 1,
          padding: '2px 0',
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

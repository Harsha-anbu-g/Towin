import { useState } from 'react';

const toInitials = (name) =>
  name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

export default function Avatar({ name, photoUrl, size = 48, borderRadius = '50%' }) {
  const [imgFailed, setImgFailed] = useState(false);
  const base = { width: size, height: size, borderRadius, flexShrink: 0 };

  if (photoUrl && !imgFailed) {
    return (
      <img
        src={photoUrl}
        alt=""
        style={{ ...base, objectFit: 'cover' }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div style={{
      ...base,
      background: 'var(--slate-tint)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.35), fontWeight: 700, color: 'var(--ink-slate)',
    }}>
      {toInitials(name)}
    </div>
  );
}

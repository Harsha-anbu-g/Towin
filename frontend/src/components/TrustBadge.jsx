const TIER_COLORS = {
  'Community Champion': { bg: '#EAF5FB', color: '#3D8AB0', border: '#BFD9EA' },
  'Highly Trusted':     { bg: '#EAF5FB', color: '#3D8AB0', border: '#BFD9EA' },
  'Reliable':           { bg: '#EAF5FB', color: '#3D8AB0', border: '#BFD9EA' },
  'Getting Started':    { bg: '#EAF5FB', color: '#4FA3CE', border: '#BFD9EA' },
  'New Member':         { bg: '#f5f5f7', color: '#a0a0a5', border: '#e0e0e0' },
};

export default function TrustBadge({ tier, score }) {
  const c = TIER_COLORS[tier] ?? TIER_COLORS['New Member'];
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        fontSize: '11px',
        fontWeight: 600,
        fontFamily: 'var(--font-body)',
        padding: '2px 8px',
        borderRadius: '9999px',
        letterSpacing: '0.1px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {tier ?? 'New Member'}
      {score != null && <span style={{ opacity: 0.55, fontWeight: 400 }}>· {score}</span>}
    </span>
  );
}

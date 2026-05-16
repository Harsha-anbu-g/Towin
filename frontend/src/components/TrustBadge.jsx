const TIER_COLORS = {
  'Community Champion': { bg: 'rgba(124,58,237,0.1)', color: '#7c3aed', border: 'rgba(124,58,237,0.2)' },
  'Highly Trusted':     { bg: 'rgba(245,158,11,0.1)', color: '#b45309', border: 'rgba(245,158,11,0.2)' },
  'Reliable':           { bg: 'rgba(34,197,94,0.1)',  color: '#15803d', border: 'rgba(34,197,94,0.2)' },
  'Getting Started':    { bg: 'rgba(37,99,235,0.08)', color: '#2563eb', border: 'rgba(37,99,235,0.2)' },
  'New Member':         { bg: 'rgba(148,163,184,0.1)', color: '#64748b', border: 'rgba(148,163,184,0.2)' },
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

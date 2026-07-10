const TRUST = 'var(--ink-slate)';

const TIER_COLORS = {
  // Top tier earns the leaf-green achievement color (matches "Fully Trusted").
  'Community Champion': { bg: 'var(--green-tint)', color: 'var(--green-deep)', border: 'var(--green-line)' },
  'Highly Trusted':     { bg: 'var(--grey-fill)', color: TRUST, border: 'var(--hairline-2)' },
  'Reliable':           { bg: 'var(--grey-fill)', color: TRUST, border: 'var(--hairline-2)' },
  'Getting Started':    { bg: 'var(--grey-fill)', color: TRUST, border: 'var(--hairline-2)' },
  'New Member':         { bg: 'var(--grey-fill)', color: 'var(--ink-4)', border: 'var(--hairline-2)' },
};

export default function TrustBadge({ tier, score }) {
  const c = TIER_COLORS[tier] ?? TIER_COLORS['New Member'];
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        fontSize: '13px',
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

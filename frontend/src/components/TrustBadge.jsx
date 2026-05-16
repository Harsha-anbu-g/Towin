const TIER_COLORS = {
  'Community Champion': { bg: '#f0e6ff', color: '#6200ea' },
  'Highly Trusted':     { bg: '#fff3cd', color: '#b45309' },
  'Reliable':           { bg: '#d4edda', color: '#155724' },
  'Getting Started':    { bg: '#d6e8ff', color: '#004499' },
  'New Member':         { bg: '#f2f2f7', color: '#6e6e73' },
};

export default function TrustBadge({ tier, score }) {
  const colors = TIER_COLORS[tier] ?? TIER_COLORS['New Member'];
  return (
    <span
      style={{
        background: colors.bg,
        color: colors.color,
        fontSize: '12px',
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: '9999px',
        letterSpacing: '0',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {tier ?? 'New Member'}
      <span style={{ opacity: 0.6 }}>· {score ?? 0}</span>
    </span>
  );
}

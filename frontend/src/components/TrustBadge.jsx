const TIER_STYLES = {
  'Community Champion': 'bg-purple-100 text-purple-700',
  'Highly Trusted':     'bg-yellow-100 text-yellow-700',
  'Reliable':           'bg-green-100 text-green-700',
  'Getting Started':    'bg-blue-100 text-blue-700',
  'New Member':         'bg-gray-100 text-gray-600',
};

export default function TrustBadge({ tier, score }) {
  const style = TIER_STYLES[tier] ?? TIER_STYLES['New Member'];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style}`}>
      {tier ?? 'New Member'} · {score ?? 0}
    </span>
  );
}

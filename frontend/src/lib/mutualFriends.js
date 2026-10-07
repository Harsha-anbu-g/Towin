// The "You both know" line on an Add Friends card, from the backend's
// mutualFriends (up to three people from the viewer's own circle) and
// mutualCount (how many family members and friends the two share in all).

function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function labelOf(m) {
  if (m.relation === 'FAMILY') return `${m.name} (your ${(m.relationship || 'family').toLowerCase()})`;
  return m.name;
}

export function mutualFriendsText(mutualFriends, mutualCount = 0) {
  const list = Array.isArray(mutualFriends) ? mutualFriends.filter(m => m?.name) : [];
  const direct = list.filter(m => m.relation !== 'THROUGH').map(labelOf);
  const through = list.filter(m => m.relation === 'THROUGH').map(m => m.name);
  const parts = [];
  if (direct.length) {
    const more = Math.max(0, (mutualCount || 0) - direct.length);
    const names = more > 0 ? [...direct, `${more} more`] : direct;
    parts.push(`You both know ${joinNames(names)}`);
  }
  if (through.length) {
    parts.push(`${direct.length ? 'Also known' : 'Known'} through ${joinNames(through)}`);
  }
  return parts.join('. ');
}

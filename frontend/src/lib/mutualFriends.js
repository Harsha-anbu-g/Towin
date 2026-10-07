// The "You both know" line on an Add Friends card, from the backend's
// mutualFriends (up to three people from the viewer's own circle) and
// mutualCount (how many family members and friends the two share in all).
import { tr } from '../i18n';

function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return tr('{first} and {last}', { first: names.slice(0, -1).join(', '), last: names[names.length - 1] });
}

function labelOf(m) {
  if (m.relation !== 'FAMILY') return m.name;
  // The family word is the elder's own ("Daughter"), so it is shown as written.
  return m.relationship
    ? tr('{name} (your {relationship})', { name: m.name, relationship: m.relationship.toLowerCase() })
    : tr('{name} (your family)', { name: m.name });
}

export function mutualFriendsText(mutualFriends, mutualCount = 0) {
  const list = Array.isArray(mutualFriends) ? mutualFriends.filter((m) => m?.name) : [];
  const direct = list.filter((m) => m.relation !== 'THROUGH').map(labelOf);
  const through = list.filter((m) => m.relation === 'THROUGH').map((m) => m.name);
  const parts = [];
  if (direct.length) {
    const more = Math.max(0, (mutualCount || 0) - direct.length);
    const names = more > 0 ? [...direct, tr('{count} more', { count: more })] : direct;
    parts.push(tr('You both know {names}', { names: joinNames(names) }));
  }
  if (through.length) {
    const names = joinNames(through);
    parts.push(direct.length ? tr('Also known through {names}', { names }) : tr('Known through {names}', { names }));
  }
  return parts.join('. ');
}

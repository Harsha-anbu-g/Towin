import { Link } from 'react-router-dom';
import { familyNamesLabel } from '../lib/copy';

const SFT = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

/**
 * Who today's check-in reaches. Sits directly under the check-in button — the
 * reason the button exists, not a footnote.
 *
 * With nobody linked (the common case at launch) this becomes a quiet
 * invitation. Never a warning, never an empty state: an elder with no family on
 * Towinly is not doing anything wrong.
 */
export default function CheckInFamilyNote({ names, checkedIn }) {
  const label = familyNamesLabel(names);

  if (!label) {
    return (
      <p style={{
        textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--ink-4)',
        fontFamily: SFT, lineHeight: 1.5, margin: '12px 0 0',
      }}>
        <Link to="/family" style={{ color: 'var(--blue-deep)', fontWeight: 600 }}>
          Add your family
        </Link>{' '}
        and they will see you checked in.
      </p>
    );
  }

  return (
    <p aria-live="polite" style={{
      textAlign: 'center', fontSize: 'var(--text-sm)', fontWeight: 600,
      color: checkedIn ? 'var(--green-deep)' : 'var(--ink-3)',
      fontFamily: SFT, lineHeight: 1.5, margin: '12px 0 0',
    }}>
      {checkedIn ? `${label} can see you checked in.` : `${label} will see this.`}
    </p>
  );
}

// US-004 (Step 3): family-side updates thread on the shared helper journey
// card (FamilyHome). The thread only exists once the friendship reaches
// FIRST_MEET; the card opens it on demand so the page stays calm and only
// the opened thread polls. Replies go to the shared FAMILY_UPDATES feed
// the elder always sees.
import FamilyThreadLink from './FamilyThreadLink';
import { tr } from '../i18n';

// stageIndex mirrors backend TrustLevel values (FIRST_MEET = 5).
const FIRST_MEET_STAGE = 5;

export default function FamilyHelperUpdates({ helper, elderName }) {
  if ((helper?.stageIndex ?? 0) < FIRST_MEET_STAGE) return null;

  const helperName = helper.helperName || tr('the helper');

  return (
    <div style={{ marginTop: '10px' }}>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: '0 0 8px', lineHeight: 1.5 }}>
        {tr('{elderName} and {helperName} read these notes too.', { elderName: elderName || tr('Your parent'), helperName })}
      </p>
      <FamilyThreadLink connectionId={helper.connectionId} />
    </div>
  );
}

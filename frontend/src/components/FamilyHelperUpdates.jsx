// US-004 (Step 3): family-side updates thread on the shared helper journey
// card (FamilyHome). The thread only exists once the friendship reaches
// FIRST_MEET; the card opens it on demand so the page stays calm and only
// the opened thread polls. Replies go to the shared FAMILY_UPDATES feed
// the elder always sees.
import { useState } from 'react';
import FamilyUpdatesThread from './FamilyUpdatesThread';

// stageIndex mirrors backend TrustLevel values (FIRST_MEET = 5).
const FIRST_MEET_STAGE = 5;

export default function FamilyHelperUpdates({ helper, elderName }) {
  const [open, setOpen] = useState(false);

  if ((helper?.stageIndex ?? 0) < FIRST_MEET_STAGE) return null;

  const helperName = helper.helperName || 'the helper';

  return (
    <div style={{ marginTop: '10px' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          height: '44px', padding: '0 16px', borderRadius: '9999px',
          background: 'var(--blue-wash)', color: 'var(--blue-deep)',
          border: '1px solid var(--blue-soft)', fontSize: 'var(--text-sm)',
          fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: '7px',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        {open ? 'Hide updates' : 'Open updates'}
      </button>

      {open && (
        <div style={{ marginTop: '12px' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: '0 0 10px', lineHeight: 1.5 }}>
            {elderName || 'Your parent'} and {helperName} read these notes too.
          </p>
          <FamilyUpdatesThread
            connectionId={helper.connectionId}
            placeholder="Say thank you or ask how it went"
            emptyText={`No updates yet. After a visit, ${helperName} can write how it went.`}
            sendLabel="Send"
          />
        </div>
      )}
    </div>
  );
}

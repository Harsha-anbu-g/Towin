// US-003 (Step 3): the helper-side "Updates for the family" section.
// Rendered on the helper's connection card ONLY while the double gate holds:
// connection ACTIVE + elder shared it with family + trust >= FIRST_MEET.
// Note-led, not chat-led — the composer leads with a post-visit prompt and
// the helper always sees exactly who reads what they write.
import FamilyUpdatesThread from './FamilyUpdatesThread';

const TRUST_LEVEL_ORDER = {
  DISCOVERED: 1, MESSAGING: 2, PHONE_CALL: 3, VIDEO_CALL: 4,
  VERIFIED: 5, FIRST_MEET: 6, TRUSTED: 7,
};

const gateHolds = (conn) =>
  conn?.status === 'ACTIVE' &&
  conn?.sharedWithFamily === true &&
  (TRUST_LEVEL_ORDER[conn?.currentTrustLevel] ?? 0) >= TRUST_LEVEL_ORDER.FIRST_MEET;

export default function HelperFamilyUpdates({ conn }) {
  if (!gateHolds(conn)) return null;

  const elderName = conn.otherUserName || 'they';

  return (
    <div style={{ borderTop: '1px solid var(--hairline)', marginTop: '14px', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Updates for the family
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', margin: '4px 0 0' }}>
          Their family and {elderName} can read these notes.
        </p>
      </div>
      <FamilyUpdatesThread
        connectionId={conn.id}
        placeholder="Write a short note about how things went"
        emptyText="No notes yet. After a visit, write how it went."
        sendLabel="Share note"
      />
    </div>
  );
}

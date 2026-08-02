import { DRAFT } from '../lib/legalCopy';

/**
 * The honest line at the top of the Terms of Service and the Privacy Policy, on the pages and
 * in the signup modals alike.
 *
 * It replaced an eyebrow reading "Placeholder document" and a sentence inside the terms
 * themselves saying "This is a placeholder document. Final terms will be reviewed by counsel
 * before launch." Both told a person to distrust what they were being asked to agree to
 * without telling them anything they could use. This says who wrote the page, what is missing
 * from it, and when it was written.
 *
 * A plain surface, not a warning colour: it is a statement of fact about the page, not an
 * alarm, and every person who signs up reads it.
 */
export default function LegalDraftNotice() {
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '16px 18px',
        marginBottom: '32px',
      }}
    >
      <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
        {DRAFT.eyebrow}
      </p>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--ink-slate-2)', lineHeight: 1.6, margin: 0 }}>
        {DRAFT.body}
      </p>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)', margin: '10px 0 0' }}>
        {DRAFT.asOf}
      </p>
    </div>
  );
}

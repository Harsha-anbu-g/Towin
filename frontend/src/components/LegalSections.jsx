/**
 * Renders the Terms of Service and the Privacy Policy from lib/legalCopy.js.
 *
 * One renderer for both surfaces so the document a person ticks a box against at signup and
 * the document they look up two years later are the same words in the same order. Two looks:
 * the standalone page at the site's body size, and `compact` for the signup modal, which keeps
 * the smaller type that modal already used. The only structural rule either look must hold to
 * is that a heading and its paragraph stay inside one element — the corrected security wording
 * is asserted through `heading.parentElement` in pages/Register.privacy-copy.test.jsx.
 *
 * @param sections from `termsSections(email)` / `privacySections(email)`. A section carrying an
 *   `email` gets it appended as a mailto link, so an elder can tap the address rather than copy
 *   it out. A section without one is complete as it stands: on a deployment with no address
 *   configured the sentence itself says so, and nothing here invents one to fill the gap.
 */
export default function LegalSections({ sections, compact = false }) {
  const Heading = compact ? 'h4' : 'h2';
  const headingStyle = compact
    ? { fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }
    : { fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 12 };
  const bodyStyle = compact
    ? { fontSize: 'var(--text-sm)', color: 'var(--ink-slate-2)', lineHeight: 1.6, margin: 0 }
    : {};

  return sections.map(section => (
    <section key={section.h} style={{ marginBottom: compact ? 20 : 32 }}>
      <Heading style={headingStyle}>{section.h}</Heading>
      <p style={bodyStyle}>
        {section.p}
        {section.email && (
          <>
            {' '}
            <a href={`mailto:${section.email}`} style={{ color: 'var(--blue-deep)' }}>
              {section.email}
            </a>
            .
          </>
        )}
      </p>
    </section>
  ));
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import api from '../api/axios';
import { useToast } from '../context/useToast';
import { SHEET, onDayInFull } from '../components/passOnLocks';
import { buildSheet, sheetAsText, sheetFileName } from '../components/passOnSheet';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

/**
 * Her saved one-page copy.
 *
 * <b>This page exists to be left behind.</b> Everything else in this feature works only while
 * Towinly does; this is the answer to "and what if it does not". So the whole page is one
 * action — save the file — and the copy she is about to save is shown above it, in full,
 * because a document you are asked to keep for the rest of your life should not be downloaded
 * blind.
 *
 * <b>Digital only, deliberately.</b> No print button, no print stylesheet, no PDF. The owner
 * ruled the sheet digital-only on 2026-07-30 and a test holds it there — the one page where
 * somebody would reasonably add a print control is exactly the page where the decision was
 * made not to.
 *
 * <b>Nothing on this page is a secret.</b> The server builds it on the same list that shows
 * her what is in her box by name, which never decrypts a body. There is no password gate for
 * that reason: asking an elder to type her password to be told the names of her own things
 * would teach her to type it whenever anything asks.
 */
export default function PassOnSheet() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const load = useCallback(() => {
    api.get('/passon/sheet')
      .then((response) => {
        setData(response.data);
        setSavedAt(response.data?.lastSavedAt || null);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * Hands the file to the browser, then tells the server she has a copy.
   *
   * The order is the design: the download is what matters and it happens first, so a server
   * that is having a bad afternoon cannot stop her taking her own copy away. Recording it is a
   * courtesy to the line below, and its failure is silent for the same reason.
   */
  async function save() {
    let url = null;
    try {
      const text = sheetAsText(buildSheet(data));
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = sheetFileName(data.ownerName);
      link.click();

      toast.success(SHEET.saved);
    } catch {
      toast.error(SHEET.failedToSave);
      return;
    } finally {
      if (url) URL.revokeObjectURL(url);
    }

    try {
      await api.post('/passon/sheet/saved');
      setSavedAt(new Date().toISOString());
    } catch {
      // She has the file. Whether we managed to write down that she has it is our problem,
      // and interrupting her with it would be about us rather than about her.
    }
  }

  const sheet = data ? buildSheet(data) : null;

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>
      <NavBar />

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 24px 60px' }}>
        <BlurFade delay={2}>
          <Link to="/what-i-pass-on?tab=sealed" style={backLink}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {SHEET.back}
          </Link>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em',
            fontSize: 'var(--text-xl)', color: 'var(--ink)', margin: '14px 0 0',
          }}>
            {SHEET.pageTitle}
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--ink-3)', lineHeight: 1.55, margin: '8px 0 0' }}>
            {SHEET.pageLead}
          </p>
        </BlurFade>

        {failed && <Plain>{SHEET.failed}</Plain>}
        {!failed && !sheet && <Plain>{SHEET.loading}</Plain>}

        {sheet && (
          <BlurFade delay={3}>
            {/* The one action on the page, above the copy rather than below it: she should not
                have to read to the bottom of a long document to find the button that saves it. */}
            <div style={saveRow}>
              <p style={savedLine}>
                {savedAt ? SHEET.lastSaved(onDayInFull(savedAt)) : SHEET.neverSaved}
              </p>
              <button type="button" onClick={save} style={fillBtn}>
                {SHEET.save}
              </button>
            </div>

            <h2 style={previewHeading}>{SHEET.previewHeading}</h2>

            {/* The copy itself, drawn from the same structure the file is written from. A line
                that appears here appears there; neither can gain a line the other lacks. */}
            <article style={paper} aria-label={sheet.title}>
              <h3 style={sheetTitle}>{sheet.title}</h3>
              <p style={madeOn}>{sheet.madeOn}</p>

              {sheet.sections.map(section => (
                <section key={section.heading} style={sectionStyle}>
                  <h4 style={sectionHeading}>{section.heading}</h4>
                  {section.blurb && <p style={bodyLine}>{section.blurb}</p>}

                  {section.lines.length === 0 && section.empty
                    ? <p style={bodyLine}>{section.empty}</p>
                    : (
                      <>
                        {section.listLead && <p style={bodyLine}>{section.listLead}</p>}
                        <ul style={list}>
                          {section.lines.map(line => (
                            <li key={line} style={listItem}>{line}</li>
                          ))}
                        </ul>
                      </>
                    )}

                  {section.note && <p style={bodyLine}>{section.note}</p>}
                </section>
              ))}

              <p style={closing}>{sheet.closing}</p>
            </article>
          </BlurFade>
        )}
      </main>
    </div>
  );
}

function Plain({ children }) {
  return (
    <div style={{
      background: 'var(--canvas)', border: '1px solid var(--hairline-2)', borderRadius: '18px',
      padding: '28px 24px', marginTop: '20px',
    }}>
      <p style={{ fontSize: '17px', color: 'var(--ink-slate)', lineHeight: 1.6, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

const backLink = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  minHeight: '44px',
  fontSize: '16px',
  color: 'var(--blue)',
  textDecoration: 'none',
};

const saveRow = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  flexWrap: 'wrap',
  background: 'var(--canvas)',
  border: '1px solid var(--border)',
  borderRadius: '18px',
  padding: '18px 20px',
  marginTop: '22px',
};

const savedLine = {
  flex: 1,
  minWidth: '200px',
  fontSize: '16px',
  color: 'var(--ink-slate)',
  lineHeight: 1.5,
  margin: 0,
};

const previewHeading = {
  fontSize: '15px',
  fontWeight: 600,
  fontFamily: SF,
  color: 'var(--ink-3)',
  letterSpacing: '0.02em',
  margin: '28px 0 10px',
};

/**
 * The copy itself, set apart from the app around it — a slightly warmer surface and a hairline,
 * so it reads as the document she is about to keep rather than as another panel of the page.
 */
const paper = {
  background: 'var(--canvas)',
  border: '1px solid var(--border)',
  borderRadius: '18px',
  padding: '28px 24px',
};

const sheetTitle = {
  fontFamily: 'var(--font-display)',
  fontWeight: 400,
  letterSpacing: '-0.02em',
  fontSize: 'var(--text-lg)',
  color: 'var(--ink)',
  margin: 0,
};

const madeOn = {
  fontSize: '15px',
  color: 'var(--ink-3)',
  lineHeight: 1.5,
  margin: '6px 0 0',
};

const sectionStyle = {
  marginTop: '26px',
  paddingTop: '20px',
  borderTop: '1px solid var(--hairline)',
};

const sectionHeading = {
  fontSize: '17px',
  fontWeight: 600,
  fontFamily: SF,
  color: 'var(--ink)',
  margin: 0,
};

const bodyLine = {
  fontSize: '16px',
  color: 'var(--ink-slate)',
  lineHeight: 1.6,
  margin: '10px 0 0',
};

const list = {
  listStyle: 'none',
  margin: '12px 0 0',
  padding: 0,
};

const listItem = {
  fontSize: '17px',
  color: 'var(--ink)',
  lineHeight: 1.55,
  padding: '8px 0 8px 14px',
  borderLeft: '2px solid var(--gold-deep)',
  marginBottom: '8px',
};

const closing = {
  fontFamily: 'var(--font-display)',
  fontWeight: 400,
  letterSpacing: '-0.02em',
  fontSize: '20px',
  color: 'var(--ink)',
  margin: '26px 0 0',
  paddingTop: '20px',
  borderTop: '1px solid var(--hairline)',
};

const fillBtn = {
  background: 'var(--action-fill)',
  color: 'var(--action-ink)',
  border: 'none',
  borderRadius: '9999px',
  padding: '10px 22px',
  minHeight: '48px',
  fontSize: '17px',
  fontWeight: 600,
  fontFamily: SFText,
  cursor: 'pointer',
};

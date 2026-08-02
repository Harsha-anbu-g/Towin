import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import PassOnReadCard from '../components/PassOnReadCard';
import api from '../api/axios';
import { FROM_PAGE, REPORT_STORY } from '../components/passOnLocks';

const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

/**
 * "From Margaret" — one elder's writing, as one visitor may read it.
 *
 * The page decides nothing. It renders `items` exactly as the server handed them over, and
 * the server built that list by putting every single row through PassOnVisibilityService.
 * There is no client-side filtering here on purpose: a second place that worked out who may
 * read what would be a second authority on the question, and the two would drift.
 *
 * Nothing from the Sealed box can appear here, and not because this page filters it out.
 * Sealed items live in a different table that this endpoint never reads, and the only way
 * to open one is the owner's own password. The screen has no branch that renders anything
 * but `items`, so a future server mistake still could not leak one through it.
 */
export default function PassOnFrom() {
  const { ownerId } = useParams();
  const navigate = useNavigate();

  const [page, setPage] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // One report at a time, held by item id. Two open forms on one page is how somebody
  // ends up filing a complaint against the wrong story.
  const [reportingId, setReportingId] = useState(null);
  const [sentIds, setSentIds] = useState([]);
  const [sending, setSending] = useState(false);
  const [reportError, setReportError] = useState('');

  const load = useCallback(() => {
    setLoaded(false);
    setFailed(false);
    api.get(`/passon/from/${ownerId}`)
      .then(r => setPage(r.data))
      .catch(() => setFailed(true))
      .finally(() => setLoaded(true));
  }, [ownerId]);

  useEffect(() => { load(); }, [load]);

  const openReport = (item) => {
    setReportingId(item.id);
    setReportError('');
  };

  const closeReport = () => {
    setReportingId(null);
    setReportError('');
  };

  async function sendReport({ reason, description }) {
    const itemId = reportingId;
    setSending(true);
    setReportError('');
    try {
      await api.post('/reports', {
        reportedUserId: ownerId,
        // Names the story, not only the person. Without it an admin is told somebody
        // wrote something upsetting somewhere, which is not something anyone can act on.
        contentType: 'PASSON_ITEM',
        contentId: itemId,
        reason,
        description,
      });
      setReportingId(null);
      setSentIds(ids => [...ids, itemId]);
    } catch (err) {
      setReportError(err?.response?.data?.message || REPORT_STORY.failed);
    } finally {
      setSending(false);
    }
  }

  const name = page?.ownerName || '';
  const items = page?.items || [];

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>
      <NavBar />

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 24px 60px' }}>
        {failed ? (
          <BlurFade delay={2}>
            <p style={{ fontSize: '17px', color: 'var(--ink-slate)', lineHeight: 1.6, margin: 0 }}>
              {FROM_PAGE.failed}
            </p>
            <button type="button" onClick={() => navigate(-1)} style={{ ...quietBtn, marginTop: '16px' }}>
              {FROM_PAGE.back}
            </button>
          </BlurFade>
        ) : loaded && (
          <>
            <BlurFade delay={2}>
              <h1 style={{
                fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em',
                fontSize: 'var(--text-xl)', color: 'var(--ink)', margin: 0,
              }}>
                {FROM_PAGE.title(name)}
              </h1>
              <p style={{ fontSize: '17px', color: 'var(--ink-3)', lineHeight: 1.55, margin: '8px 0 0' }}>
                {FROM_PAGE.lead(name)}
              </p>
            </BlurFade>

            <BlurFade delay={3}>
              <div style={{ marginTop: '24px' }}>
                {items.length === 0 ? (
                  <div style={{
                    background: 'var(--canvas)', border: '1px solid var(--hairline-2)',
                    borderRadius: '18px', padding: '32px 24px',
                  }}>
                    <p style={{ fontSize: '17px', color: 'var(--ink-slate)', lineHeight: 1.6, margin: 0 }}>
                      {FROM_PAGE.empty(name)}
                    </p>
                  </div>
                ) : items.map(item => (
                  <PassOnReadCard
                    key={item.id}
                    item={item}
                    reportOpen={reportingId === item.id}
                    reportSent={sentIds.includes(item.id)}
                    reportError={reportingId === item.id ? reportError : ''}
                    sending={sending}
                    onOpenReport={openReport}
                    onCancelReport={closeReport}
                    onSendReport={sendReport}
                  />
                ))}
              </div>
            </BlurFade>
          </>
        )}
      </main>
    </div>
  );
}

const quietBtn = {
  background: 'transparent',
  color: 'var(--ink-3)',
  border: '1.5px solid var(--border)',
  borderRadius: '9999px',
  padding: '10px 18px',
  minHeight: '44px',
  fontSize: '16px',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

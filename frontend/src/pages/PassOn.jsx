import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import SegmentedTabs from '../components/SegmentedTabs';
import ConfirmDialog from '../components/ConfirmDialog';
import PassOnItemForm from '../components/PassOnItemForm';
import PassOnItemCard from '../components/PassOnItemCard';
import SealedSetup from '../components/SealedSetup';
import SealedKeyholders from '../components/SealedKeyholders';
import SealedItems from '../components/SealedItems';
import api from '../api/axios';
import { useToast } from '../context/useToast';
import {
  ANYONE_CHECK, LETTERS, NOT_A_WILL, PAGE_LEAD, SEALED_BOX, SEALED_ITEMS, SETUP, STORY_BOX,
  TAKE_DOWN, TAKE_OUT_OF_BOX,
} from '../components/passOnLocks';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const TABS = [
  { id: 'stories', label: 'Story box' },
  { id: 'letters', label: 'Letter box' },
  { id: 'sealed', label: 'Sealed box' },
];

/**
 * What I pass on — the elder's own page.
 *
 * Three parts, one tab each: the stories she shares while she is here, the
 * letters written to one person, and the sealed box of the things only she knows.
 *
 * Deliberately not a sixth dashboard tab. Below 640px the dashboard's tab strip
 * becomes a two-column grid and its TabIcon has no default branch, so a new tab
 * there would render with no icon; this is a page of its own, reached from the
 * account menu and the mobile drawer.
 *
 * The open tab lives in the address bar. A story is the longest thing anyone
 * writes in this app, and losing the tab on a reload — or on a failed save —
 * would drop her back on the wrong part of her own page.
 */
export default function PassOn() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'stories';
  const tabsRef = useRef(null);

  const [mine, setMine] = useState({ stories: [], letters: [] });
  const [people, setPeople] = useState([]);
  // Keyholders come from the family list and nowhere else — no outside friend, no
  // notary, no helper — so this is kept apart from the people she can write to.
  const [family, setFamily] = useState([]);
  const [setup, setSetup] = useState(null);
  const [keyholders, setKeyholders] = useState([]);
  // Names only. The server's list route has no body field on it at all, so nothing that
  // reaches this state has ever been decrypted — see SealedItemSummary.
  const [sealedItems, setSealedItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [writing, setWriting] = useState(null);   // { kind, item } while the form is open
  const [saving, setSaving] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [askUndo, setAskUndo] = useState(false);
  const [askAnyone, setAskAnyone] = useState(null);   // a payload waiting on the wider-audience answer
  const [pendingRemove, setPendingRemove] = useState(null);
  const [pendingSealedRemove, setPendingSealedRemove] = useState(null);
  const [explainWill, setExplainWill] = useState(false);

  // Tabs are different lengths, so switching from the bottom of a long one would
  // otherwise drop you into the middle of the next. 'nearest' moves the page only
  // when the strip has scrolled away, and without animation — navigation is not
  // the place for motion.
  const changeTab = (next) => {
    setSearchParams(next === 'stories' ? {} : { tab: next }, { replace: true });
    setWriting(null);
    tabsRef.current?.scrollIntoView({ block: 'nearest' });
  };

  const load = useCallback(() => {
    return Promise.all([
      api.get('/passon/mine')
        .then(r => setMine({ stories: r.data?.stories || [], letters: r.data?.letters || [] }))
        .catch(() => {}),
      api.get('/family/links').then(r => r.data?.activeLinks || []).catch(() => []),
      api.get('/connections').then(r => r.data || []).catch(() => []),
      api.get('/passon/setup').then(r => r.data).catch(() => null),
      api.get('/passon/keyholders').then(r => r.data || []).catch(() => []),
      // Array.isArray, not `|| []`: a 200 carrying anything but a list would otherwise reach
      // the screen and take her whole page down with it, and this is the page she opens to
      // check her sealed box is still there.
      api.get('/passon/sealed').then(r => (Array.isArray(r.data) ? r.data : [])).catch(() => []),
    ]).then(([, links, connections, setupState, keys, sealed]) => {
      setPeople(peopleSheKnows(links, connections));
      setFamily(herFamilyList(links));
      setSetup(setupState);
      setKeyholders(keys);
      setSealedItems(sealed);
    }).finally(() => setLoaded(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openWriter = (kind, item = null) => setWriting({ kind, item });

  async function save(payload) {
    // "Anyone" is the only audience that reaches people she has never met, so it
    // is the only one worth stopping for. Asking about every choice would train
    // her to tap through the one that matters.
    if (payload.audience === 'EVERYONE' && !writing?.item) {
      setAskAnyone(payload);
      return;
    }
    await send(payload);
  }

  async function send(payload) {
    const editing = writing?.item;
    setSaving(true);
    try {
      if (editing) await api.put(`/passon/items/${editing.id}`, payload);
      else await api.post('/passon/items', payload);
      setWriting(null);
      setAskAnyone(null);
      toast.success(payload.kind === 'LETTER' ? 'Your letter is saved.' : 'Your story is saved.');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'We could not save that. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    try {
      await api.delete(`/passon/items/${item.id}`);
      setPendingRemove(null);
      toast.success('Taken down.');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'We could not take that down. Please try again.');
    }
  }

  /**
   * The last step of setup. One call: who she picked, how many must agree, and the
   * two sentences she ticked. Everybody is asked from inside it, so backing out of
   * the three steps earlier has asked nobody anything.
   */
  async function arm(payload) {
    setSaving(true);
    try {
      await api.post('/passon/arm', payload);
      setSettingUp(false);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || SETUP.before.failed);
    } finally {
      setSaving(false);
    }
  }

  // ── what is in the box ──
  //
  // Putting something in and taking something out are handled here beside every other call on
  // this page. Opening one is not: `openSealed` hands the answer straight back to the card
  // that asked for it and keeps nothing, so no decrypted word is ever held in this component,
  // in a list, or anywhere a later change could accidentally render.

  async function addSealed(payload) {
    setSaving(true);
    try {
      await api.post('/passon/sealed', payload);
      toast.success(SEALED_ITEMS.saved);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || SEALED_ITEMS.failedToSave);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function removeSealed(item) {
    try {
      await api.delete(`/passon/sealed/${item.id}`);
      setPendingSealedRemove(null);
      toast.success(SEALED_ITEMS.removed);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || SEALED_ITEMS.failedToRemove);
    }
  }

  /**
   * The password travels in the body, never in the address: a path or a query string is
   * written into access logs, browser history and referrer headers, and this one opens the
   * whole account. The refusal is passed back untouched so the card can show the server's own
   * sentence — the seven-day freeze carries a real date she may act on.
   */
  function openSealed(item, password) {
    return api.post(`/passon/sealed/${item.id}/reveal`, { password }).then(r => r.data);
  }

  /** "If this was not your idea, undo it." Nothing is said to anybody about it. */
  async function undo() {
    setSaving(true);
    try {
      await api.post('/passon/undo');
      setAskUndo(false);
      toast.success(SETUP.settling.undone);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || SETUP.settling.undoFailed);
    } finally {
      setSaving(false);
    }
  }

  const stories = mine.stories;
  const letters = mine.letters;
  const writingHere = (kind) => writing?.kind === kind;

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>
      <NavBar />

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 24px 60px' }}>
        <BlurFade delay={2}>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em',
            fontSize: 'var(--text-xl)', color: 'var(--ink)', margin: 0,
          }}>
            What I pass on
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--ink-3)', lineHeight: 1.55, margin: '8px 0 0' }}>
            {PAGE_LEAD}
          </p>
        </BlurFade>

        <BlurFade delay={3}>
          <div style={{ margin: '18px 0 0' }}>
            <NotAWillPrimer open={explainWill} onToggle={() => setExplainWill(o => !o)} />
          </div>
        </BlurFade>

        <div ref={tabsRef} style={{ margin: '20px 0 0' }}>
          <SegmentedTabs
            segments={TABS}
            value={tab}
            onChange={changeTab}
            label="Your stories, your letters, and your sealed box"
          />
        </div>

        {/* ── Story box ─────────────────────────────────────────────────────── */}
        {tab === 'stories' && (
          <BlurFade delay={4}>
            <div role="tabpanel" aria-label="Your story box" style={{ marginTop: '20px' }}>
              {writingHere('STORY') ? (
                <PassOnItemForm
                  kind="STORY"
                  initial={writing.item}
                  people={people}
                  saving={saving}
                  onSave={save}
                  onCancel={() => setWriting(null)}
                />
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                  <button type="button" onClick={() => openWriter('STORY')} style={fillBtn}>
                    {STORY_BOX.start}
                  </button>
                </div>
              )}

              {loaded && stories.length === 0 && !writingHere('STORY') && (
                <Empty>{STORY_BOX.empty}</Empty>
              )}

              {stories.map(item => (
                <PassOnItemCard
                  key={item.id}
                  item={item}
                  onChange={s => openWriter('STORY', s)}
                  onRemove={setPendingRemove}
                />
              ))}
            </div>
          </BlurFade>
        )}

        {/* ── Letters ───────────────────────────────────────────────────────── */}
        {tab === 'letters' && (
          <BlurFade delay={4}>
            <div role="tabpanel" aria-label="Your letters" style={{ marginTop: '20px' }}>
              {/* Both halves of the Letter box, said before she writes anything —
                  including the part that matters most, which is that nothing here
                  happens on its own. There is no timer and no button anywhere that
                  passes a letter on. */}
              <p style={{
                fontSize: '16px', color: 'var(--ink-slate)', lineHeight: 1.6,
                background: 'var(--canvas)', border: '1px solid var(--border)',
                borderRadius: '14px', padding: '16px 20px', margin: '0 0 16px',
              }}>
                {LETTERS.howItWorks}
              </p>

              {writingHere('LETTER') ? (
                <PassOnItemForm
                  kind="LETTER"
                  initial={writing.item}
                  people={people}
                  // Her Keyholders and her quorum live on the Sealed box tab, and
                  // without them nobody could ever ask for a held letter to be
                  // opened. Same state the tab itself reads, fetched once.
                  canHoldUntilGone={Boolean(setup?.armed)}
                  saving={saving}
                  onSave={save}
                  onCancel={() => setWriting(null)}
                  onGoToSealedBox={() => changeTab('sealed')}
                />
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                  <button type="button" onClick={() => openWriter('LETTER')} style={fillBtn}>
                    {LETTERS.start}
                  </button>
                </div>
              )}

              {loaded && letters.length === 0 && !writingHere('LETTER') && (
                <Empty>{LETTERS.empty}</Empty>
              )}

              {letters.map(item => (
                <PassOnItemCard
                  key={item.id}
                  item={item}
                  onChange={l => openWriter('LETTER', l)}
                  onRemove={setPendingRemove}
                />
              ))}
            </div>
          </BlurFade>
        )}

        {/* ── Sealed box ────────────────────────────────────────────────────── */}
        {tab === 'sealed' && (
          <BlurFade delay={4}>
            <div role="tabpanel" aria-label="Your sealed box" style={{ marginTop: '20px' }}>
              {/* Three states, one at a time: the teaching card before she has
                  decided anything, the three steps while she is deciding, and who
                  holds a key once she has. */}
              {settingUp && setup && (
                <SealedSetup
                  family={family}
                  setup={setup}
                  already={keyholders
                    .filter(k => k.status === 'INVITED' || k.status === 'ACTIVE')
                    .map(k => k.personId)}
                  saving={saving}
                  onFinish={arm}
                  onCancel={() => setSettingUp(false)}
                />
              )}

              {/* What is inside comes before who can open it one day. She reads down the
                  screen from her own things to the arrangement around them, and only the
                  first of those is something she came here to change. */}
              {!settingUp && setup?.armed && (
                <SealedItems
                  items={sealedItems}
                  saving={saving}
                  releaseContactEmail={setup?.releaseContactEmail}
                  onAdd={addSealed}
                  onRemove={setPendingSealedRemove}
                  onReveal={openSealed}
                />
              )}

              {!settingUp && setup?.armed && (
                <SealedKeyholders
                  setup={setup}
                  keyholders={keyholders}
                  undoing={saving}
                  onUndo={() => setAskUndo(true)}
                  onChange={() => setSettingUp(true)}
                />
              )}

              {!settingUp && !setup?.armed && (
                <>
                  <SealedBoxTeaching />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                    <button type="button" onClick={() => setSettingUp(true)} style={fillBtn}>
                      {SETUP.start}
                    </button>
                  </div>
                </>
              )}
            </div>
          </BlurFade>
        )}
      </main>

      <ConfirmDialog
        open={askAnyone != null}
        title={ANYONE_CHECK.title}
        message={ANYONE_CHECK.message}
        confirmLabel={ANYONE_CHECK.confirm}
        cancelLabel={ANYONE_CHECK.cancel}
        onConfirm={() => send(askAnyone)}
        onCancel={() => setAskAnyone(null)}
      />

      {/* Asked once, because the undo takes every key back with it — and worded so
          she knows what it does NOT touch. Nothing she wrote is affected. */}
      <ConfirmDialog
        open={askUndo}
        title={SETUP.settling.confirmTitle}
        message={SETUP.settling.confirmMessage}
        confirmLabel={SETUP.settling.confirmYes}
        cancelLabel={SETUP.settling.confirmNo}
        loading={saving}
        onConfirm={undo}
        onCancel={() => setAskUndo(false)}
      />

      {/* Taking something out of the box is the one delete in this feature that nobody can
          reverse — not support, not the operator, nobody. So it is asked for in words that
          say exactly that, on the same danger dialog every other destructive action uses. */}
      <ConfirmDialog
        open={pendingSealedRemove != null}
        danger
        title={TAKE_OUT_OF_BOX.title}
        message={TAKE_OUT_OF_BOX.message}
        confirmLabel={TAKE_OUT_OF_BOX.confirm}
        cancelLabel={TAKE_OUT_OF_BOX.cancel}
        onConfirm={() => removeSealed(pendingSealedRemove)}
        onCancel={() => setPendingSealedRemove(null)}
      />

      <ConfirmDialog
        open={pendingRemove != null}
        danger
        title={TAKE_DOWN.title}
        message={TAKE_DOWN.message}
        confirmLabel={TAKE_DOWN.confirm}
        cancelLabel={TAKE_DOWN.cancel}
        onConfirm={() => remove(pendingRemove)}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  );
}

/**
 * Who she can write to: the family on her list, and the helpers she has built
 * real trust with. Family links also come back on /connections as type FAMILY —
 * those are family chats, not helpers — so they are dropped here and the family
 * list is the single source for family.
 */
function peopleSheKnows(links, connections) {
  const family = (links || [])
    .filter(l => l.status === 'ACTIVE' && l.otherUserId)
    .map(l => ({ id: l.otherUserId, name: l.otherUserName, note: l.relationship || 'Family' }));

  const helpers = (connections || [])
    .filter(c => c.status === 'ACTIVE' && c.type !== 'FAMILY' && c.currentTrustLevel === 'TRUSTED' && c.otherUserId)
    .map(c => ({ id: c.otherUserId, name: c.otherUserName, note: 'Helper you trust' }));

  const seen = new Set();
  return [...family, ...helpers].filter(p => !seen.has(p.id) && seen.add(p.id));
}

/**
 * Her family list on its own, for Keyholders. Deliberately not the list above: a
 * Keyholder can only ever be somebody on the family list — no outside friend, no
 * notary, and no helper however well she trusts them.
 */
function herFamilyList(links) {
  return (links || [])
    .filter(l => l.status === 'ACTIVE' && l.otherUserId)
    .map(l => ({ id: l.otherUserId, name: l.otherUserName, note: l.relationship || 'Family' }));
}

/**
 * The not-a-will line. A slim horizontal row, never a card — it has to be the
 * first thing read and never the loudest thing on the page. The four-sentence
 * Quebec explanation stays folded away until she asks for it.
 */
function NotAWillPrimer({ open, onToggle }) {
  return (
    <div style={{
      background: 'var(--canvas)', borderRadius: '14px', border: '1px solid var(--hairline-2)',
      padding: '12px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span aria-hidden="true" style={{
          width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gold-wash)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold-deep)"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
            <path d="M15 3v4h4" /><path d="M9 13h6" /><path d="M9 17h4" />
          </svg>
        </span>
        <p style={{ flex: 1, minWidth: '200px', fontSize: '16px', color: 'var(--ink)', margin: 0, lineHeight: 1.45 }}>
          {NOT_A_WILL.short}
        </p>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="btn-ghost"
          style={{ height: '44px', padding: '0 14px', fontSize: '16px' }}
        >
          {NOT_A_WILL.ask}
        </button>
      </div>
      {open && (
        <p style={{
          fontSize: '16px', color: 'var(--ink-slate)', lineHeight: 1.6,
          margin: '12px 0 2px', paddingLeft: '44px',
        }}>
          {NOT_A_WILL.long}
        </p>
      )}
    </div>
  );
}

/** The Sealed box as it reads before there is anything in it: one teaching card. */
function SealedBoxTeaching() {
  return (
    <div style={{
      background: 'var(--canvas)', borderRadius: '18px', border: '1px solid var(--border)',
      padding: '28px 24px',
    }}>
      <span aria-hidden="true" style={{
        width: '52px', height: '52px', borderRadius: '50%', background: 'var(--gold-wash)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--gold-deep)"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </span>

      <h2 style={{
        fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em',
        fontSize: 'var(--text-lg)', color: 'var(--ink)', margin: 0,
      }}>
        {SEALED_BOX.title}
      </h2>
      <p style={{ fontSize: '17px', color: 'var(--ink-slate)', lineHeight: 1.6, margin: '10px 0 0' }}>
        {SEALED_BOX.body}
      </p>

      <h3 style={{ ...subHead, marginTop: '24px' }}>{SEALED_BOX.safetyHeading}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
        {SEALED_BOX.safety.map(line => (
          <p key={line.slice(0, 24)} style={{
            fontSize: '16px', color: 'var(--ink-slate)', lineHeight: 1.6, margin: 0,
            paddingLeft: '14px', borderLeft: '2px solid var(--hairline-2)',
          }}>
            {line}
          </p>
        ))}
      </div>

      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--hairline)' }}>
        <h3 style={subHead}>{SEALED_BOX.afterHeading}</h3>
        <p style={{ fontSize: '16px', color: 'var(--ink-slate)', lineHeight: 1.6, margin: '10px 0 0' }}>
          {SEALED_BOX.after}
        </p>
      </div>
    </div>
  );
}

function Empty({ children }) {
  return (
    <div style={{
      background: 'var(--canvas)', border: '1px solid var(--hairline-2)', borderRadius: '18px',
      padding: '32px 24px',
    }}>
      <p style={{ fontSize: '17px', color: 'var(--ink-slate)', lineHeight: 1.6, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

const subHead = {
  fontSize: '17px',
  fontWeight: 600,
  color: 'var(--ink)',
  fontFamily: SF,
  margin: 0,
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

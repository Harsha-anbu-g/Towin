// Guardian mode (LEAVE_REVIEWS): the family member writes a review of a helper
// for the parent.
//
// The review belongs to the parent — it is their friendship and their trust the
// helper earns. The family member's name rides along so nobody is ever reviewed
// by a stranger wearing someone else's face. Reviewing is the reward at the top
// of the ladder, so this only appears on a fully trusted friendship, exactly as
// it does for the parent themselves.
import { useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/useToast';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const OPEN_ANIM = 'fadeSlideUp 200ms cubic-bezier(0.23, 1, 0.32, 1)';

// The one place a star glyph is allowed — it IS the rating, not decoration.
function StarPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          aria-pressed={n <= value}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            minWidth: '44px', minHeight: '44px', fontSize: '30px', lineHeight: 1,
            color: n <= value ? 'var(--star-gold)' : 'var(--border)',
            fontFamily: SFText,
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function FamilyReviewForParent({ helper, elderId, elderName }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const parent = elderName || 'your parent';
  const firstName = (helper?.helperName || 'them').split(' ')[0];

  // Only a fully trusted friendship can be reviewed — the same gate the parent
  // and the helper live under, and the server holds it too.
  if (helper?.currentTrustLevel !== 'TRUSTED' || !helper?.helperUserId) return null;

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrMsg('');
    try {
      await api.post('/reviews', {
        revieweeId: helper.helperUserId,
        rating,
        comment: comment.trim() || null,
        // We ask; the server checks the parent's grant and records who wrote it.
        onBehalfOfElderId: elderId,
      });
      setDone(true);
      setOpen(false);
      toast.success(`Review saved for ${parent}. ${firstName} will see you wrote it.`);
    } catch (err) {
      setErrMsg(err?.response?.data?.message || 'Could not save that review. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--gold-deep)', fontFamily: SFText, margin: '12px 0 0', lineHeight: 1.5 }}>
        Review saved for {parent}, with your name on it.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center',
          gap: '8px', minHeight: '44px', marginTop: '12px', padding: '10px 16px',
          background: 'transparent', color: 'var(--blue-deep)',
          border: '1.5px solid var(--blue-soft)', borderRadius: '9999px',
          cursor: 'pointer', fontSize: '16px', fontWeight: 600, fontFamily: SFText,
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
        Leave a review for {parent}
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{
        marginTop: '12px', padding: '14px 16px',
        border: '1px solid var(--sky-line-2)', borderRadius: '14px',
        display: 'flex', flexDirection: 'column', gap: '12px',
        animation: OPEN_ANIM,
      }}
    >
      <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, margin: 0, lineHeight: 1.4 }}>
        How has {firstName} been for {parent}?
      </p>

      <StarPicker value={rating} onChange={setRating} />

      <div>
        <label htmlFor={`review-comment-${helper.connectionId}`} style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
          A few words (optional)
        </label>
        <textarea
          id={`review-comment-${helper.connectionId}`}
          className="field"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          placeholder={`What ${firstName} has been like for ${parent}`}
          style={{ resize: 'vertical', fontFamily: SFText, fontSize: '16px' }}
        />
      </div>

      {errMsg && (
        <p className="danger-text" style={{ fontSize: '16px', fontWeight: 500, margin: 0, lineHeight: 1.4 }}>{errMsg}</p>
      )}

      <p style={{ fontSize: '15px', color: 'var(--gold-deep)', fontFamily: SFText, margin: 0, lineHeight: 1.5 }}>
        This is saved as {parent}&apos;s review, with your name on it as the person who wrote it.
      </p>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            flex: '1 1 160px', minHeight: '44px', padding: '10px 20px',
            background: 'var(--blue)', color: '#fff', border: 'none',
            borderRadius: '9999px', fontSize: '16px', fontWeight: 600,
            fontFamily: SFText, cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : `Save for ${parent}`}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setErrMsg(''); }}
          style={{
            flex: '1 1 120px', minHeight: '44px', padding: '10px 18px',
            background: 'transparent', color: 'var(--ink-3)',
            border: '1.5px solid var(--border)', borderRadius: '9999px',
            fontSize: '16px', fontWeight: 600, fontFamily: SFText, cursor: 'pointer',
          }}
        >
          Never mind
        </button>
      </div>
    </form>
  );
}

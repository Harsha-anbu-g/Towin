import { useState } from 'react';
import SealedItemCard from './SealedItemCard';
import SealedItemForm from './SealedItemForm';
import { SEALED_ITEMS } from './passOnLocks';

/**
 * What is actually in her Sealed box — the half of the tab that has anything in it.
 *
 * It sits above "Who can open it one day" because that is the order she reads in: what is
 * inside, then the arrangement around it. Before this existed she could arm a box she had no
 * way to put anything into.
 *
 * <b>The top line counts, and says who can see it, in one sentence.</b> "Your box is shut. 3
 * things are inside. Nobody can see them but you." An elder who has just written down where
 * her money is will come back to this screen to check it is still true, and the answer has to
 * be the first thing on it.
 *
 * Nothing here holds a decrypted word. Each card asks for the password itself and keeps what
 * comes back in its own state, so there is no list, no page and no parent component anywhere
 * above a secret.
 *
 * Props:
 *   items    — [{ id, label, kindHint }] as the server's list route returned them, names only
 *   saving   — true while a save is in flight
 *   releaseContactEmail — passed straight down to the cards, which need it only for the
 *                         refusal after a password change
 *   onAdd({ label, body, kindHint }) → Promise, resolving when it is saved
 *   onRemove(item)
 *   onReveal(item, password) → Promise<{ label, body }>
 */
export default function SealedItems({
  items, saving, releaseContactEmail, onAdd, onRemove, onReveal,
}) {
  const [adding, setAdding] = useState(false);
  const inside = items || [];

  /**
   * The form closes only on a save that worked. A failed save leaves it open with every word
   * still in it — she has just typed out where her money is, and clearing the screen and
   * showing her a toast would ask her to write it again from memory.
   */
  async function save(payload) {
    try {
      await onAdd(payload);
      setAdding(false);
    } catch {
      // Already said out loud by the page that made the call.
    }
  }

  return (
    <section aria-label="What is in your sealed box" style={{ marginBottom: '16px' }}>
      <p style={countLine}>
        {inside.length === 0 ? SEALED_ITEMS.nothingInside : SEALED_ITEMS.shut(inside.length)}
      </p>

      {inside.map(item => (
        <SealedItemCard
          key={item.id}
          item={item}
          releaseContactEmail={releaseContactEmail}
          onRemove={onRemove}
          onReveal={onReveal}
        />
      ))}

      {adding ? (
        <SealedItemForm saving={saving} onSave={save} onCancel={() => setAdding(false)} />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button type="button" onClick={() => setAdding(true)} style={fillBtn}>
            {SEALED_ITEMS.add}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Gold, not blue: something to read and be reassured by, not something to act on. The card it
 * sits above is the list itself, so this is a line rather than a panel — a box with three
 * things in it should not open on a heading about having three things in it.
 */
const countLine = {
  fontSize: '17px',
  color: 'var(--ink-slate)',
  lineHeight: 1.6,
  margin: '0 0 16px',
  padding: '14px 18px',
  background: 'var(--gold-wash)',
  border: '1px solid var(--hairline-2)',
  borderRadius: '14px',
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
  fontFamily: 'inherit',
  cursor: 'pointer',
};

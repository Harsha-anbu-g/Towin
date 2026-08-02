import { useState } from 'react';
import api from '../api/axios';
import ConfirmDialog from './ConfirmDialog';

/**
 * Delete an account from the admin console, having first said what goes with it.
 *
 * The other Delete buttons in the panel remove one row — a message, a review. This one runs
 * the same purge as "delete my account" does, so it can take stories somebody wrote for their
 * grandchildren, letters addressed to one named person, and a Sealed box nobody can rebuild.
 * None of that is visible from the users table, which shows a name, a role and a date.
 *
 * So the numbers are fetched before the question is asked, from the same service the
 * self-serve path uses. An admin should never be able to say afterwards that they were not
 * told, and the panel should never be able to promise something different from what the
 * purge actually destroys.
 *
 * The failure case is deliberately not silent. A warning that quietly comes back empty when
 * the check fails is worse than no warning at all, because it reads as "there is nothing
 * here" — so it says plainly that it could not look.
 */
export default function DeleteUserButton({ userId, style, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask() {
    setOpen(true);
    setBusy(true);
    setMessage('Checking what this account holds…');
    try {
      const { data } = await api.get(`/admin/users/${userId}/delete-preview`);
      setMessage([data?.summary, data?.keyholderNote].filter(Boolean).join(' '));
    } catch {
      setMessage('Could not check what this account holds, so this may delete stories, '
        + 'letters or a Sealed box without saying so.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      await api.delete(`/admin/users/${userId}`);
      setOpen(false);
      onDeleted?.();
    } catch {
      setMessage('That account could not be deleted. Nothing was removed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={ask} style={style}>Delete</button>
      <ConfirmDialog
        open={open}
        title="Delete this account?"
        message={message}
        // Not "Delete" — the button that opened this dialog is still behind it with that
        // exact name, and two buttons called the same thing is a coin toss for anyone
        // listening to the page rather than looking at it.
        confirmLabel="Delete account"
        cancelLabel="Keep"
        danger
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

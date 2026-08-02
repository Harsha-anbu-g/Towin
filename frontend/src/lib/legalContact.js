/**
 * Where a person writes to Towinly about the Terms of Service and the Privacy Policy.
 *
 * **The address is not in this file, and it must never be put here.** It is deployment
 * configuration — `VITE_LEGAL_CONTACT_EMAIL` — exactly like the Sealed box release address
 * (`SEALED_BOX_RELEASE_CONTACT_EMAIL` on the server, read by `ReleaseContact` and said out
 * loud by `RELEASE_CONTACT` in components/passOnLocks.js). When it is unset, these pages say
 * so plainly rather than naming a mailbox.
 *
 * The reason is the sentence the address appears in. There is no screen anywhere in Towinly
 * that exports your data or deletes your account — the endpoints exist on the server, nothing
 * in the app calls them — so this address is the only route a person has to either. Both pages
 * shipped a `support@` and a `privacy@` on a reserved documentation domain until now, in the
 * very sentence telling somebody where to write to have their data deleted. A reserved domain
 * cannot receive mail; a plausible-looking address on the real domain would be worse still,
 * because it looks real, so the letter goes, and nothing comes back and they never find out
 * why. "We have not set one yet" is at least something a person can act on.
 *
 * Read at call time rather than captured at import, so a page can never render a stale value
 * and a test can set the variable for the length of one assertion.
 */

export const LEGAL_CONTACT = {
  /** Said in place of an address, never beside one. */
  noAddressYet:
    'Towinly has not set an address to write to yet. We would rather tell you that than send '
    + 'you to a mailbox that cannot answer.',
};

/**
 * The configured address, or `null` on a deployment that has not set one.
 *
 * Blank and whitespace-only both count as unset, so an empty variable in a build environment
 * behaves the same as a missing one — the same rule `ReleaseContact` applies on the server.
 *
 * @returns {string|null}
 */
export function legalContactEmail() {
  const configured = (import.meta.env.VITE_LEGAL_CONTACT_EMAIL || '').trim();
  return configured || null;
}

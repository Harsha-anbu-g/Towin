# Opening a Sealed box after someone has died

This is the whole procedure. There is no other one, and there is no code that does any of it.

Nothing in Towinly opens a Sealed box on its own, and nothing opens a letter written to be read
after somebody is gone. No scheduler, no timer, no admin button, no "release" screen — none of it
exists, and that is deliberate ([the spec's cut list][spec]). Both open because a named person here
reads a death certificate, speaks to each Keyholder, waits thirty days, and then decides. Every step
below is done by hand and written down by hand.

Read the whole document before answering the first email. The order matters, and steps 2 and 3 are
the ones that go wrong under pressure from a grieving family.

[spec]: ../superpowers/specs/2026-07-30-what-i-pass-on-design.md

---

## Who answers — NOT SET. This blocks launch.

| | |
|---|---|
| **Name of the person who answers** | **UNSET** |
| **Address a family writes to** | **UNSET** — `SEALED_BOX_RELEASE_CONTACT_EMAIL` is not set in Railway, so the saved copy tells the family plainly that there is no address yet. It ships no placeholder: an invented mailbox would look real and take their letter |
| **First-reply turnaround** | **UNSET** |
| **Second person, for when the first is unreachable** | **UNSET** |

Until those four boxes are filled, this feature must not go in front of a real elder. An elder is
being asked to write down where her money is, on the promise that a person will help her family
read it back. A promise with no name attached to it is not a promise.

There is exactly one place the address is set, and it is not in the code:

```
Railway → backend → Variables → SEALED_BOX_RELEASE_CONTACT_EMAIL
```

It is read by `ReleaseContact` on the server, sent down with the sheet, and printed on the elder's
saved one-page copy — the page she keeps outside the app. Setting it there sets it everywhere at
once. Leaving it blank is a supported state: every screen then says *"Towinly has not set an address
to write to yet."* rather than an address that cannot answer. See
[`docs/DEPLOYMENT.md`](../DEPLOYMENT.md) for the full note, including why a change is a forwarding
problem — copies already saved by elders carry the address that was set on the day they saved them.

**Then re-read `SHEET.howToAsk` in `frontend/src/components/passOnLocks.js`**: the saved copy tells
a family what they will be asked for, and it states no turnaround at all. When a turnaround is
agreed, it has to be added there, because the saved copy is the only thing the family will still
have if Towinly is gone.

A personal mailbox is a poor choice for this and the spec already flags one in use elsewhere
(residual risk 6). Whatever address is chosen has to outlive one person's phone.

---

## Before anything else

- **Never say, or confirm, that someone has died.** Not in an email, not on the phone to a second
  relative, not in a message to the elder's helpers. Ask people to check on a person; never announce.
  This holds for every step below.
- **The elder may be alive.** People are reported dead by mistake, by confusion and occasionally on
  purpose. Everything below is built on that possibility.
- **The person asking may be the problem.** The most likely attacker in this feature is a relative,
  and the most likely motive is what is in the box. Being upset is not evidence of being entitled.
- **You are allowed to say no**, and to stop at any step. There is no appeal process to operate, no
  service level to breach, and no obligation to explain your reasoning to the family in detail.

---

## The five steps, in order

### 1. A family member writes in

They write to the named address above, which they will have found on the elder's saved one-page copy
(or by asking Towinly). Record, in your own notes:

- who wrote, and what they say their relationship is
- which account they say the box belongs to
- the date it arrived

Reply to say it has been received and what happens next. Do not confirm anything about the account
yet — not that it exists, not who the Keyholders are, not that there is a box at all. At this point
you have an email from a stranger.

### 2. A death certificate is looked at by a person

By a person, with their eyes. Not "a PDF was attached" — a person reads it and writes down what they
saw:

- the issuing authority
- the certificate number
- the name and date on it, and whether they match the account

Write those details into your own operational record. **They will not fit in the database note**
(`passon_opens.note` is 300 characters); the row you write in step 5 points at the record, it does
not replace it.

Then delete the certificate once the decision is made, whichever way it goes. It is somebody's death
certificate and it has no business sitting in a mailbox for years.

If anything does not match, stop here.

### 3. Each Keyholder is asked, separately

Look up who they are:

```sql
SELECT k.id, u.full_name, u.email, k.status, k.responded_at
FROM passon_keyholders k
JOIN users u ON u.id = k.keyholder_id
JOIN family_links f ON f.elder_id = k.owner_id AND f.family_user_id = k.keyholder_id
WHERE k.owner_id = '<owner uuid>'
  AND k.status = 'ACTIVE'
  AND f.status = 'ACTIVE';
```

The join onto `family_links` is not decoration. Holding a key means *accepted* **and** *still on
the elder's family list* — the app works that out afresh on every read and never stores the answer,
so a query without that join will show you people who no longer hold a key.

Then:

- Contact **each one separately**. Not a group email. A group email lets the loudest relative answer
  for everybody, which is the exact thing the threshold exists to prevent.
- Ask them to confirm **in writing**, in their own words.
- Do not tell them how many others have agreed, or who. Someone who knows they are the deciding vote
  is under pressure that someone answering freely is not.
- The number who must agree is the elder's own, chosen at setup:

```sql
SELECT approvals_needed, keyholder_target, armed_at FROM passon_settings WHERE owner_id = '<owner uuid>';
```

If the threshold is not met, stop. A Keyholder who does not reply is not a yes.

### 4. Thirty days pass

Starting from the day the threshold in step 3 was met — not from the first email.

During those thirty days:

- Write to the elder at least three times, at the address on their account. Ask them to sign in.
  **Never mention a death, a certificate, or the family's request.**
- Look at `users.last_seen_at`. It is **evidence for a person to weigh**, never a trigger:

```sql
SELECT last_seen_at, email_verified, created_at FROM users WHERE id = '<owner uuid>';
```

- If the elder signs in, or answers, or anyone reaches them: **stop immediately** and tell the family
  nothing more than that the request will not be going ahead.
- Never tell the family what `last_seen_at` says. It is a live person's whereabouts.

Thirty days is not a formality. It is the window in which a mistake, or a lie, has a chance to
surface.

### 5. A person hands over the contents, opens the letters, and writes the row

Only now. Export the contents to the Keyholders who agreed — not to whoever wrote in, unless they
are one of them.

The same step opens the letters she wrote to be read after she was gone. Set the release date on
her settings row by hand:

```sql
UPDATE passon_settings SET released_at = now(), updated_at = now()
WHERE owner_id = '<owner uuid>' AND released_at IS NULL;
```

That one column is the whole switch, and there is deliberately only one of them. It opens her
Sealed box **and** it makes each letter marked "after I am gone" readable by the one person she
addressed it to — a family goes through this procedure once, not once per thing she left behind.

**Until a person runs that line, nothing opens.** No scheduler sets it, no timer, no cron job, no
admin screen and no endpoint — none of those exist. A letter she wrote to her daughter is
invisible to that daughter until the day you type this: not the words, not the title, not the fact
that it is there.

Three things worth knowing before you run it:

- **It opens each letter to its named person only.** Release is not a general unlocking of her
  page. A letter for Sarah opens for Sarah; her other children, her helpers and her Keyholders see
  nothing of it. What the Keyholders receive is the Sealed box, which you hand over yourself.
- **It is one-way in practice.** From that moment her letters are frozen: nothing can edit or
  delete a released letter, because somebody has probably already read it and rewriting what a
  bereaved person was told is not something an app should be able to do. Clearing the column back
  to `NULL` would hide the letters again but cannot un-read them, so treat this as final and be
  certain of steps 2 to 4 first.
- **If she has no `passon_settings` row, there is nothing to set** and no release is possible. That
  row is created when she sets her Sealed box up, so an elder with no row also has no Keyholders to
  have agreed in step 3 — the procedure never gets that far. Any "after I am gone" letters she
  wrote stay shut. Do not invent a settings row to work around this: the quorum on it would be
  numbers you made up rather than numbers she chose.

Then write the release into the audit table by hand:

```sql
INSERT INTO passon_opens (owner_id, sealed_item_id, kind, at, actor_label, note)
VALUES ('<owner uuid>', NULL, 'MANUAL_RELEASE', now(), '<your name>',
        'Released to N keyholders. Certificate <number>, <authority>. See release record <ref>.');
```

`actor_label` is a label, not a foreign key — 60 characters, your name as a person would say it.
`note` is 300 characters and is a pointer to your own written record, not a substitute for it.

---

## What is missing before step 5 can actually be carried out

**There is no tool that decrypts a sealed item without the owner's password.** This is not an
oversight to work around at the time; it is the honest state of the build, and it must be fixed
before the contact details above are filled in.

- `SealedBoxService.reveal` is the only path that opens an item, and it re-checks the account
  password (`SealedBoxService.java`). A dead person cannot type it. It now also refuses outright
  once `released_at` is set, so **do not plan to use it at step 5 even if somebody hands you her
  password** — after the release it will not open anything for anyone. That is deliberate: a
  password would otherwise be a second door around the quorum, the certificate and the thirty
  days, leaving her Keyholders no record it had been used.
- `SealedCryptoService.open(ownerId, itemId, stored)` can open an item with only the master key —
  but nothing calls it outside that password path, and there is no script, endpoint or admin screen
  that would let a person run it.

So carrying out step 5 today would mean writing a one-off program against the production database
and the master key, under time pressure, for a grieving family. That is the worst possible moment to
write it. **Build the tool first, deliberately, with a test** — and give it the properties this
procedure assumes: it names the operator, it writes the `passon_opens` row itself so the record
cannot be forgotten, and it refuses to run without an explicit reference to the written release
record.

---

## If the elder deleted their account

Then there is nothing to release, and nothing to look for. `DELETE /api/account` removes the sealed
items with everything else, and the Keyholders are not told (`AccountService.purgeUserData`). Say so
plainly, and do not go looking in backups.

---

## Things that are true and are worth saying out loud to a family

- Towinly can read the contents. Anyone with the production account holds both the database and the
  master key. This is a disclosed trade, made so that nobody can ever be locked out of their own box
  — but it means the answer to "could you just look?" is *yes, and we will not*.
- The Keyholders are a consented social arrangement, not a cryptographic one. Their agreement is
  recorded and it is real; it is not a key split into pieces.
- Nothing in the box is a will, and nothing here overrides one. If there is a liquidator or an
  executor of the succession, they may have a claim to what is in the box that a Keyholder does not.
  That question is not settled and is on the launch-gate list for Quebec counsel.

---

## Related

- The elder's own words for this procedure: `SHEET.howToAsk` in
  `frontend/src/components/passOnLocks.js`
- The key, its recovery and its second holder: [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md)
- Why none of this is automated in v1: the "Cut from v1" section of [the spec][spec]

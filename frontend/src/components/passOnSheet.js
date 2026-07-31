import {
  RELEASE_CONTACT, SEALED_KINDS, SETUP, SHEET, keyholderLine, onDayInFull,
} from './passOnLocks';

/**
 * The elder's saved one-page copy, as one structure that both the screen and the file are
 * drawn from.
 *
 * <b>Why there is a structure at all, rather than a component and a string builder.</b> This
 * page shows her the copy and then hands her the same copy as a file. Two renderings written
 * separately would eventually disagree — a line added to the screen and forgotten in the file,
 * or the other way round — and the disagreement would be invisible until a family found the
 * file short of something she was shown. So there is exactly one description of the content
 * here, and both renderings are derived from it.
 *
 * <b>There is nothing secret in this file, and that is enforced by what it is given.</b> The
 * server builds the sheet on `SealedBoxService.list`, which unwraps the names of sealed items
 * and never their contents. Nothing below reads a body, and there is no branch that could:
 * `itemLines` takes the label and the chip, and drops everything else on the object.
 *
 * <b>Digital only.</b> There is no print path anywhere in this feature — no print stylesheet,
 * no window.print, no PDF. She saves a file.
 */

/** Windows Notepad still shows a bare \n as one long line. This file is a keepsake; it wraps. */
const NEWLINE = '\r\n';

/** Anything a file system would read as a path, or refuse outright. */
const NOT_IN_A_FILE_NAME = /[\\/:*?"<>|]/g;

/**
 * Builds the saved copy from what the server sent.
 *
 * @param {object} data — the /api/passon/sheet payload
 * @returns {{title: string, madeOn: string, sections: object[], closing: string}}
 */
export function buildSheet({
  ownerName,
  preparedAt,
  items = [],
  keyholders = [],
  approvalsNeeded,
  keyholderTarget,
}) {
  const name = ownerName || '';

  return {
    title: SHEET.title(name),
    madeOn: SHEET.madeOn(onDayInFull(preparedAt)),
    sections: [
      {
        heading: SHEET.inTheBox.heading,
        blurb: SHEET.inTheBox.blurb,
        lines: itemLines(items),
        empty: SHEET.inTheBox.empty,
      },
      {
        heading: SHEET.whoCanOpen.heading,
        // Left out entirely until she has chosen. She can ask people before she picks the
        // number, and an invented threshold on a page about her death is the one thing this
        // must never contain.
        blurb: approvalsNeeded && keyholderTarget
          ? SETUP.settled.threshold(approvalsNeeded, keyholderTarget)
          : null,
        lines: keyholderLines(keyholders),
        empty: SHEET.whoCanOpen.empty,
      },
      {
        heading: SHEET.howToAsk.heading,
        blurb: SHEET.howToAsk.writeTo(RELEASE_CONTACT.who, RELEASE_CONTACT.email),
        listLead: SHEET.howToAsk.askedFor,
        lines: SHEET.howToAsk.steps(name),
        note: SHEET.howToAsk.thenWhat,
      },
    ],
    closing: SHEET.closing,
  };
}

/**
 * The same copy as plain text, which is what she downloads.
 *
 * Plain text on purpose: it opens on any machine, in any year, with nothing installed, and it
 * is still readable if it is pasted into an email or printed by somebody else. A PDF would need
 * a library, and the file has to outlive this app.
 */
export function sheetAsText(sheet) {
  const lines = [sheet.title, sheet.madeOn];

  sheet.sections.forEach((section) => {
    lines.push('', section.heading);
    if (section.blurb) lines.push(section.blurb);
    if (section.lines.length === 0 && section.empty) {
      lines.push(section.empty);
      return;
    }
    if (section.listLead) lines.push(section.listLead);
    section.lines.forEach(line => lines.push(`- ${line}`));
    if (section.note) lines.push(section.note);
  });

  lines.push('', sheet.closing, '');
  return lines.join(NEWLINE);
}

/**
 * What the file is called once it is in her downloads folder. Her name is in it because that
 * is what somebody looking for it would search for, and because a family may hold copies from
 * more than one person.
 */
export function sheetFileName(ownerName) {
  const safe = (ownerName || '').replace(NOT_IN_A_FILE_NAME, '').trim();
  return `Towinly - what ${safe} passes on.txt`;
}

/** "Where the money is — Money". The name she gave it, then its chip, and nothing else. */
function itemLines(items) {
  return (items || []).map(item => SHEET.inTheBox.line(
    item.label,
    SEALED_KINDS[item.kindHint] || SEALED_KINDS.OTHER,
  ));
}

/**
 * The people who can ask, in their real state.
 *
 * A key she took back herself is dropped, exactly as it is on her own screen: it is not part
 * of who can open the box one day, and every name on this page is a name her family will
 * telephone. Every other ending stays, because she did not necessarily cause it and her family
 * need to see that the number has moved.
 */
function keyholderLines(keyholders) {
  return (keyholders || [])
    .filter(person => person.status !== 'REMOVED')
    .map(keyholderLine);
}

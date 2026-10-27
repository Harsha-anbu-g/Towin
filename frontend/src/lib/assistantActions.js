// The actions Ask AI may propose. The model never writes: the server hands the
// page {name, arguments}, the person confirms in the site's own dialog, and the
// site's own named API function does the work (Rule 6). Anything not listed
// here is ignored, however the model phrases it. Same registry as the phone
// app's src/lib/assistantActions.js, in the website's words.
import { tr } from '../i18n';
import { checkInToday } from '../api/streaks';
import { postHelpRequest } from '../api/needs';

// The allowlist is an array, never an object lookup: a category named like an
// inherited property ("constructor") must not pass. Literal tr() calls, so the
// i18n coverage test can see every word. The words are the Post Help form's.
const CATEGORIES = ['TRANSPORTATION', 'CLEANING', 'COMPANIONSHIP', 'ERRANDS', 'OTHER'];
const categoryWord = (category) => {
  switch (category) {
    case 'TRANSPORTATION':
      return tr('Rides');
    case 'CLEANING':
      return tr('Cleaning');
    case 'COMPANIONSHIP':
      return tr('Company');
    case 'ERRANDS':
      return tr('Shopping');
    default:
      return tr('Other');
  }
};

// One cap for what is shown AND what is sent, so nothing the person could not
// read is ever posted. Short and single-line, so model text cannot restate what
// Yes does. Longer requests belong on the Post Help form.
const TITLE_MAX = 80;
const DESCRIPTION_MAX = 200;

const oneLine = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** One normalized request, used for both the dialog and the call, so they can never differ. */
function shapeRequest(a) {
  const description = oneLine(a.description, DESCRIPTION_MAX);
  return {
    title: oneLine(a.title, TITLE_MAX),
    description: description || null,
    category: CATEGORIES.includes(a.category) ? a.category : 'OTHER',
    urgency: a.urgency === 'URGENT' ? 'URGENT' : 'NORMAL',
  };
}

const ACTIONS = {
  checkInToday: {
    title: () => tr('Check in today?'),
    message: () => tr('The helper suggests marking you as here today. Your family will see it.'),
    confirmLabel: () => tr('Yes, check in'),
    run: () => checkInToday(),
    done: () => tr('Done. You are checked in for today.'),
    failed: () => tr('Could not check in. Please use the check-in page.'),
  },
  postHelpRequest: {
    title: () => tr('Post this request?'),
    // A fixed site-authored line first; the model's words are shown as data after it.
    message: (a) => {
      const r = shapeRequest(a);
      return [
        tr('The helper wants to post this request for you:'),
        r.title,
        r.description,
        categoryWord(r.category) + (r.urgency === 'URGENT' ? ' · ' + tr('Urgent') : ''),
      ]
        .filter(Boolean)
        .join('\n');
    },
    confirmLabel: () => tr('Yes, post it'),
    // Checked before the dialog, so an empty proposal is never shown or posted.
    validate: (a) => (shapeRequest(a).title ? null : tr('Could not post the request. Please use Post Help.')),
    run: (a) => postHelpRequest(shapeRequest(a)),
    done: () => tr('Done. Your request is posted. Helpers nearby can see it now.'),
    failed: () => tr('Could not post the request. Please use Post Help.'),
  },
};

/**
 * Offer one proposed action: confirm in the site's dialog, then call the site's own function.
 * @param {{name: string, arguments?: object}|null} action what the helper proposed
 * @param {{confirm: Function}} deps resolves true on Yes, false on Not now
 * @returns {Promise<string|null>} the sentence to show, or null when ignored or declined
 */
export async function runAssistantAction(action, { confirm }) {
  const entry = action && ACTIONS[action.name];
  if (!entry) return null;
  const args = action.arguments ?? {};
  const refusal = entry.validate ? entry.validate(args) : null;
  if (refusal) return refusal;
  const ok = await confirm({
    title: entry.title(args),
    message: entry.message(args),
    cancelLabel: tr('Not now'),
    confirmLabel: entry.confirmLabel(args),
  });
  if (!ok) return null;
  try {
    await entry.run(args);
    return entry.done();
  } catch {
    return entry.failed();
  }
}

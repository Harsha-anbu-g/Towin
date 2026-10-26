// The seven reunion steps in the words the elder reads, and the rules for the
// one button that moves a reunion on. These mirror the server's ReunionService
// exactly, so no button is ever shown that the server would refuse (HCI 5).
import { tr } from '../i18n';

export const STEPS = ['WISH', 'ORGANISER', 'FINDING', 'PLAN', 'DAY', 'SEND_OFF', 'DONE'];

/** Step names, rendered through tr() wherever they are shown. */
export const STEP_NAMES = ['Wish', 'Who plans', 'Finding', 'The plan', 'The day', 'Send-off', 'After'];

/** One plain line per step, for the step panel. Rendered through tr(). */
export const STEP_EXPLAINS = [
  'You say who you want to see again.',
  'You choose who plans it: a helper you fully trust, or family.',
  'Your organiser finds the people, one by one.',
  'A day, a place, a ride for everyone. You approve it.',
  'Everyone is checked in as they arrive.',
  'Every guest is seen home, then a thank-you to each.',
  'Everyone was home safe. The story is yours to keep.',
];

export const GUEST_STATES = [
  { key: 'REMEMBERED', get label() { return tr('Remembered'); } },
  { key: 'FOUND', get label() { return tr('Found'); } },
  { key: 'REACHED', get label() { return tr('Reached'); } },
  { key: 'COMING', get label() { return tr('Coming'); } },
  { key: 'CANNOT_COME', get label() { return tr('Cannot come'); } },
];

export const guestStateLabel = (key) => GUEST_STATES.find((s) => s.key === key)?.label ?? key;

/** 0..6 on the ladder; STOPPED and anything unknown read as the start. */
export function stepIndex(step) {
  const i = STEPS.indexOf(step);
  return i < 0 ? 0 : i;
}

/** "6 remembered · 3 coming", or the empty line. */
export function guestLine(reunion) {
  const count = reunion?.guestCount ?? 0;
  if (!count) return tr('No guests yet');
  return tr('{count} remembered · {coming} coming', { count, coming: reunion?.comingCount ?? 0 });
}

/**
 * The one button that moves a reunion on, for the seat the caller holds.
 * `show` says whether this seat has that button at all; `enabled` whether the
 * step's condition holds; `reason` the plain line shown while it does not.
 * `closes` marks the send-off, which ends through closeReunion, not advance.
 */
export function nextAction(reunion, myRole) {
  const elder = myRole === 'ELDER';
  const none = { show: false, enabled: false, label: null, reason: null, closes: false };
  switch (reunion?.step) {
    case 'FINDING': {
      const enabled = (reunion.comingCount ?? 0) > 0;
      return {
        show: elder,
        enabled,
        label: tr('Approve the guest list'),
        reason: enabled ? null : tr('At least one guest needs to be coming before the plan.'),
        closes: false,
      };
    }
    case 'PLAN': {
      const enabled = !!(reunion.plannedOn && reunion.venue);
      return {
        show: elder,
        enabled,
        label: tr('Approve the plan'),
        reason: enabled ? null : tr('The plan needs a day and a place first.'),
        closes: false,
      };
    }
    case 'DAY':
      return { show: true, enabled: true, label: tr('The day is over'), reason: null, closes: false };
    case 'SEND_OFF': {
      const enabled = (reunion.arrivedCount ?? 0) <= (reunion.homeCount ?? 0);
      return {
        show: true,
        enabled,
        label: tr('Close the reunion'),
        reason: enabled ? null : tr('Every guest who came needs to be home first.'),
        closes: true,
      };
    }
    default:
      return none;
  }
}

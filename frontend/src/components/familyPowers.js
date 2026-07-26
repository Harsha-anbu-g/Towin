/**
 * The three delegated powers, in the words both sides use. The elder's switches
 * (DelegatedPowerToggle), the elder's approval cards (MyFamily) and the family
 * side's "what I can do" list (FamilyParent) all read from this one list, so
 * consent is asked for in the same words it is granted in.
 */
export const POWERS = [
  {
    key: 'MANAGE_HELP_REQUESTS',
    title: 'Ask for help for you',
    on: name => `${name} can ask for help for you, and close a request you no longer need. Helpers always see ${name} asked for you.`,
    off: name => `Off. ${name} can see your help requests but cannot change them.`,
  },
  {
    key: 'ADVANCE_TRUST',
    title: 'Move a friendship forward for you',
    on: name => `${name} can take your next step with a helper. The step still counts as yours, and your helper sees ${name} took it for you.`,
    off: name => `Off. ${name} can see how a friendship is going but cannot move it on.`,
  },
  {
    key: 'LEAVE_REVIEWS',
    title: 'Leave a review for you',
    on: name => `${name} can rate a helper you fully trust. The review is yours, with ${name}'s name on it as the person who wrote it.`,
    off: name => `Off. ${name} cannot leave a review for you.`,
  },
];

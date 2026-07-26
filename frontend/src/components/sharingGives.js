/**
 * What turning on Sharing gives the family, in the words both sides read.
 * The elder's Sharing tab (MyFamily) and the family's shared-friendships
 * section (FamilyParent) both read this one list, so the switch promises
 * exactly what the other side receives.
 */
export const SHARING_GIVES = [
  {
    key: 'SEE',
    elder: () => 'See how the friendship is going, step by step — they cannot change anything.',
    family: () => 'See how it is going, step by step.',
  },
  {
    key: 'UPDATES',
    elder: () => 'Follow the small updates thread on it, together with you and your helper.',
    family: name => `Follow the small updates thread, together with ${name} and their helper.`,
  },
  {
    key: 'TALK',
    elder: () => 'Talk to that helper too, once you and your helper are messaging.',
    family: name => `Talk to the helper yourself, once ${name} and the helper are messaging.`,
  },
  {
    key: 'POWERS',
    elder: () => 'Use anything you allow on the Act for me tab — those powers only work on friendships you share.',
    family: name => `Use anything ${name} lets you do for them — those powers only work on shared friendships.`,
  },
];

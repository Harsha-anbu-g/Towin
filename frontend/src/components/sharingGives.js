import { tr } from '../i18n';
/**
 * What turning on Sharing gives the family, in the words both sides read.
 * The elder's Sharing tab (MyFamily) and the family's shared-friendships
 * section (FamilyParent) both read this one list, so the switch promises
 * exactly what the other side receives.
 */
export const SHARING_GIVES = [
  {
    key: 'SEE',
    elder: () => tr('See how the friendship is going, step by step — they cannot change anything.'),
    family: () => tr('See how it is going, step by step.'),
  },
  {
    key: 'UPDATES',
    elder: () => tr('Follow the small updates thread on it, together with you and your helper.'),
    family: name => tr('Follow the small updates thread, together with {name} and their helper.', { name }),
  },
  {
    key: 'TALK',
    elder: () => tr('Talk to that helper too, once you and your helper are messaging.'),
    family: name => tr('Talk to the helper yourself, once {name} and the helper are messaging.', { name }),
  },
  {
    key: 'POWERS',
    elder: () => tr('Use anything you allow on the Act for me tab — those powers only work on friendships you share.'),
    family: name => tr('Use anything {name} lets you do for them — those powers only work on shared friendships.', { name }),
  },
];

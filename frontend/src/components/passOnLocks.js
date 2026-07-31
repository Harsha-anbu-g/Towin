/**
 * The words "What I pass on" uses, in one place.
 *
 * Shaped like familyPowers.js: the elder's own page, the Keyholder's acceptance
 * card and the saved one-page copy all read from this module, so a promise is
 * made, repeated and acted on in word-for-word identical language. Somebody
 * being asked to write down the last things they know should never meet two
 * descriptions of the same thing.
 *
 * Every string here comes from the reviewed design copy. Reword nothing without
 * changing it there first — the acknowledgements are stored with a hash of the
 * exact wording shown, and "this is not a will" is precisely the sentence
 * somebody will later dispute.
 */

/** The one-line subtitle under the page name. */
export const PAGE_LEAD =
  'Your stories, your letters, and the things only you know. You choose who sees each one.';

/**
 * The not-a-will primer. Short line always visible; the Quebec explanation
 * folded away behind a question, because the answer is four sentences long and
 * most visits do not need it.
 */
export const NOT_A_WILL = {
  short: 'This is not a will, and it does not replace one.',
  ask: "What's the difference?",
  long:
    'A will decides who gets your money, your home and your things. In Quebec a will can be '
    + 'written out by hand and signed by you, or made with a notary. Nothing you write on this '
    + 'page changes who gets what. Please tell your notary that this page exists.',
};

/** Who a story is for. `key` is the server's PassOnAudience value. */
export const AUDIENCES = [
  {
    key: 'EVERYONE',
    title: 'Anyone',
    blurb: 'Anyone who opens your page, including people you have never met.',
  },
  {
    key: 'FAMILY',
    title: 'My family',
    blurb: 'Only the family members on your family list.',
  },
  {
    key: 'HELPERS',
    title: 'My helpers',
    blurb: 'Only the helpers you have built up trust with.',
  },
  {
    key: 'PERSON',
    title: 'One person',
    blurb: 'One person you choose. Nobody else.',
  },
];

/**
 * Asked once, and only for the widest audience. Every other choice is a room she
 * already knows the size of; this one is the open street.
 */
export const ANYONE_CHECK = {
  title: 'Show this to anyone?',
  message:
    'Anyone who opens your page can read this, including people you have never met. '
    + 'You can change your mind later.',
  confirm: 'Yes, show it to anyone',
  cancel: 'Go back',
};

/**
 * The Story box's own warning. The whole appeal of the feature is writing down
 * the details of a life, and those details are exactly what a bank asks for.
 */
export const NOT_HERE =
  'Please keep things a bank would ask you — your first pet, the street you grew up on, '
  + 'your mother’s family name — out of here. Those belong in the Sealed box.';

export const STORY_BOX = {
  empty:
    'Nothing here yet. A story can be a small one — how you met, what you learned the hard way, '
    + 'the recipe nobody else has.',
  start: 'Tell a story',
  save: 'Save this story',
  namePrompt: 'Give it a name',
  namePlaceholder: 'The winter we lost the roof',
  bodyPrompt: 'Tell it',
  audiencePrompt: 'Who should see this?',
};

export const LETTERS = {
  empty: 'No letters yet. A letter goes to one person, and only that person.',
  /**
   * Where the release choice would be. The choice is absent rather than greyed
   * out: an elder writing a deathbed letter into a system with no working
   * delivery is the worst thing this feature could produce.
   */
  notYet:
    'Every letter here can be read today. We are still building the part where a letter opens '
    + 'after you are gone, and we will not offer it until we are sure it works. When it is ready '
    + 'we will tell you, and you will be able to change any letter over.',
  start: 'Write a letter',
  save: 'Save this letter',
  bodyPrompt: 'Write it',
  personPrompt: 'Who is this for?',
  readableNow: 'They can read this now',
  noneToWriteTo:
    'There is nobody to write to yet. Add someone to your family list, or build up trust with a '
    + 'helper, and they will appear here.',
};

/**
 * The Sealed box before it is set up. The three safety rows are the honest
 * promise in full, including the sentence most products leave out — that
 * somebody who broke into the company could read it.
 */
export const SEALED_BOX = {
  title: 'The things only you know.',
  body: 'Where the money is. Which bank. Where the papers are kept. Write them down once, here.',
  safetyHeading: 'How this is kept safe',
  safety: [
    'It is scrambled before we save it, and the key that unscrambles it is not kept anywhere near '
    + 'it. If someone stole our records, they could not read a word of what you wrote. If someone '
    + 'broke into the company itself, they could. We are not going to tell you otherwise.',
    'Only you can open your box. Every single time it is opened we write down when, and you can '
    + 'see that list.',
    'You can never be shut out of your own box. If you forget your password you reset it the way '
    + 'you always do, and your box is still there.',
  ],
  afterHeading: 'After you are gone',
  /**
   * The design copy said "print the one-page sheet" here. There is no print step
   * anywhere in this feature — the owner ruled the sheet digital-only on
   * 2026-07-30 — so it says save. Nothing else is changed.
   */
  after:
    'We are building the part where your Keyholders can ask to open this. It is not ready, and we '
    + 'will not switch it on until it is. So today you do two things: name the people you trust, '
    + 'so they know this exists — and save the one-page sheet and keep it with your will.',
};

/** Taking something down is permanent, so it is asked for in plain words. */
export const TAKE_DOWN = {
  title: 'Take this down?',
  message: 'It will be gone from your page, and nobody will be able to read it.',
  confirm: 'Take it down',
  cancel: 'Keep it',
};

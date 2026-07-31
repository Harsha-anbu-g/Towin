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

/**
 * "Sarah, David and Ruth" — the way a list of people is said out loud.
 *
 * Vocabulary rather than formatting, and shared, because the same three names are
 * read back to her in step two of setup and again in the card she is shown for the
 * seven days afterwards. Those two sentences must never disagree about who was
 * asked. No serial comma: it is a sentence about her family, not a citation.
 */
export const listOfNames = (names) => {
  const said = (names || []).filter(Boolean);
  if (said.length <= 1) return said[0] || '';
  return `${said.slice(0, -1).join(', ')} and ${said[said.length - 1]}`;
};

/**
 * Setting the Sealed box up: three steps, then a week to change her mind.
 *
 * The two sentences she ticks are deliberately NOT here. They come down from the
 * server with the setup state and are echoed back when she finishes, because the
 * server stores a hash of the exact wording shown. A second copy in this file
 * would drift from the hashed one, and the drift would be invisible — the record
 * would go on being written, of a sentence nobody could look up any more.
 */
export const SETUP = {
  start: 'Set this up',
  step: (n, of) => `Step ${n} of ${of}`,
  back: 'Go back',
  next: 'Next',
  finish: 'Finish setting this up',
  cancel: 'Not now',

  who: {
    title: 'Who can open it one day?',
    blurb:
      'Pick at least three people you trust. They must already be on your family list, '
      + 'and each one has to say yes before they count.',
    /** Fewer than three people on her family list: a dead end, said plainly. */
    tooFew: 'You need at least three people on your family list first.',
    tooFewLink: 'Go to my family list',
    /** Under the list, so she knows nothing has left yet. */
    nothingSentYet: 'Nobody is asked anything until you finish.',
  },

  howMany: {
    title: 'How many must agree?',
    blurb:
      'One day, when your Keyholders ask to open this, this many of them must agree. It is '
      + 'never all of them, so that one person who is far away — or who has passed on '
      + 'themselves — can never keep it shut forever.',
    /**
     * Rebuilt live from the real names and never softened. `names` is already
     * written out as "Sarah, David and Ruth".
     */
    inRealTerms: (agree, names, of) =>
      `So: any ${agree} of ${names}. That means ${agree} of them can open it even if the `
      + `${of - agree === 1 ? 'other one says' : 'others say'} no.`,
  },

  before: {
    title: 'Before you finish.',
    /** The hard gate. Nothing can be armed until her email is confirmed. */
    confirmEmail:
      'Please confirm your email address first. One day it is how we would reach you about '
      + 'your box, and we need to know it works.',
    confirmEmailLink: 'Go to my account settings',
    /** A Google-only account has no password, and the box is kept shut by nothing else. */
    needsPassword:
      'Your Sealed box is kept shut by your password, and this account signs in with Google. '
      + 'Please set a password first, then come back.',
    saveHeading: 'Keep a copy somewhere else',
    save:
      'Save your one-page copy, or send it to yourself in an email, and keep it wherever your '
      + 'family would think to look. Do not let this app be your only copy.',
    failed: 'We could not finish that. Please try again.',
  },

  /**
   * The seven days. A calm card, not an alarm — most people reading it set the box
   * up on purpose. The undo is the whole point of the week, so it is a real button
   * and never buried behind a menu.
   */
  settling: {
    title: 'Your box is set up.',
    body: (names) =>
      'Nothing can be opened by anyone but you. We will check with you once more in seven days '
      + `before this is settled, and we have written to ${names} to ask if they will hold a key.`,
    undo: 'If this was not your idea, undo it',
    /** Asked once, in her words, because the undo takes every key back with it. */
    confirmTitle: 'Undo the whole setup?',
    confirmMessage:
      'Your box stays exactly as it is, and everything you wrote stays where it is. The people '
      + 'you asked will stop being asked, and nobody is told you did this.',
    confirmYes: 'Yes, undo it',
    confirmNo: 'Leave it as it is',
    undone: 'That is undone. Nobody is holding a key.',
    undoFailed: 'We could not undo that. Please try again.',
  },

  /** Once the week has passed. Who holds a key, said with real names and real dates. */
  settled: {
    heading: 'Who can open it one day',
    threshold: (agree, of) => `${agree} of the ${of} must agree.`,
    saidYes: (name, when) => `${name} said yes on ${when}`,
    waiting: (name) => `${name} has not answered yet`,
    saidNo: (name) => `${name} said no`,
    steppedBack: (name) => `${name} is no longer holding a key`,
    change: 'Change',
  },
};

/**
 * The one readable thing about a sealed item: a chip, carrying no name, no address and no
 * amount. Keyed by the server's SealedKind.
 */
export const SEALED_KINDS = {
  MONEY: 'Money',
  PASSWORDS: 'Passwords',
  PAPERS: 'Papers',
  OTHER: 'Something else',
};

/**
 * Who a family writes to when the day comes.
 *
 * **This is a launch gate, and it is not met yet.** The spec requires a named human and a real
 * contact address with a stated turnaround before any elder sees this page; naming one is Task
 * 16's job and the owner's decision. Until then this is the same placeholder the Terms page
 * already publishes, and its `.example` domain is reserved by RFC 2606 precisely so it can
 * never be mistaken for a live mailbox. Replace both values here — there is one copy in the
 * product and this is it.
 */
export const RELEASE_CONTACT = {
  who: 'Towinly',
  email: 'support@towinly.example',
};

/**
 * The saved copy — one page she takes out of the app and keeps somewhere her family would
 * think to look.
 *
 * Digital only. There is no print step anywhere in this feature.
 *
 * The design copy fixes only the shape of this page and its last line: names of what is in the
 * box and never contents, who can open it and how many must agree, who to write to and what
 * they will be asked for, ending "This is not a will." The sentences below were written here
 * and are the ones to rewrite if the wording is wrong — except the closing line, which is the
 * design copy word for word and is the whole legal point of the page.
 *
 * Nothing about the Keyholders is written here. Those lines come from `SETUP.settled` through
 * `keyholderLine` below, so the saved copy, her own screen and the acceptance card can never
 * disagree about who said yes.
 */
export const SHEET = {
  /** The page around the copy, which is not part of the copy itself. */
  pageTitle: 'Your one-page copy',
  pageLead:
    'This is the copy you keep outside Towinly. Save it, and put it wherever your family would '
    + 'think to look. Do not let this app be your only copy.',
  save: 'Save this to my computer',
  saved: 'Saved. Now put it somewhere your family would look.',
  failedToSave: 'We could not save that file. Please try again.',
  back: 'Go back to my sealed box',
  loading: 'Getting your copy ready…',
  failed: 'We could not get your copy ready. Please try again.',
  lastSaved: when => `You last saved a copy on ${when}.`,
  neverSaved: 'You have not saved a copy yet.',
  /** What she is looking at, above the copy itself. */
  previewHeading: 'This is what you will save',
  /** The way in, from her sealed box. A page nobody can reach is a page that is not shipped. */
  linkFromBox: 'Save your one-page copy',

  // ── the copy itself, in the order it is read ──

  title: name => `What ${name} passes on`,
  madeOn: when => `Made on ${when}, from Towinly.`,

  inTheBox: {
    heading: 'What is in the sealed box',
    blurb:
      'These are the names of the things inside. What any of them says is not written here, and '
      + 'it is not written down anywhere outside Towinly.',
    empty: 'There is nothing in the box yet.',
    /** "Where the money is — Money". The name she gave it, then its chip. */
    line: (label, kind) => `${label} — ${kind}`,
  },

  whoCanOpen: {
    heading: 'Who can ask to open it',
    empty: 'Nobody has been asked yet.',
  },

  howToAsk: {
    heading: 'How your family asks for it to be opened',
    writeTo: (who, email) => `Write to ${who} at ${email}.`,
    askedFor: 'They will be asked for:',
    /**
     * The manual release procedure, said to a family rather than to an operator. It is written
     * out in full in docs/operations/sealed-box-release.md; these three lines are what somebody
     * holding this page needs to know before they start.
     */
    steps: name => [
      'a death certificate, which a person here reads and writes down',
      'word from each of the people above, one at a time, that they agree',
      `then a wait of thirty days, while Towinly keeps trying to reach ${name}`,
    ],
    /**
     * The sentence that stops a family waiting for something to happen on its own. There is no
     * button anywhere in Towinly that opens a box, and saying so here is kinder than letting
     * them find out by waiting.
     */
    thenWhat:
      'Only then does somebody here pass on what is in the box. None of this happens by itself, '
      + 'and there is no button anywhere that opens the box.',
  },

  /** The design copy's last line, and the whole legal point of the page. */
  closing: 'This is not a will.',
};

/**
 * "6 August" — the way a date is said out loud, not 06/08/2026. Matches the way the server
 * says a date back to her in the blocked-reveal line.
 *
 * Shared rather than repeated: the same date appears on her screen and in the file she keeps,
 * and two spellings of one day on one person's copy is exactly the kind of thing that makes
 * somebody doubt the whole page.
 */
export const onDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
};

/**
 * "6 August 2026" — the same day with the year on it, for the saved copy only.
 *
 * On her own screen the year is noise: everything there happened recently and she is reading it
 * today. The saved copy is the opposite case. It is a file in a drawer that somebody may open
 * years later, possibly beside an older copy of the same page, and a date without a year cannot
 * tell them which one to believe.
 */
export const onDayInFull = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * One person's real state, in the words she would use about it — "Sarah said yes on 2 June",
 * "David has not answered yet".
 *
 * Lives here because it is read in two places that must never disagree: her own sealed box
 * screen, and the copy she saves and her family reads after she is gone. Never softened into
 * "pending", because "David has not answered yet" is a sentence she may act on.
 */
export const keyholderLine = (person) => {
  if (person.status === 'ACTIVE') return SETUP.settled.saidYes(person.personName, onDay(person.respondedAt));
  if (person.status === 'INVITED') return SETUP.settled.waiting(person.personName);
  if (person.status === 'DECLINED') return SETUP.settled.saidNo(person.personName);
  return SETUP.settled.steppedBack(person.personName);
};

/**
 * Reading somebody else's page.
 *
 * The reviewed design copy fixes the title — "From Margaret" — and nothing else on this
 * screen, so the four lines below were written here. They are the ones to rewrite if the
 * wording is wrong. Every one takes the writer's name, because "this person" reads like a
 * form letter on a page somebody may be opening the week she died.
 */
export const FROM_PAGE = {
  title: name => `From ${name}`,
  lead: name => `What ${name} chose to share with you.`,
  empty: name => `${name} has not shared anything with you yet.`,
  /** A letter is written to one person. If you are reading one, it was written to you. */
  letterChip: 'A letter for you',
  failed: 'We could not open that page.',
  back: 'Go back',
  /** The way in, from the profile of the person whose page it is. */
  linkFromProfile: name => `What ${name} passes on`,
  linkBlurb: 'Her stories, and any letter she wrote to you.',
};

/**
 * Objecting to a story.
 *
 * A living person named in somebody else's story needs a way to say so, and until now a
 * report could only ever say "this person". The reasons are the four things people
 * actually object to about a story, in the words they would use — not the app's existing
 * "Inappropriate Behavior / Spam / Safety Concern", which describe messages, not memories.
 *
 * Not offered on letters: a letter is written to one person and reaches nobody else, so it
 * cannot name a third person to a room. A letter that is itself abusive is a complaint about
 * the writer, which is the report that already exists on her profile.
 */
export const REPORT_STORY = {
  open: 'Report this',
  reasonPrompt: 'What is wrong with it?',
  reasons: [
    'It says something untrue about me',
    'It should not be shown to people',
    'It is unkind or hurtful',
    'Something else',
  ],
  notePrompt: 'Tell us more (you can skip this)',
  send: 'Send this to Towinly',
  cancel: 'Never mind',
  sending: 'Sending…',
  sent: 'Thank you. Somebody at Towinly will read this.',
  failed: 'We could not send that. Please try again.',
};

/**
 * Being asked to hold a key, on the family member's own screen.
 *
 * The words are the design copy, with two substitutions the app cannot avoid. The copy is
 * written about a named woman — "Margaret has asked you… after she is gone… her Sealed box" —
 * and we do not know anybody's gender, so it says they/their, exactly as the rest of the
 * family screens already do. And the threshold sentence is rebuilt from the elder's real
 * numbers rather than the example's "two of the three", because a made-up number in a
 * sentence about somebody's death is the one thing this card must never contain.
 *
 * The sentence is left out altogether before she has chosen a threshold. That is a real
 * state: she can ask people before she picks the number.
 */
export const KEYHOLDER_ASK = {
  heading: name => `${name} has asked you to hold a key.`,
  body: name =>
    `One day, after they are gone, you would be one of the people who can ask to open `
    + `${name}'s Sealed box. You cannot see anything in it now and you never will unless that `
    + `day comes.`,
  /** Only when both numbers are real. `agree` is how many must say yes, `of` how many were asked. */
  threshold: (agree, of) =>
    `${agree} of the ${of} of you would have to agree, and someone here at Towinly would check first.`,
  yes: 'Yes, I will do that',
  no: 'No thanks',
  /** Under every card, every time. Nobody is held to this. */
  reassurance: 'You can change your mind whenever you like.',
  /** Written here rather than in the design copy, which does not cover the failure. */
  failed: 'We could not send your answer. Please try again.',
  accepted: name => `Thank you. ${name} will see that you said yes.`,
  declined: 'That is fine. Nothing more is needed from you.',
};

/** Taking something down is permanent, so it is asked for in plain words. */
export const TAKE_DOWN = {
  title: 'Take this down?',
  message: 'It will be gone from your page, and nobody will be able to read it.',
  confirm: 'Take it down',
  cancel: 'Keep it',
};

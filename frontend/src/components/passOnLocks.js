import { dateLocale, tr } from '../i18n';
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

/**
 * The way in, from the elder's own dashboard.
 *
 * A card on her landing tab, and deliberately not a sixth dashboard tab: below
 * 640px that tab strip becomes a two-column grid whose icons are written out one
 * by one, so a new tab there would arrive with no icon at all.
 *
 * The summary line is the reason the card exists. "My boxes" on its own names a
 * door and nothing behind it; "3 stories · 2 letters · your box is shut" is her
 * own page read back to her, so she knows what she is opening before she taps.
 */
export const MY_BOXES = {
  get title() { return tr('My boxes'); },
  /** Shared with pageLead() below, so the card and the page it opens cannot drift apart. */
  get lead() { return tr('Your stories, your letters, and the things only you know.'); },
  get open() { return tr('Open my boxes'); },
  /**
   * Said in words rather than as "0 stories · 0 letters". This is a card on the
   * first screen she sees every day, and a row of zeros on it reads as a
   * standing reproach for not having written her life down yet.
   */
  get empty() { return tr('Nothing in your boxes yet. Start whenever you like.'); },
  /**
   * What is in them, said out loud.
   *
   * A count she has none of is left out rather than shown as zero, and the sealed
   * box is named only once she has really set one up — mentioning a box she has
   * never opened would be an invitation she did not ask for. Singulars are spelled
   * out for the same reason "1 thing is" is: a screen for somebody in her eighties
   * that says "1 stories" is a screen that looks like nobody checked it.
   */
  summary: ({ stories = 0, letters = 0, shut = false } = {}) => {
    const said = [];
    if (stories) said.push(stories === 1 ? tr('1 story') : tr('{stories} stories', { stories }));
    if (letters) said.push(letters === 1 ? tr('1 letter') : tr('{letters} letters', { letters }));
    if (shut) said.push(tr('your box is shut'));
    return said.length ? said.join(' · ') : MY_BOXES.empty;
  },
};

/**
 * The one-line subtitle under the page name.
 *
 * Built from `MY_BOXES.lead` rather than repeated, because the same sentence is
 * the whole of what the dashboard card promises. The words are unchanged from the
 * reviewed design copy.
 */
export const pageLead = () => `${MY_BOXES.lead} ${tr('You choose who sees each one.')}`;

/**
 * The not-a-will primer. Short line always visible; the explanation folded away
 * behind a question, because most visits do not need it.
 *
 * Deliberately names no country and no profession. What makes a will valid
 * differs everywhere, so a sentence that is true in one place is wrong advice
 * in another — this points her at whoever helps her with her will instead.
 */
export const NOT_A_WILL = {
  get short() { return tr('This is not a will, and it does not replace one.'); },
  get ask() { return tr("What's the difference?"); },
  get long() { return tr('A will decides who gets your money, your home and your things. Nothing you write on this page changes who gets what. If you have a will, please tell whoever helped you make it that this page exists.'); },
};

/** Who a story is for. `key` is the server's PassOnAudience value. */
export const AUDIENCES = [
  {
    key: 'EVERYONE',
    get title() { return tr('Anyone'); },
    get blurb() { return tr('Anyone who opens your page, including people you have never met.'); },
  },
  {
    key: 'FAMILY',
    get title() { return tr('My family'); },
    get blurb() { return tr('Only the family members on your family list.'); },
  },
  {
    key: 'HELPERS',
    get title() { return tr('My helpers'); },
    get blurb() { return tr('Only the helpers you have built up trust with.'); },
  },
  {
    key: 'PERSON',
    get title() { return tr('One person'); },
    get blurb() { return tr('One person you choose. Nobody else.'); },
  },
];

/**
 * Asked once, and only for the widest audience. Every other choice is a room she
 * already knows the size of; this one is the open street.
 */
export const ANYONE_CHECK = {
  get title() { return tr('Show this to anyone?'); },
  get message() { return tr('Anyone who opens your page can read this, including people you have never met. You can change your mind later.'); },
  get confirm() { return tr('Yes, show it to anyone'); },
  get cancel() { return tr('Go back'); },
};

/**
 * The Story box's own warning. The whole appeal of the feature is writing down
 * the details of a life, and those details are exactly what a bank asks for.
 */
export const NOT_HERE =
  'Please keep things a bank would ask you — your first pet, the street you grew up on, '
  + 'your mother’s family name — out of here. Those belong in the Sealed box.';

export const STORY_BOX = {
  get empty() { return tr('Nothing here yet. A story can be a small one — how you met, what you learned the hard way, the recipe nobody else has.'); },
  get start() { return tr('Tell a story'); },
  get save() { return tr('Save this story'); },
  get namePrompt() { return tr('Give it a name'); },
  get namePlaceholder() { return tr('The winter we lost the roof'); },
  get bodyPrompt() { return tr('Tell it'); },
  get audiencePrompt() { return tr('Who should see this?'); },
};

export const LETTERS = {
  get empty() { return tr('No letters yet. A letter goes to one person, and only that person.'); },
  /**
   * What the Letter box is, now that both halves of it exist.
   *
   * This replaced a paragraph that said the after-you-are-gone half was still being
   * built. It is built, so the paragraph had to go — but the sentence that mattered
   * in it is kept and made louder: nothing happens on its own. There is no timer
   * anywhere in this feature and no button that opens anything, and an elder who
   * believes otherwise is an elder who has quietly decided this app will tell her
   * daughter she has died.
   */
  get howItWorks() { return tr('Every letter can be read today, or held until after you are gone. Nothing opens on its own. Before a held letter is passed on, a person here at Towinly checks a death certificate, asks the people you chose, and tries to reach you for thirty days.'); },
  get start() { return tr('Write a letter'); },
  get save() { return tr('Save this letter'); },
  get bodyPrompt() { return tr('Write it'); },
  get personPrompt() { return tr('Who is this for?'); },
  get readableNow() { return tr('They can read this now'); },
  /**
   * The counterpart chip, on a letter she has asked to be held.
   *
   * "Held" and not "locked", "sealed", "pending" or "scheduled". She is looking at a
   * list of her own writing, and the one word describing the letter she wrote to her
   * daughter for after her death should be a word she can read without flinching.
   */
  get heldUntilGone() { return tr('Held until after you are gone'); },
  get noneToWriteTo() { return tr('There is nobody to write to yet. Add someone to your family list, or build up trust with a helper, and they will appear here.'); },

  // ── when the person she named can read it ──

  get whenPrompt() { return tr('When can they read it?'); },
  /**
   * The two choices, shaped like AUDIENCES so both render through the same cards.
   * `key` is the server's PassOnRelease value.
   *
   * The second blurb is the whole procedure, said to her rather than to an operator:
   * a person, a death certificate, her own people asked one at a time, thirty days of
   * trying to reach her. It promises nothing automatic because nothing is automatic,
   * and it is the sentence to change if the procedure ever changes.
   */
  WHEN: [
    {
      key: 'NOW',
      get title() { return tr('They can read it now'); },
      get blurb() { return tr('It goes on your page as soon as you save it, for the one person you chose.'); },
    },
    {
      key: 'AFTER',
      get title() { return tr("Only after I'm gone"); },
      get blurb() { return tr('Nobody sees this until someone at Towinly has checked a death certificate, asked the people you chose, and tried to reach you for thirty days.'); },
    },
  ],
  /**
   * Why the second choice is greyed out, and the one thing that turns it on.
   *
   * Her Keyholders and her quorum live in the Sealed box, and until she has set that
   * up there is nobody who could ever ask for a held letter to be opened — so a letter
   * held today could never be delivered by anybody. The choice is shown and disabled
   * rather than hidden: an option she cannot see is an option she cannot go and earn.
   */
  get needsKeyholders() { return tr('First choose the people who can open things for you, in your Sealed box. Then you can hold a letter until after you are gone.'); },
  get needsKeyholdersLink() { return tr('Go to my Sealed box'); },
};

/**
 * The Sealed box before it is set up. The three safety rows are the honest
 * promise in full, including the sentence most products leave out — that
 * somebody who broke into the company could read it.
 */
export const SEALED_BOX = {
  get title() { return tr('The things only you know.'); },
  get body() { return tr('Where the money is. Which bank. Where the papers are kept. Write them down once, here.'); },
  get safetyHeading() { return tr('How this is kept safe'); },
  get safety() {
    return [
      tr('It is scrambled before we save it, and the key that unscrambles it is not kept anywhere near '
        + 'it. If someone stole our records, they could not read a word of what you wrote. If someone '
        + 'broke into the company itself, they could. We are not going to tell you otherwise.'),
      tr('Only you can open your box. Every single time it is opened we write down when, and you can '
        + 'see that list.'),
      tr('You can never be shut out of your own box. If you forget your password you reset it the way '
        + 'you always do, and your box is still there.'),
    ];
  },
  get afterHeading() { return tr('After you are gone'); },
  /**
   * The design copy said "print the one-page sheet" here. There is no print step
   * anywhere in this feature — the owner ruled the sheet digital-only on
   * 2026-07-30 — so it says save. Nothing else is changed.
   */
  get after() { return tr('We are building the part where your Keyholders can ask to open this. It is not ready, and we will not switch it on until it is. So today you do two things: name the people you trust, so they know this exists — and save the one-page sheet and keep it with your will.'); },
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
  return tr('{first} and {last}', { first: said.slice(0, -1).join(', '), last: said[said.length - 1] });
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
  get start() { return tr('Set this up'); },
  step: (n, of) => tr('Step {n} of {of}', { n, of }),
  get back() { return tr('Go back'); },
  get next() { return tr('Next'); },
  get finish() { return tr('Finish setting this up'); },
  get cancel() { return tr('Not now'); },

  who: {
    get title() { return tr('Who can open it one day?'); },
    get blurb() { return tr('Pick at least three people you trust. They must already be on your family list, and each one has to say yes before they count.'); },
    /** Fewer than three people on her family list: a dead end, said plainly. */
    get tooFew() { return tr('You need at least three people on your family list first.'); },
    get tooFewLink() { return tr('Go to my family list'); },
    /** Under the list, so she knows nothing has left yet. */
    get nothingSentYet() { return tr('Nobody is asked anything until you finish.'); },
  },

  howMany: {
    get title() { return tr('How many must agree?'); },
    get blurb() { return tr('One day, when your Keyholders ask to open this, this many of them must agree. It is never all of them, so that one person who is far away — or who has passed on themselves — can never keep it shut forever.'); },
    /**
     * Rebuilt live from the real names and never softened. `names` is already
     * written out as "Sarah, David and Ruth".
     */
    inRealTerms: (agree, names, of) =>
      of - agree === 1
        ? tr('So: any {agree} of {names}. That means {agree} of them can open it even if the other one says no.', { agree, names })
        : tr('So: any {agree} of {names}. That means {agree} of them can open it even if the others say no.', { agree, names }),
  },

  before: {
    get title() { return tr('Before you finish.'); },
    /** The hard gate. Nothing can be armed until her email is confirmed. */
    get confirmEmail() { return tr('Please confirm your email address first. One day it is how we would reach you about your box, and we need to know it works.'); },
    get confirmEmailLink() { return tr('Go to my account settings'); },
    /** A Google-only account has no password, and the box is kept shut by nothing else. */
    get needsPassword() { return tr('Your Sealed box is kept shut by your password, and this account signs in with Google. Please set a password first, then come back.'); },
    get saveHeading() { return tr('Keep a copy somewhere else'); },
    /**
     * The download, and only the download.
     *
     * The design copy also offered "or send it to yourself in an email". There is no such
     * path anywhere in this feature — no mailto, no send-to-self, nothing that puts the sheet
     * in a mailbox — so the offer came off rather than the wording being kept. The sentence
     * that matters is the last one, and it is the reason this row exists at all: an app that
     * holds the only copy of where somebody's money is has not solved the problem it set out
     * to solve.
     */
    get save() { return tr('Save your one-page copy to your computer, and keep it wherever your family would think to look. Do not let this app be your only copy.'); },
    get failed() { return tr('We could not finish that. Please try again.'); },
  },

  /**
   * The seven days. A calm card, not an alarm — most people reading it set the box
   * up on purpose. The undo is the whole point of the week, so it is a real button
   * and never buried behind a menu.
   */
  settling: {
    get title() { return tr('Your box is set up.'); },
    body: (names) =>
      tr('Nothing can be opened by anyone but you. We will check with you once more in seven days before this is settled, and we have written to {names} to ask if they will hold a key.', { names }),
    get undo() { return tr('If this was not your idea, undo it'); },
    /** Asked once, in her words, because the undo takes every key back with it. */
    get confirmTitle() { return tr('Undo the whole setup?'); },
    get confirmMessage() { return tr('Your box stays exactly as it is, and everything you wrote stays where it is. The people you asked will stop being asked, and nobody is told you did this.'); },
    get confirmYes() { return tr('Yes, undo it'); },
    get confirmNo() { return tr('Leave it as it is'); },
    get undone() { return tr('That is undone. Nobody is holding a key.'); },
    get undoFailed() { return tr('We could not undo that. Please try again.'); },
  },

  /** Once the week has passed. Who holds a key, said with real names and real dates. */
  settled: {
    get heading() { return tr('Who can open it one day'); },
    threshold: (agree, of) => tr('{agree} of the {of} must agree.', { agree, of }),
    saidYes: (name, when) => tr('{name} said yes on {when}', { name, when }),
    waiting: (name) => tr('{name} has not answered yet', { name }),
    saidNo: (name) => tr('{name} said no', { name }),
    steppedBack: (name) => tr('{name} is no longer holding a key', { name }),
    get change() { return tr('Change'); },
  },
};

/**
 * The one readable thing about a sealed item: a chip, carrying no name, no address and no
 * amount. Keyed by the server's SealedKind.
 */
export const SEALED_KINDS = {
  get MONEY() { return tr('Money'); },
  get PASSWORDS() { return tr('Passwords'); },
  get PAPERS() { return tr('Papers'); },
  get OTHER() { return tr('Something else'); },
};

/**
 * What is in the box, and putting something in it.
 *
 * The design copy fixes the top line ("Your box is shut. 3 things are inside. Nobody can see
 * them but you."), the word "Locked", [See this], "Type your password to see this.", the name
 * prompt and its promise, and [Lock this away]. Everything else here was written for this
 * screen and is the wording to change if it is wrong.
 *
 * <b>Nothing here ever describes what an item says.</b> The list this screen renders has no
 * body field on it at all — that is the server's design — so there is no preview to write copy
 * for, and there must never be one. A card that clips the first line of "where the money is"
 * hands it to whoever is standing behind her.
 */
export const SEALED_ITEMS = {
  /**
   * "3 things are inside" — and "1 thing is", because a screen for somebody in their
   * eighties that says "1 things" is a screen that looks like nobody checked it.
   */
  shut: (count) =>
    count === 1
      ? tr('Your box is shut. 1 thing is inside. Nobody can see them but you.')
      : tr('Your box is shut. {count} things are inside. Nobody can see them but you.', { count }),
  /** A box that is set up with nothing in it yet. Said plainly, never as an empty list. */
  get nothingInside() { return tr('Your box is shut. There is nothing in it yet. Nobody can see what you put in but you.'); },

  get locked() { return tr('Locked'); },
  /**
   * What the same word says while she is looking at the thing. A card still reading "Locked"
   * over its own open contents is the app telling her something she can see is not true.
   */
  get unlocked() { return tr('Open'); },
  get see() { return tr('See this'); },
  get remove() { return tr('Delete'); },

  /** The inline row. Not a dialog: she is looking at the card she asked about. */
  get askPassword() { return tr('Type your password to see this.'); },
  get passwordLabel() { return tr('Your password'); },
  get show() { return tr('Show it to me'); },
  showing: 'Opening…',
  get neverMind() { return tr('Never mind'); },
  /** On a shared family laptop, being able to put it away again matters as much as opening it. */
  get hide() { return tr('Hide this again'); },
  get needsPassword() { return tr('Please type your password.'); },
  get failedToOpen() { return tr('We could not open that. Please try again.'); },

  get add() { return tr('Put something in'); },
  get namePrompt() { return tr('What is it?'); },
  /**
   * The whole reason the name is encrypted too, said to her rather than kept in a design
   * document. It is a promise the database keeps: there is no readable label column.
   */
  get nameHelp() { return tr('Give it a name you would recognise. Nobody else ever sees this name, not even your Keyholders.'); },
  get namePlaceholder() { return tr('Where the money is'); },
  get bodyPrompt() { return tr('Write it down'); },
  get kindPrompt() { return tr('What kind of thing is it?'); },
  get save() { return tr('Lock this away'); },
  get saving() { return tr('Locking it away…'); },
  get cancel() { return tr('Cancel'); },
  get saved() { return tr('That is locked away.'); },
  get needsName() { return tr('Please give it a name.'); },
  get needsBody() { return tr('Please write something before you save it.'); },
  get needsKind() { return tr('Please choose what kind of thing this is.'); },
  get failedToSave() { return tr('We could not save that. Please try again.'); },
  get removed() { return tr('That is out of your box.'); },
  get failedToRemove() { return tr('We could not take that out. Please try again.'); },
};

/**
 * The refusal after a password change, and the one thing the screen adds to it.
 *
 * The sentence itself is the server's — `SealedBoxService.frozenMessage` builds it with the
 * real date on which the freeze lifts, so it is rendered exactly as it arrives and never
 * rebuilt here. What the screen adds is the missing half of "tell us straight away": a person
 * to write to. Whoever reads an elder's email can reset her password, and this refusal is the
 * only thing standing between that and her bank details — so it must end somewhere she can
 * actually go, not in a feedback form.
 *
 * `prefix` is how the screen knows it is looking at that refusal rather than a wrong password.
 * It is the opening of the server's sentence, and it is only ever used to decide whether to
 * show the contact line — the words on screen are always the server's own.
 */
export const FROZEN = {
  get prefix() { return tr('You changed your password recently.'); },
  /**
   * @param email the configured release address, from the server. When there is none she is
   *   told that plainly — see `RELEASE_CONTACT` for why an invented address is worse than
   *   none at all. Written as a function so it is read at call time, which is what lets it
   *   sit above the constants it uses.
   */
  tellUs: email => (email ? writeToUs(email) : RELEASE_CONTACT.notSetYet),
};

/** Taking something out of the box cannot be undone by anybody, so it is asked for plainly. */
export const TAKE_OUT_OF_BOX = {
  get title() { return tr('Take this out of the box?'); },
  get message() { return tr('It will be gone for good. Nobody will be able to read it again, and that includes you.'); },
  get confirm() { return tr('Take it out'); },
  get cancel() { return tr('Keep it'); },
};

/**
 * Who a family writes to when the day comes.
 *
 * **The address is not here, and it must never be put here.** It is deployment configuration —
 * `SEALED_BOX_RELEASE_CONTACT_EMAIL` on the server — and it arrives with the sheet and the
 * setup state. When it is unset, the answer is `notSetYet`, said out loud.
 *
 * The reason is the page it is printed on. This address goes onto the one-page copy an elder
 * keeps with her will, read years later by somebody in the week after a death, and it is the
 * only route they have into the release procedure. A plausible-looking mailbox that cannot
 * receive mail is worse than an admission, not better: it looks real, so they write to it,
 * and nothing comes back and they never find out why. "We have not set one yet" is at least
 * something a family can act on.
 *
 * **This is still a launch gate.** The spec requires a named human and a real address with a
 * stated turnaround before any elder sees this page. Setting the variable is the whole of it.
 */
export const RELEASE_CONTACT = {
  who: 'Towinly',
  /** Said in place of an address, never beside one. */
  get notSetYet() { return tr('Towinly has not set an address to write to yet.'); },
};

/**
 * The one sentence that carries the address, so her own screen and the copy her family keeps
 * can never spell it differently.
 */
const writeToUs = email => tr('Write to {who} at {email}.', { who: RELEASE_CONTACT.who, email });

/**
 * What the saved copy says instead, when there is no address.
 *
 * It adds the one thing a family holding the page cannot work out for themselves: the page
 * will carry the address once there is one, so it is worth saving again. On her own screen
 * that sentence would be noise — she is looking at a live page — so only the sheet says it.
 */
const noAddressOnTheSheet = () =>
  `${RELEASE_CONTACT.notSetYet} `
  + tr('Save a new copy of this page from time to time, and the address will be on it once it is set.');

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
  get pageTitle() { return tr('Your one-page copy'); },
  get pageLead() { return tr('This is the copy you keep outside Towinly. Save it, and put it wherever your family would think to look. Do not let this app be your only copy.'); },
  get save() { return tr('Save this to my computer'); },
  get saved() { return tr('Saved. Now put it somewhere your family would look.'); },
  get failedToSave() { return tr('We could not save that file. Please try again.'); },
  get back() { return tr('Go back to my sealed box'); },
  get loading() { return tr('Getting your copy ready…'); },
  get failed() { return tr('We could not get your copy ready. Please try again.'); },
  lastSaved: when => tr('You last saved a copy on {when}.', { when }),
  get neverSaved() { return tr('You have not saved a copy yet.'); },
  /** What she is looking at, above the copy itself. */
  get previewHeading() { return tr('This is what you will save'); },
  /** The way in, from her sealed box. A page nobody can reach is a page that is not shipped. */
  get linkFromBox() { return tr('Save your one-page copy'); },

  // ── the copy itself, in the order it is read ──

  title: name => tr('What {name} passes on', { name }),
  madeOn: when => tr('Made on {when}, from Towinly.', { when }),

  inTheBox: {
    get heading() { return tr('What is in the sealed box'); },
    get blurb() { return tr('These are the names of the things inside. What any of them says is not written here, and it is not written down anywhere outside Towinly.'); },
    get empty() { return tr('There is nothing in the box yet.'); },
    /** "Where the money is — Money". The name she gave it, then its chip. */
    line: (label, kind) => `${label} — ${kind}`,
  },

  whoCanOpen: {
    get heading() { return tr('Who can ask to open it'); },
    get empty() { return tr('Nobody has been asked yet.'); },
  },

  howToAsk: {
    get heading() { return tr('How your family asks for it to be opened'); },
    /** @param email the configured address, or nothing when this deployment has not set one. */
    writeTo: email => (email ? writeToUs(email) : noAddressOnTheSheet()),
    /** The same sentence as a value, so the page and its tests can name what a family reads. */
    get noAddressYet() { return noAddressOnTheSheet(); },
    get askedFor() { return tr('They will be asked for:'); },
    /**
     * The manual release procedure, said to a family rather than to an operator. It is written
     * out in full in docs/operations/sealed-box-release.md; these three lines are what somebody
     * holding this page needs to know before they start.
     */
    steps: name => [
      tr('a death certificate, which a person here reads and writes down'),
      tr('word from each of the people above, one at a time, that they agree'),
      tr('then a wait of thirty days, while Towinly keeps trying to reach {name}', { name }),
    ],
    /**
     * The sentence that stops a family waiting for something to happen on its own. There is no
     * button anywhere in Towinly that opens a box, and saying so here is kinder than letting
     * them find out by waiting.
     */
    get thenWhat() { return tr('Only then does somebody here pass on what is in the box. None of this happens by itself, and there is no button anywhere that opens the box.'); },
  },

  /** The design copy's last line, and the whole legal point of the page. */
  get closing() { return tr('This is not a will.'); },
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
  return date.toLocaleDateString(dateLocale('en-GB'), { day: 'numeric', month: 'long' });
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
  return date.toLocaleDateString(dateLocale('en-GB'), { day: 'numeric', month: 'long', year: 'numeric' });
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
  title: name => tr('From {name}', { name }),
  lead: name => tr('What {name} chose to share with you.', { name }),
  empty: name => tr('{name} has not shared anything with you yet.', { name }),
  /** A letter is written to one person. If you are reading one, it was written to you. */
  get letterChip() { return tr('A letter for you'); },
  get failed() { return tr('We could not open that page.'); },
  get back() { return tr('Go back'); },
  /** The way in, from the profile of the person whose page it is. */
  linkFromProfile: name => tr('What {name} passes on', { name }),
  get linkBlurb() { return tr('Her stories, and any letter she wrote to you.'); },
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
  get open() { return tr('Report this'); },
  get reasonPrompt() { return tr('What is wrong with it?'); },
  reasons: [
    'It says something untrue about me',
    'It should not be shown to people',
    'It is unkind or hurtful',
    'Something else',
  ],
  get notePrompt() { return tr('Tell us more (you can skip this)'); },
  get send() { return tr('Send this to Towinly'); },
  get cancel() { return tr('Never mind'); },
  sending: 'Sending…',
  get sent() { return tr('Thank you. Somebody at Towinly will read this.'); },
  get failed() { return tr('We could not send that. Please try again.'); },
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
  heading: name => tr('{name} has asked you to hold a key.', { name }),
  body: name =>
    tr("One day, after they are gone, you would be one of the people who can ask to open {name}'s Sealed box. You cannot see anything in it now and you never will unless that day comes.", { name }),
  /** Only when both numbers are real. `agree` is how many must say yes, `of` how many were asked. */
  threshold: (agree, of) =>
    tr('{agree} of the {of} of you would have to agree, and someone here at Towinly would check first.', { agree, of }),
  get yes() { return tr('Yes, I will do that'); },
  get no() { return tr('No thanks'); },
  /** Under every card, every time. Nobody is held to this. */
  get reassurance() { return tr('You can change your mind whenever you like.'); },
  /** Written here rather than in the design copy, which does not cover the failure. */
  get failed() { return tr('We could not send your answer. Please try again.'); },
  accepted: name => tr('Thank you. {name} will see that you said yes.', { name }),
  get declined() { return tr('That is fine. Nothing more is needed from you.'); },
};

/** Taking something down is permanent, so it is asked for in plain words. */
export const TAKE_DOWN = {
  get title() { return tr('Take this down?'); },
  get message() { return tr('It will be gone from your page, and nobody will be able to read it.'); },
  get confirm() { return tr('Take it down'); },
  get cancel() { return tr('Keep it'); },
};

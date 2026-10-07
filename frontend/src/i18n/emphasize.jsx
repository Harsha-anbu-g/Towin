// One sentence, one highlighted part, any word order.
//
// A line like "How trust grows" with "trust" in gold used to be three separate
// pieces of text, which cannot be translated: French and Tamil put the word
// somewhere else. The sentence is translated whole, with the highlighted parts
// between asterisks, and drawn here:
//   emphasize(tr('How *trust* grows'), (part) => <span className="gold">{part}</span>)
//   emphasize(tr('How *trust* grows'), { color: 'gold' })   // a style object works too
// The render function also gets which highlight it is drawing (0, 1, …), for a
// sentence with two links: 'I agree to the *Terms* and the *Privacy Policy*'.
export default function emphasize(sentence, render) {
  const draw = typeof render === 'function' ? render : (part) => <span style={render}>{part}</span>;
  return String(sentence)
    .split('*')
    .map((part, i) => (i % 2 === 1 ? <span key={i}>{draw(part, (i - 1) / 2)}</span> : part));
}

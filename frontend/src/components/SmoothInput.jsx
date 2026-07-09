import { forwardRef } from 'react';

// Plain native text input with the browser's default caret.
//
// This once rendered a custom spring-animated caret (it hid the native caret
// and drew a measured overlay bar on top). That overlay had to re-derive the
// input's own horizontal scroll to place itself, so it drifted and clipped once
// a value overflowed the field. It's gone — the whole app uses the default
// caret now. The component is kept as a thin wrapper only so `wrapperStyle`
// callers (flex/grid children, e.g. flex:1 in a row) keep their layout.
const SmoothInput = forwardRef(function SmoothInput({ wrapperStyle, ...props }, ref) {
  const input = <input {...props} ref={ref} />;

  return wrapperStyle ? (
    <span style={{ display: 'block', width: '100%', ...wrapperStyle }}>{input}</span>
  ) : (
    input
  );
});

export default SmoothInput;

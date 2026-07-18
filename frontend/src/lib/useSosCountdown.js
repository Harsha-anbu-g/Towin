import { useState, useRef, useEffect } from 'react';

// SOS safety window: the first press arms a short countdown instead of sending
// right away, so an accidental tap can be canceled before contacts are alarmed.
export function useSosCountdown(send, seconds = 5) {
  const [countdown, setCountdown] = useState(null);
  const timerRef = useRef(null);
  const sendRef = useRef(send);
  // Latest-ref pattern: refs must not be written during render, so keep the
  // freshest `send` via an effect that runs after every render.
  useEffect(() => { sendRef.current = send; });

  const clear = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  useEffect(() => clear, []);

  const press = () => {
    if (timerRef.current) {
      clear();
      setCountdown(null);
      return;
    }
    // Track the remaining seconds locally: state updaters must stay pure
    // (StrictMode double-invokes them in dev), so the send fires out here.
    let remaining = seconds;
    setCountdown(remaining);
    timerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clear();
        setCountdown(null);
        sendRef.current();
        return;
      }
      setCountdown(remaining);
    }, 1000);
  };

  return { countdown, press };
}

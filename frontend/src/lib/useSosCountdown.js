import { useState, useRef, useEffect } from 'react';

// SOS safety window: the first press arms a short countdown instead of sending
// right away, so an accidental tap can be canceled before contacts are alarmed.
export function useSosCountdown(send, seconds = 5) {
  const [countdown, setCountdown] = useState(null);
  const timerRef = useRef(null);
  const sendRef = useRef(send);
  sendRef.current = send;

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
    setCountdown(seconds);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clear();
          sendRef.current();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return { countdown, press };
}

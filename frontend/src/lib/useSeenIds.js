import { useState, useCallback } from 'react';

// Tracks which item "tokens" a user has already seen, persisted in localStorage,
// so dashboard tabs can show a red badge for new activity — no backend needed.
// A token is any string that changes when the item becomes notification-worthy
// (e.g. `${connectionId}:${status}` so a pending→active accept shows as new).
export function useSeenIds(userId, category) {
  const storageKey = `towin_seen_${userId || 'anon'}_${category}`;

  const [seen, setSeen] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    } catch {
      return new Set();
    }
  });

  const unseenCount = useCallback(
    (tokens) => tokens.reduce((n, t) => (seen.has(t) ? n : n + 1), 0),
    [seen],
  );

  const markSeen = useCallback((tokens) => {
    setSeen((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const t of tokens) {
        if (!next.has(t)) { next.add(t); changed = true; }
      }
      if (!changed) return prev; // no change → no re-render, avoids effect loops
      const arr = [...next].slice(-300); // cap so storage can't grow unbounded
      try { localStorage.setItem(storageKey, JSON.stringify(arr)); } catch { /* storage full/blocked — seen-state just won't persist */ }
      return new Set(arr);
    });
  }, [storageKey]);

  return { unseenCount, markSeen };
}

import { clsx } from 'clsx';

export function cn(...inputs) {
  return clsx(inputs);
}

// The backend serializes naive LocalDateTime values (UTC wall-clock, no zone),
// e.g. "2026-06-30T14:23:45". `new Date()` would misread a zone-less datetime
// as *local* time and shift it by the browser's offset. Treat it as UTC unless
// it already carries a zone designator (Z or ±HH:MM).
export function parseServerDate(iso) {
  if (!iso) return null;
  const hasZone = /[zZ]$|[+-]\d\d:?\d\d$/.test(iso);
  const d = new Date(hasZone ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? null : d;
}

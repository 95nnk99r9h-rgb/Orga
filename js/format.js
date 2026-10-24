// Small, dependency-free formatting helpers shared by store and views.

export const pad = (n) => String(n).padStart(3, '0');

export const boxTitle = (box) => box.title?.trim() || `Kiste ${pad(box.number)}`;

// A location is { shelf: 'A', level: 2 }, { away: true } or null (no fixed place).
export function locKey(loc) {
  if (!loc) return 'none';
  if (loc.away) return 'away';
  return `${loc.shelf}${loc.level}`;
}

export function parseLocKey(key) {
  if (key === 'none') return null;
  if (key === 'away') return { away: true };
  const m = /^([A-Z]+)(\d+)$/.exec(key);
  return m ? { shelf: m[1], level: Number(m[2]) } : null;
}

export const sameLoc = (a, b) => locKey(a) === locKey(b);

export function locShort(loc) {
  if (!loc) return 'Ohne Platz';
  if (loc.away) return 'Entnommen';
  return `${loc.shelf}${loc.level}`;
}

export function locLong(loc) {
  if (!loc) return 'Ohne festen Platz';
  if (loc.away) return 'Nicht im Keller';
  return `Regal ${loc.shelf} · Boden ${loc.level}`;
}

export function normalize(s) {
  return String(s ?? '')
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss');
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function splitItems(text) {
  return String(text ?? '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const rtf = new Intl.RelativeTimeFormat('de', { numeric: 'auto' });
const UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

export function relTime(ts) {
  const diff = (ts - Date.now()) / 1000;
  for (const [unit, sec] of UNITS) {
    if (Math.abs(diff) >= sec) return rtf.format(Math.round(diff / sec), unit);
  }
  return 'gerade eben';
}

const dtf = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
export const dateLabel = (ts) => dtf.format(ts);

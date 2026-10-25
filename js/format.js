// Small, dependency-free formatting helpers shared by store and views.

export const pad = (n) => String(n).padStart(3, '0');

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Everything with a number is stored as a "box"; its kind tells a real box
// from a large item that stands on its own (rollator, display stand …).
export const KINDS = {
  box: { name: 'Kiste', plural: 'Kisten' },
  item: { name: 'Einzelstück', plural: 'Einzelstücke' },
};
export const kindOf = (box) => KINDS[box.kind] ?? KINDS.box;
export const unitName = (box) => `${kindOf(box).name} ${pad(box.number)}`;

// A box is described by its contents only, a loose item by its title only.
// boxTitle is the line shown in lists, boxHeading the name on its own page.
export function boxTitle(box) {
  if (box.kind === 'item') return box.title?.trim() || unitName(box);
  return box.items.length ? box.items.join(', ') : `${unitName(box)} · noch leer`;
}
export const boxHeading = (box) => (box.kind === 'item' ? boxTitle(box) : unitName(box));

// "3 Kisten", "1 Einzelstück" or "3 Kisten, 1 Einzelstück".
export function unitsLabel(list) {
  const items = list.filter((b) => b.kind === 'item').length;
  const boxes = list.length - items;
  const parts = [];
  if (boxes || !items) parts.push(plural(boxes, 'Kiste', 'Kisten'));
  if (items) parts.push(plural(items, 'Einzelstück', 'Einzelstücke'));
  return parts.join(', ');
}

// A location is { shelf: 'A', level: 2 } (a shelf level), { zone: 'S1' } (a
// spot outside the shelves), { away: true } or null (no fixed place).
export function locKey(loc) {
  if (!loc) return 'none';
  if (loc.away) return 'away';
  if (loc.zone) return `@${loc.zone}`;
  return `${loc.shelf}${loc.level}`;
}

export function parseLocKey(key) {
  if (key === 'none') return null;
  if (key === 'away') return { away: true };
  if (key.startsWith('@')) return { zone: key.slice(1) };
  const m = /^([A-Z]+)(\d+)$/.exec(key);
  return m ? { shelf: m[1], level: Number(m[2]) } : null;
}

export const sameLoc = (a, b) => locKey(a) === locKey(b);

export function locShort(loc) {
  if (!loc) return 'Ohne Platz';
  if (loc.away) return 'Entnommen';
  if (loc.zone) return loc.zone;
  return `${loc.shelf}${loc.level}`;
}

// Expiry ("verwendbar bis") is a month, stored as "2027-03"; goods may be used
// until the end of it. Typed as 03/2027, 03/27 or 3.2027.
const monthKey = (year, month) =>
  month >= 1 && month <= 12 && year >= 2000 && year < 2100 ? `${year}-${String(month).padStart(2, '0')}` : null;

export function parseExpiry(text) {
  const s = String(text ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (m) return monthKey(Number(m[1]), Number(m[2]));
  m = /^(\d{1,2})\s*[./-]\s*(\d{2}|\d{4})$/.exec(s);
  if (m) return monthKey(m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]), Number(m[1]));
  return null;
}

export const expiryLabel = (expiry) => (expiry ? `${expiry.slice(5)}/${expiry.slice(0, 4)}` : '');

// Months from this month to the expiry month: 0 = expires this month.
export function monthsLeft(expiry, now = new Date()) {
  const [year, month] = expiry.split('-').map(Number);
  return year * 12 + month - (now.getFullYear() * 12 + now.getMonth() + 1);
}

// null (no expiry), 'expired', 'soon' (within `warn` months) or 'ok'.
export function expiryState(expiry, warn) {
  if (!expiry) return null;
  const left = monthsLeft(expiry);
  return left < 0 ? 'expired' : left < warn ? 'soon' : 'ok';
}

// The warning time in words: "in den nächsten 3 Monaten".
export const warnSpan = (warn) => (warn === 1 ? 'diesen Monat' : `in den nächsten ${warn} Monaten`);

export function expiryNote(expiry) {
  const left = monthsLeft(expiry);
  if (left < 0) return 'abgelaufen';
  if (left === 0) return 'läuft diesen Monat ab';
  if (left === 1) return 'läuft nächsten Monat ab';
  return `läuft in ${left} Monaten ab`;
}

export function normalize(s) {
  return String(s ?? '')
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss');
}

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

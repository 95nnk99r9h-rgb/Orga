// Small, dependency-free formatting helpers shared by store and views.

export const pad = (n) => String(n).padStart(3, '0');

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Everything with a number is stored as a "box"; its kind tells a real box
// from a large item that stands on its own (Christmas tree, suitcase, pram …).
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

export function normalize(s) {
  return String(s ?? '')
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss');
}

// Pasted text: one entry per line.
export function splitLines(text) {
  return String(text ?? '')
    .split(/\r?\n/)
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

// State and persistence. Everything is read from memory; writes update memory
// synchronously, notify subscribers and are persisted to IndexedDB in the
// background. Photos live in their own object store and are loaded lazily.

import { locKey, normalize, pad, parseLocKey, expiryState, expiryLabel } from './format.js';

// The pharmacy edition keeps its data apart from other Fundort apps on the
// same web address. The demo mode works on a database of its own, so trying
// things out never touches the real data.
const DEMO_KEY = 'fundort-apotheke.demo'; // 'fresh' = load the demo on next start
const demoFlag = () => {
  try {
    return localStorage.getItem(DEMO_KEY);
  } catch {
    return null;
  }
};
export const isDemo = () => !!demoFlag();
const DB_NAME = isDemo() ? 'fundort-apotheke-demo' : 'fundort-apotheke';
const DB_VERSION = 1;

export const COLORS = ['red', 'orange', 'yellow', 'green', 'mint', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'brown', 'gray'];

// Light-mode values, used where CSS variables are not available (print, canvas).
export const COLOR_HEX = {
  red: '#ff3b30', orange: '#ff9500', yellow: '#ffcc00', green: '#34c759', mint: '#00c7be',
  teal: '#30b0c7', cyan: '#32ade6', blue: '#007aff', indigo: '#5856d6', purple: '#af52de',
  pink: '#ff2d55', brown: '#a2845e', gray: '#8e8e93',
};

export const DEFAULT_CATEGORIES = [
  { id: 'ueberbestand', name: 'Überbestand', color: 'blue' },
  { id: 'aktion', name: 'Aktion & Saison', color: 'orange' },
  { id: 'kosmetik', name: 'Kosmetik & Pflege', color: 'pink' },
  { id: 'verband', name: 'Verbandstoffe', color: 'mint' },
  { id: 'hilfsmittel', name: 'Hilfsmittel', color: 'teal' },
  { id: 'leihgeraete', name: 'Leihgeräte', color: 'indigo' },
  { id: 'rezeptur', name: 'Rezepturbedarf', color: 'purple' },
  { id: 'verbrauch', name: 'Verbrauchsmaterial', color: 'brown' },
  { id: 'werbung', name: 'Werbemittel & Deko', color: 'yellow' },
  { id: 'retouren', name: 'Retouren & Sperrware', color: 'red' },
  { id: 'buero', name: 'Büro & Archiv', color: 'gray' },
];

export const ZONE_SUGGESTIONS = ['Kühlschrank (2–8 °C)', 'Sperrlager', 'Boden vor den Regalen', 'Keller', 'Rezeptur', 'Büro', 'Schaufenster'];

// Months before the expiry at which an entry shows up under "Verfall".
export const EXPIRY_WARN_OPTIONS = [
  [1, '1 Monat'],
  [3, '3 Monate'],
  [6, '6 Monate'],
  [12, '1 Jahr'],
];

export const MAX_LEVELS = 12;

// household: { id, name, lastSync } once this device is linked to one.
const freshMeta = () => ({ setupDone: false, lastBackup: null, printedUpTo: 0, expiryWarn: 3, settingsModifiedAt: 0, household: null });
const SHARED_META = ['printedUpTo', 'expiryWarn'];

export const state = {
  shelves: [], // { id: 'A', note: '', levels: 5 } – each shelf has its own number of levels
  zones: [], // { id: 'S1', name: 'Kühlschrank' } – places outside the shelves
  categories: [], // { id, name, color }
  boxes: [], // { id, kind: 'box'|'item', number, title, category, location, order, items[], expiry, notes, photos[], createdAt, updatedAt }
  meta: freshMeta(),
};

// ---------------------------------------------------------------------------
// IndexedDB plumbing

let db = null;

const promisify = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const done = (tx) => new Promise((resolve, reject) => ((tx.oncomplete = resolve), (tx.onerror = () => reject(tx.error))));

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const d = request.result;
      d.createObjectStore('meta');
      d.createObjectStore('boxes', { keyPath: 'id' });
      d.createObjectStore('photos', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const os = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);

function persist(promise) {
  promise.catch((err) => {
    console.error(err);
    window.dispatchEvent(new CustomEvent('fundort:error', { detail: err }));
  });
  return promise;
}

const settingsRecord = () => ({ shelves: state.shelves, zones: state.zones, categories: state.categories, meta: state.meta });
const putBox = (box) => persist(promisify(os('boxes', 'readwrite').put(box)));
const putSettings = () => persist(promisify(os('meta', 'readwrite').put(settingsRecord(), 'settings')));

// Online sync (js/sync.js) registers hooks here. Local changes are reported
// to it; changes arriving from the household go through applyRemote and are
// not reported back. modifiedAt decides which side wins when both changed.
let sync = {};
export const setSyncHooks = (hooks) => {
  sync = hooks;
};

function writeBox(box) {
  box.modifiedAt = Date.now();
  putBox(box);
  sync.box?.(box);
}

function writeSettings() {
  state.meta.settingsModifiedAt = Date.now();
  putSettings();
  sync.settings?.();
}

// What the household shares; device matters like the backup date stay local.
export const sharedSettings = () => ({
  shelves: state.shelves,
  zones: state.zones,
  categories: state.categories,
  printedUpTo: state.meta.printedUpTo,
  expiryWarn: state.meta.expiryWarn,
  modifiedAt: state.meta.settingsModifiedAt ?? 0,
});

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) fn();
}

export async function init() {
  db = await openDB();
  await loadAll();
  if (demoFlag() === 'fresh') {
    await loadDemo();
    localStorage.setItem(DEMO_KEY, 'on');
  }
  navigator.storage?.persist?.().catch(() => {});
}

// Switching starts the app afresh, so nothing of the other mode – like the
// online sync of the real data – keeps running. Each demo starts anew.
export function setDemo(on) {
  try {
    if (on) localStorage.setItem(DEMO_KEY, 'fresh');
    else localStorage.removeItem(DEMO_KEY);
  } catch {
    throw new Error('Der Demo-Modus braucht lokalen Speicher, der in diesem Browser gesperrt ist.');
  }
  history.replaceState({ depth: 0 }, '', `${location.pathname}${location.search}#/`);
  location.reload();
}

async function loadAll() {
  const settings = await promisify(os('meta').get('settings'));
  state.shelves = settings?.shelves ?? [];
  state.zones = settings?.zones ?? [];
  state.categories = settings?.categories ?? [];
  state.meta = { ...freshMeta(), ...settings?.meta };
  state.boxes = (await promisify(os('boxes').getAll())).map((stored) => {
    const { box, changed } = tidy(stored);
    if (changed) writeBox(box);
    return box;
  });
}

// Boxes are described by their contents, loose items by their title only.
// Older entries are brought into that shape without losing anything: a box
// title becomes the first content line, an item's contents go to its notes.
function tidy(stored) {
  const box = { kind: 'box', items: [], photos: [], notes: '', title: '', ...stored }; // entries from before loose items existed are boxes
  let changed = false;
  if (box.kind === 'box' && box.title) {
    if (!box.items.includes(box.title)) box.items = [box.title, ...box.items];
    box.title = '';
    changed = true;
  }
  if (box.kind === 'item' && box.items.length) {
    box.notes = [box.notes, `Zubehör: ${box.items.join(', ')}`].filter(Boolean).join('\n');
    box.items = [];
    changed = true;
  }
  return { box, changed };
}

export const uid = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ---------------------------------------------------------------------------
// Queries

const byNumber = (a, b) => a.number - b.number;
// Within one place, a hand-set order wins; entries without one follow by number.
const byOrder = (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || byNumber(a, b);

export const boxById = (id) => state.boxes.find((b) => b.id === id);
export const boxByNumber = (n) => state.boxes.find((b) => b.number === n);
export const categoryById = (id) => state.categories.find((c) => c.id === id);
export const shelfById = (id) => state.shelves.find((s) => s.id === id);
export const zoneById = (id) => state.zones.find((z) => z.id === id);
export const sortedBoxes = () => [...state.boxes].sort(byNumber);

export const boxesAt = (shelf, level = null) =>
  state.boxes
    .filter((b) => b.location?.shelf === shelf && (level == null || b.location.level === level))
    .sort(level == null ? byNumber : byOrder);

export const boxesInZone = (id) => state.boxes.filter((b) => b.location?.zone === id).sort(byOrder);
export const boxesOfKind = (kind) => state.boxes.filter((b) => b.kind === kind).sort(byNumber);
export const unplacedBoxes = () => state.boxes.filter((b) => !b.location).sort(byNumber);
export const awayBoxes = () => state.boxes.filter((b) => b.location?.away).sort(byNumber);
export const boxesInCategory = (id) => state.boxes.filter((b) => (b.category ?? null) === id).sort(byNumber);
// Expired or expiring within the warning time, soonest first.
export const expiringBoxes = () =>
  state.boxes
    .filter((b) => ['expired', 'soon'].includes(expiryState(b.expiry, state.meta.expiryWarn)))
    .sort((a, b) => a.expiry.localeCompare(b.expiry) || byNumber(a, b));
export const recentBoxes = (n = 5) => [...state.boxes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, n);
export const itemCount = () => state.boxes.reduce((n, b) => n + b.items.length, 0);

export function countAt(loc) {
  const key = locKey(loc);
  return state.boxes.filter((b) => locKey(b.location) === key).length;
}

export const nextNumber = () => state.boxes.reduce((max, b) => Math.max(max, b.number), 0) + 1;

export function locLong(loc) {
  if (!loc) return 'Ohne festen Platz';
  if (loc.away) return 'Nicht im Lager';
  if (loc.zone) return zoneById(loc.zone)?.name || `Stellplatz ${loc.zone}`;
  return `Regal ${loc.shelf} · Boden ${loc.level}`;
}

export function isValidLocation(loc) {
  if (!loc || loc.away) return true;
  if (loc.zone) return !!zoneById(loc.zone);
  const shelf = shelfById(loc.shelf);
  return !!shelf && loc.level >= 1 && loc.level <= shelf.levels;
}

// Every query word has to match somewhere; title and item hits rank highest.
export function search(query) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const results = [];
  for (const box of state.boxes) {
    const title = normalize(box.title);
    const items = box.items.map((it) => [it, normalize(it)]);
    const zone = box.location?.zone ? zoneById(box.location.zone)?.name : '';
    const other = [box.notes, categoryById(box.category)?.name, locKey(box.location), zone, expiryLabel(box.expiry)].map(normalize);
    const numbers = [String(box.number), pad(box.number)];
    const matchedItems = new Set();
    let score = 0;
    let all = true;
    for (const t of tokens) {
      let s = 0;
      if (numbers.includes(t)) s = 10;
      if (title.includes(t)) s = Math.max(s, title.startsWith(t) ? 6 : 5);
      for (const [raw, norm] of items) {
        if (norm.includes(t)) {
          matchedItems.add(raw);
          s = Math.max(s, norm.startsWith(t) ? 4 : 3);
        }
      }
      if (!s && other.some((v) => v.includes(t))) s = 1;
      if (!s) {
        all = false;
        break;
      }
      score += s;
    }
    if (all) results.push({ box, score, matchedItems: [...matchedItems] });
  }
  return results.sort((a, b) => b.score - a.score || a.box.number - b.box.number);
}

// ---------------------------------------------------------------------------
// Boxes and loose items

function assertNumber(number, selfId = null) {
  if (!Number.isInteger(number) || number < 1 || number > 9999) {
    throw new Error('Die Nummer muss zwischen 1 und 9999 liegen.');
  }
  const other = boxByNumber(number);
  if (other && other.id !== selfId) throw new Error(`Die Nummer ${pad(number)} ist schon vergeben.`);
}

export function createBox(data) {
  assertNumber(data.number);
  const now = Date.now();
  const box = {
    id: uid(),
    kind: data.kind === 'item' ? 'item' : 'box',
    number: data.number,
    title: (data.title ?? '').trim(),
    category: data.category ?? null,
    location: data.location ?? null,
    items: data.items ?? [],
    expiry: data.expiry ?? null,
    notes: (data.notes ?? '').trim(),
    photos: data.photos ?? [],
    createdAt: now,
    updatedAt: now,
  };
  state.boxes.push(box);
  writeBox(box);
  emit();
  return box;
}

export function updateBox(id, patch) {
  const box = boxById(id);
  if (!box) throw new Error('Eintrag nicht gefunden.');
  if ('number' in patch) assertNumber(patch.number, id);
  // Moved somewhere else: line up at the end there.
  if ('location' in patch && locKey(patch.location) !== locKey(box.location)) patch = { ...patch, order: null };
  Object.assign(box, patch, { updatedAt: Date.now() });
  writeBox(box);
  emit();
  return box;
}

export const moveBox = (id, location) => updateBox(id, { location });

// Hand-set order of the entries on one level or zone (ids in their new order).
// Not a content change, so updatedAt stays as it is.
export function reorderBoxes(ids) {
  ids.forEach((id, i) => {
    const box = boxById(id);
    if (box && box.order !== i) {
      box.order = i;
      writeBox(box);
    }
  });
  emit();
}

export function deleteBox(id) {
  const box = boxById(id);
  if (!box) return;
  dropLocal(box);
  sync.deleteBox?.(box);
  emit();
}

function dropLocal(box) {
  state.boxes = state.boxes.filter((b) => b.id !== box.id);
  const tx = db.transaction(['boxes', 'photos'], 'readwrite');
  tx.objectStore('boxes').delete(box.id);
  for (const pid of box.photos) tx.objectStore('photos').delete(pid);
  box.photos.forEach(forgetPhotoURL);
  persist(done(tx));
}

// Entries whose place disappears lose their location instead of pointing nowhere.
function unplace(predicate) {
  for (const box of state.boxes) {
    if (box.location && predicate(box.location)) {
      box.location = null;
      box.updatedAt = Date.now();
      writeBox(box);
    }
  }
}

// ---------------------------------------------------------------------------
// Photos

const photoURLs = new Map(); // `${id}:${size}` -> object URL

export const photoURLCached = (id, size = 'thumb') => photoURLs.get(`${id}:${size}`) ?? null;

export async function photoURL(id, size = 'thumb') {
  const key = `${id}:${size}`;
  if (photoURLs.has(key)) return photoURLs.get(key);
  const rec = await promisify(os('photos').get(id));
  if (!rec) return null;
  const url = URL.createObjectURL(rec[size] ?? rec.full);
  photoURLs.set(key, url);
  return url;
}

function forgetPhotoURL(id) {
  for (const size of ['thumb', 'full']) {
    const key = `${id}:${size}`;
    if (photoURLs.has(key)) URL.revokeObjectURL(photoURLs.get(key));
    photoURLs.delete(key);
  }
}

// processed: [{ full: Blob, thumb: Blob }] -> ids
export async function savePhotos(boxId, processed) {
  const records = processed.map((p) => ({ id: uid(), boxId, full: p.full, thumb: p.thumb, createdAt: Date.now() }));
  const tx = db.transaction('photos', 'readwrite');
  for (const r of records) tx.objectStore('photos').put(r);
  await persist(done(tx));
  sync.photos?.(records);
  return records.map((r) => r.id);
}

export function deletePhotos(ids) {
  if (!ids.length) return;
  const tx = db.transaction('photos', 'readwrite');
  for (const id of ids) {
    tx.objectStore('photos').delete(id);
    forgetPhotoURL(id);
  }
  persist(done(tx));
  sync.deletePhotos?.(ids);
}

export const photoRecord = (id) => promisify(os('photos').get(id));
export const photoIds = () => promisify(os('photos').getAllKeys());

// A photo that arrived from the household: stored locally only.
export async function storeRemotePhoto(record) {
  await persist(promisify(os('photos', 'readwrite').put(record)));
  emit();
}

// ---------------------------------------------------------------------------
// Shelves, zones & categories

export const shelfLetter = (i) => {
  let s = '';
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
};

export function addShelf(levels = 4) {
  let i = 0;
  while (shelfById(shelfLetter(i))) i++;
  const shelf = { id: shelfLetter(i), note: '', levels };
  state.shelves.push(shelf);
  state.shelves.sort((a, b) => a.id.length - b.id.length || a.id.localeCompare(b.id));
  writeSettings();
  emit();
  return shelf;
}

export function updateShelf(id, patch) {
  const shelf = shelfById(id);
  if (!shelf) return;
  if ('levels' in patch) {
    const levels = Math.max(1, Math.min(MAX_LEVELS, patch.levels));
    const blocked = state.boxes.find((b) => b.location?.shelf === id && b.location.level > levels);
    if (blocked) throw new Error(`Auf Boden ${blocked.location.level} steht noch etwas. Räume es zuerst um.`);
    patch = { ...patch, levels };
  }
  Object.assign(shelf, patch);
  writeSettings();
  emit();
}

export function removeShelf(id) {
  unplace((loc) => loc.shelf === id);
  state.shelves = state.shelves.filter((s) => s.id !== id);
  writeSettings();
  emit();
}

export function addZone(name = '') {
  let n = 1;
  while (zoneById(`S${n}`)) n++;
  const zone = { id: `S${n}`, name: name.trim() };
  state.zones.push(zone);
  state.zones.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  writeSettings();
  emit();
  return zone;
}

export function updateZone(id, patch) {
  const zone = zoneById(id);
  if (!zone) return;
  Object.assign(zone, patch);
  writeSettings();
  emit();
}

export function removeZone(id) {
  unplace((loc) => loc.zone === id);
  state.zones = state.zones.filter((z) => z.id !== id);
  writeSettings();
  emit();
}

export function saveCategory({ id, name, color }) {
  name = name.trim();
  if (!name) throw new Error('Bitte gib der Kategorie einen Namen.');
  const existing = id && categoryById(id);
  if (existing) Object.assign(existing, { name, color });
  else state.categories.push({ id: uid(), name, color });
  writeSettings();
  emit();
}

export function removeCategory(id) {
  state.categories = state.categories.filter((c) => c.id !== id);
  for (const box of state.boxes) {
    if (box.category === id) {
      box.category = null;
      writeBox(box);
    }
  }
  writeSettings();
  emit();
}

// The last printed number (so two phones don't print the same labels) and the
// expiry warning are shared; everything else in meta belongs to this device.
export function setMeta(patch, { quiet = false } = {}) {
  Object.assign(state.meta, patch);
  if (SHARED_META.some((key) => key in patch)) writeSettings();
  else putSettings();
  if (!quiet) emit();
}

// levels: number of levels per shelf, e.g. [5, 3, 4]; zoneNames: free spots.
export function setupCellar(levels, zoneNames = []) {
  state.shelves = levels.map((n, i) => ({ id: shelfLetter(i), note: '', levels: n }));
  state.zones = zoneNames.map((name, i) => ({ id: `S${i + 1}`, name }));
  if (!state.categories.length) state.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  state.meta.setupDone = true;
  writeSettings();
  emit();
}

// ---------------------------------------------------------------------------
// Backup

const blobToDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export async function exportData() {
  const photos = await promisify(os('photos').getAll());
  return {
    app: 'fundort',
    version: 2,
    exportedAt: new Date().toISOString(),
    ...settingsRecord(),
    boxes: state.boxes,
    photos: await Promise.all(
      photos.map(async (p) => ({
        id: p.id,
        boxId: p.boxId,
        createdAt: p.createdAt,
        full: await blobToDataURL(p.full),
        thumb: await blobToDataURL(p.thumb),
      })),
    ),
  };
}

async function replaceAll({ shelves, zones = [], categories, meta, boxes, photos }) {
  const tx = db.transaction(['meta', 'boxes', 'photos'], 'readwrite');
  for (const name of ['meta', 'boxes', 'photos']) tx.objectStore(name).clear();
  tx.objectStore('meta').put({ shelves, zones, categories, meta }, 'settings');
  for (const b of boxes) tx.objectStore('boxes').put(b);
  for (const p of photos) tx.objectStore('photos').put(p);
  await done(tx);
  for (const key of photoURLs.keys()) forgetPhotoURL(key.split(':')[0]);
  await loadAll();
  sync.replaced?.();
  emit();
}

// Changes from the household. Newer local changes win; nothing is reported
// back to the sync, and the view refreshes once.
export function applyRemote({ settings = null, boxes = [], removed = [] }) {
  let changed = false;
  if (settings && (settings.modifiedAt ?? 0) >= (state.meta.settingsModifiedAt ?? 0)) {
    const next = { shelves: settings.shelves ?? [], zones: settings.zones ?? [], categories: settings.categories ?? [] };
    if (JSON.stringify(next) !== JSON.stringify({ shelves: state.shelves, zones: state.zones, categories: state.categories })) {
      Object.assign(state, next);
      changed = true;
    }
    state.meta.printedUpTo = Math.max(state.meta.printedUpTo, settings.printedUpTo ?? 0);
    if (settings.expiryWarn && settings.expiryWarn !== state.meta.expiryWarn) {
      state.meta.expiryWarn = settings.expiryWarn;
      changed = true;
    }
    state.meta.settingsModifiedAt = settings.modifiedAt ?? 0;
    state.meta.setupDone = true;
    putSettings();
  }
  for (const incoming of boxes) {
    const { box: remote } = tidy(incoming);
    const local = boxById(remote.id);
    if (local && (local.modifiedAt ?? local.updatedAt) > (remote.modifiedAt ?? remote.updatedAt)) continue;
    if (local && JSON.stringify(local) === JSON.stringify(remote)) continue;
    if (local) state.boxes[state.boxes.indexOf(local)] = remote;
    else state.boxes.push(remote);
    putBox(remote);
    changed = true;
  }
  for (const id of removed) {
    const box = boxById(id);
    if (!box) continue;
    dropLocal(box);
    changed = true;
  }
  if (changed) emit();
}

// Joining a household: this device takes over the household's data.
export function adoptHousehold({ settings, boxes, household }) {
  return replaceAll({
    shelves: settings?.shelves ?? [],
    zones: settings?.zones ?? [],
    categories: settings?.categories ?? DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    meta: {
      ...freshMeta(),
      setupDone: true,
      lastBackup: state.meta.lastBackup,
      printedUpTo: settings?.printedUpTo ?? 0,
      expiryWarn: settings?.expiryWarn ?? 3,
      settingsModifiedAt: settings?.modifiedAt ?? 0,
      household,
    },
    boxes,
    photos: [],
  });
}

export async function importData(data) {
  if (data?.app !== 'fundort' || !Array.isArray(data.boxes) || !Array.isArray(data.shelves)) {
    throw new Error('Diese Datei ist kein Fundort-Backup.');
  }
  const toBlob = async (url) => (url ? (await fetch(url)).blob() : null);
  const photos = await Promise.all(
    (data.photos ?? []).map(async (p) => ({ ...p, full: await toBlob(p.full), thumb: await toBlob(p.thumb ?? p.full) })),
  );
  await replaceAll({
    shelves: data.shelves,
    zones: data.zones ?? [],
    categories: data.categories ?? [],
    meta: { ...freshMeta(), ...data.meta, setupDone: true, household: state.meta.household ?? null },
    boxes: data.boxes.map((b) => ({ kind: 'box', items: [], photos: [], notes: '', title: '', ...b })),
    photos,
  });
}

export const resetAll = () => replaceAll({ shelves: [], zones: [], categories: [], meta: freshMeta(), boxes: [], photos: [] });

// ---------------------------------------------------------------------------
// Demo data: a small pharmacy stockroom to try the app with (Mehr → Demo-Modus).

// Boxes: [number, category, place, contents, expiry in months from now, notes]
const DEMO_BOXES = [
  [1, 'ueberbestand', 'A1', 'Ibuprofen 400 mg 50 St. (4×), Ibuprofen 400 mg 20 St. (6×), Paracetamol 500 mg 20 St. (5×)', 14],
  [2, 'ueberbestand', 'A1', 'Halspastillen Salbei (10×), Halsspray (4×), Lutschtabletten Zink (6×)', -1, 'Abgelaufen – aussondern und retournieren.'],
  [3, 'ueberbestand', 'A2', 'Nasenspray 0,1 % 10 ml (8×), Meerwasser-Nasenspray (6×), Nasensalbe (5×)', 2],
  [4, 'ueberbestand', 'A2', 'Magnesium 400 Brausetabletten (5×), Vitamin D3 1000 I.E. (4×), Zink 25 mg (3×)', 9],
  [5, 'aktion', 'A3', 'Sonnenschutz LSF 50 (12×), After-Sun-Lotion (6×), Insektenschutz-Spray (8×)', 20, 'Ab April in die Sichtwahl.'],
  [6, 'aktion', 'A3', 'Erkältungsbad (6×), Erkältungsbalsam (8×), Taschentücher-Boxen (20×)', 1],
  [7, 'buero', 'A4', 'Ordner Lieferscheine 2025, Ordner Lieferscheine 2026, Ordner Wartung & Prüfprotokolle'],
  [8, 'werbung', 'A5', 'Schaufensterdeko Winter, Lichterketten, Adventskalender-Aufsteller'],
  [9, 'kosmetik', 'B1', 'Handcreme (10×), Lippenpflege (24×), Tagescreme (6×)', 11],
  [10, 'kosmetik', 'B2', 'Pflegeproben Gesichtspflege, Duschgel-Proben, Shampoo-Proben', 18],
  [11, 'verband', 'B3', 'Mullbinden 8 cm (20×), Kompressen steril (10×), Pflasterstrips (15×), Fixierpflaster (6×)', 30],
  [12, 'hilfsmittel', 'B5', 'Kniebandagen Gr. S–XL, Handgelenkbandagen, Musterkoffer Kompressionsstrümpfe'],
  [13, 'rezeptur', 'C1', 'Kruken 50 g (40×), Kruken 100 g (30×), Tuben 50 ml (25×), Spatel, Rezepturetiketten'],
  [14, 'rezeptur', 'C2', 'Basiscreme DAC (2×), Wollwachsalkoholsalbe (1×), Hydrophile Creme (1×)', 2, 'Prüfzertifikate im Rezeptur-Ordner.'],
  [15, 'verbrauch', 'C3', 'Apothekentüten klein (2 Pakete), Apothekentüten groß (1 Paket), Kassenrollen (20×), Etikettenrollen (8×)'],
  [16, 'werbung', 'C4', 'Kundenstopper-Plakate, Schaufensterdeko Frühling, Preisschilder, Kundenzeitschriften (Rest)'],
  [17, 'ueberbestand', '@S1', 'Augentropfen kühl (6×), Probiotika kühl (4×)', 3, 'Kühlware: 2–8 °C.'],
  [18, 'retouren', '@S2', 'Retoure Großhandel: beschädigte Packungen (3×), Falschlieferung Nasensalbe (2×)', null, 'Retourenschein liegt bei. Wird beim nächsten Botengang abgeholt.'],
  [19, 'aktion', 'away', 'Herbstaktion Immunsystem: Vitamin C (10×), Zink (8×), Aufsteller', 6, 'Gerade in der Sichtwahl aufgebaut.'],
  [20, 'kosmetik', 'none', 'Neue Lieferung Pflegeserie (12×)', 24, 'Noch nicht eingeräumt.'],
];

// Loose items: [number, title, category, place, notes]
const DEMO_ITEMS = [
  [21, 'Rollator (Vorführgerät)', 'hilfsmittel', '@S3'],
  [22, 'Milchpumpe · Leihgerät 1', 'leihgeraete', 'B4', 'Nach Rückgabe reinigen, Hygieneset beilegen.'],
  [23, 'Milchpumpe · Leihgerät 2', 'leihgeraete', 'away', 'Verliehen – Rückgabe laut Leihschein in der Warenwirtschaft.'],
  [24, 'Babywaage · Leihgerät', 'leihgeraete', 'B4'],
  [25, 'Inhaliergerät · Leihgerät', 'leihgeraete', 'B4'],
  [26, 'Kundenstopper', 'werbung', '@S4', 'Bei Regen hereinholen.'],
];

// "2027-03" for `months` months from now.
function monthFromNow(months) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function loadDemo() {
  const now = Date.now();
  const entry = (i, fields) => ({
    id: uid(),
    photos: [],
    createdAt: now - (30 - i) * 86400000,
    updatedAt: now - (30 - i) * 3600000 * 7,
    ...fields,
  });
  const boxes = [
    ...DEMO_BOXES.map(([number, category, where, items, months = null, notes = ''], i) =>
      entry(i, {
        kind: 'box', number, title: '', category, location: parseLocKey(where), items: items.split(', '),
        expiry: months == null ? null : monthFromNow(months), notes,
      })),
    ...DEMO_ITEMS.map(([number, title, category, where, notes = ''], i) =>
      entry(DEMO_BOXES.length + i, { kind: 'item', number, title, category, location: parseLocKey(where), items: [], expiry: null, notes })),
  ];
  await replaceAll({
    shelves: [
      { id: 'A', note: 'Links neben der Tür', levels: 5 },
      { id: 'B', note: 'Hohes Regal, Rückwand', levels: 6 },
      { id: 'C', note: 'Schmales Regal rechts', levels: 4 },
    ],
    zones: [
      { id: 'S1', name: 'Kühlschrank (2–8 °C)' },
      { id: 'S2', name: 'Sperrlager' },
      { id: 'S3', name: 'Boden vor Regal B' },
      { id: 'S4', name: 'Keller' },
    ],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    meta: { ...freshMeta(), setupDone: true, printedUpTo: 30, lastBackup: now },
    boxes,
    photos: [],
  });
}

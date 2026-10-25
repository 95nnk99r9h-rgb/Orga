// State and persistence. Everything is read from memory; writes update memory
// synchronously, notify subscribers and are persisted to IndexedDB in the
// background. Photos live in their own object store and are loaded lazily.

import { locKey, normalize, pad, parseLocKey } from './format.js';

const DB_NAME = 'fundort';
const DB_VERSION = 1;

export const COLORS = ['red', 'orange', 'yellow', 'green', 'mint', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'brown', 'gray'];

// Light-mode values, used where CSS variables are not available (print, canvas).
export const COLOR_HEX = {
  red: '#ff3b30', orange: '#ff9500', yellow: '#ffcc00', green: '#34c759', mint: '#00c7be',
  teal: '#30b0c7', cyan: '#32ade6', blue: '#007aff', indigo: '#5856d6', purple: '#af52de',
  pink: '#ff2d55', brown: '#a2845e', gray: '#8e8e93',
};

export const DEFAULT_CATEGORIES = [
  { id: 'weihnachten', name: 'Weihnachten', color: 'red' },
  { id: 'deko', name: 'Deko', color: 'orange' },
  { id: 'kleidung', name: 'Kleidung', color: 'blue' },
  { id: 'kinder', name: 'Kinder & Spielzeug', color: 'pink' },
  { id: 'freizeit', name: 'Sport & Camping', color: 'green' },
  { id: 'werkzeug', name: 'Werkzeug', color: 'brown' },
  { id: 'elektronik', name: 'Elektronik & Kabel', color: 'indigo' },
  { id: 'haushalt', name: 'Küche & Haushalt', color: 'teal' },
  { id: 'dokumente', name: 'Dokumente', color: 'gray' },
  { id: 'erinnerungen', name: 'Erinnerungen', color: 'purple' },
];

export const ZONE_SUGGESTIONS = ['Boden vor den Regalen', 'Unter der Treppe', 'Wandhaken', 'Hinter der Tür', 'Garage', 'Dachboden'];

export const MAX_LEVELS = 12;

// household: { id, name, lastSync } once this device is linked to one.
const freshMeta = () => ({ setupDone: false, lastBackup: null, printedUpTo: 0, settingsModifiedAt: 0, household: null });

export const state = {
  rooms: [], // { id: 'R1', name: 'Keller' } – every shelf and zone belongs to one room
  shelves: [], // { id: 'A', room: 'R1', note: '', levels: 5 } – each shelf has its own number of levels
  zones: [], // { id: 'S1', room: 'R1', name: 'Unter der Treppe' } – places outside the shelves
  categories: [], // { id, name, color }
  boxes: [], // { id, kind: 'box'|'item', number, title, category, location, order, awaySince, items[], notes, photos[], createdAt, updatedAt }
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

const settingsRecord = () => ({ rooms: state.rooms, shelves: state.shelves, zones: state.zones, categories: state.categories, meta: state.meta });
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
  rooms: state.rooms,
  shelves: state.shelves,
  zones: state.zones,
  categories: state.categories,
  printedUpTo: state.meta.printedUpTo,
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
  navigator.storage?.persist?.().catch(() => {});
}

// Every shelf and zone belongs to a room. Data from before rooms existed – or
// from a device that doesn't know them yet – lands in the first room.
function withRooms({ rooms = [], shelves = [], zones = [] }) {
  if (!rooms.length) rooms = [{ id: 'R1', name: 'Keller' }];
  const ids = new Set(rooms.map((r) => r.id));
  const fix = (place) => (ids.has(place.room) ? place : { ...place, room: rooms[0].id });
  return { rooms, shelves: shelves.map(fix), zones: zones.map(fix) };
}

async function loadAll() {
  const settings = await promisify(os('meta').get('settings'));
  Object.assign(state, withRooms({ rooms: settings?.rooms, shelves: settings?.shelves, zones: settings?.zones }));
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
export const roomById = (id) => state.rooms.find((r) => r.id === id);
export const shelvesIn = (room) => state.shelves.filter((s) => s.room === room);
export const zonesIn = (room) => state.zones.filter((z) => z.room === room);
export const multiRoom = () => state.rooms.length > 1;

export function roomOf(loc) {
  const place = loc?.zone ? zoneById(loc.zone) : loc?.shelf ? shelfById(loc.shelf) : null;
  return place ? roomById(place.room) : null;
}
export const sortedBoxes = () => [...state.boxes].sort(byNumber);

export const boxesAt = (shelf, level = null) =>
  state.boxes
    .filter((b) => b.location?.shelf === shelf && (level == null || b.location.level === level))
    .sort(level == null ? byNumber : byOrder);

export const boxesInZone = (id) => state.boxes.filter((b) => b.location?.zone === id).sort(byOrder);
export const boxesOfKind = (kind) => state.boxes.filter((b) => b.kind === kind).sort(byNumber);
export const unplacedBoxes = () => state.boxes.filter((b) => !b.location).sort(byNumber);
// Longest gone first; entries from before the date was kept come last.
export const awayBoxes = () =>
  state.boxes.filter((b) => b.location?.away).sort((a, b) => (a.awaySince ?? Infinity) - (b.awaySince ?? Infinity) || byNumber(a, b));
export const boxesInCategory = (id) => state.boxes.filter((b) => (b.category ?? null) === id).sort(byNumber);
export const recentBoxes = (n = 5) => [...state.boxes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, n);
export const itemCount = () => state.boxes.reduce((n, b) => n + b.items.length, 0);

export function countAt(loc) {
  const key = locKey(loc);
  return state.boxes.filter((b) => locKey(b.location) === key).length;
}

export const nextNumber = () => state.boxes.reduce((max, b) => Math.max(max, b.number), 0) + 1;

// "Regal B · Boden 3"; with several rooms the room comes first.
export function locLong(loc) {
  if (!loc) return 'Ohne festen Platz';
  if (loc.away) return 'Entnommen';
  const place = loc.zone ? zoneById(loc.zone)?.name || `Stellplatz ${loc.zone}` : `Regal ${loc.shelf} · Boden ${loc.level}`;
  const room = multiRoom() ? roomOf(loc)?.name : '';
  return room ? `${room} · ${place}` : place;
}

export function isValidLocation(loc) {
  if (!loc || loc.away) return true;
  if (loc.zone) return !!zoneById(loc.zone);
  const shelf = shelfById(loc.shelf);
  return !!shelf && loc.level >= 1 && loc.level <= shelf.levels;
}

// Typing errors: a query word of five letters or more may differ by one letter
// (two from eight letters on) from a word – or a part of a compound word – in
// an entry; swapped neighbours count as one. Shorter words must match.
const allowedEdits = (t) => (t.length >= 8 ? 2 : t.length >= 5 ? 1 : 0);

function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      row.push(v);
      best = Math.min(best, v);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length];
}

// The word of `text` that matches `t` despite a typo, or null.
function fuzzyWord(text, t) {
  const max = allowedEdits(t);
  if (!max || /^\d+$/.test(t)) return null;
  for (const word of String(text ?? '').split(/[^\p{L}\p{N}]+/u)) {
    const w = normalize(word);
    if (w.length < t.length - max) continue;
    for (let len = t.length - max; len <= t.length + max; len++) {
      for (let i = 0; i + len <= w.length; i++) {
        if (editDistance(t, w.slice(i, i + len), max) <= max) return word;
      }
    }
  }
  return null;
}

function matchBox(box, tokens, fuzzy) {
  const title = normalize(box.title);
  const items = box.items.map((it) => [it, normalize(it)]);
  const zone = box.location?.zone ? zoneById(box.location.zone)?.name : '';
  const otherRaw = [box.notes, categoryById(box.category)?.name, locKey(box.location), zone, roomOf(box.location)?.name];
  const other = otherRaw.map(normalize);
  const numbers = [String(box.number), pad(box.number)];
  const matchedItems = new Set();
  const marks = new Set(); // words found despite a typo, for highlighting
  let score = 0;
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
    if (!s && fuzzy) {
      const hit = (text) => {
        const word = fuzzyWord(text, t);
        if (word) marks.add(word);
        return !!word;
      };
      if (hit(box.title)) s = 4;
      for (const [raw] of items) {
        if (hit(raw)) {
          matchedItems.add(raw);
          s = Math.max(s, 2);
        }
      }
      if (!s && otherRaw.some(hit)) s = 0.5;
    }
    if (!s) return null;
    score += s;
  }
  return { box, score, matchedItems: [...matchedItems], marks: [...marks], fuzzy };
}

// Every query word has to match somewhere; title and item hits rank highest.
// Only if nothing matches exactly, entries with a small typo are offered.
export function search(query) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  let results = state.boxes.map((box) => matchBox(box, tokens, false)).filter(Boolean);
  if (!results.length) results = state.boxes.map((box) => matchBox(box, tokens, true)).filter(Boolean);
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
    awaySince: data.location?.away ? now : null,
    items: data.items ?? [],
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
  // Moved somewhere else: line up at the end there, and note when it was taken out.
  if ('location' in patch && locKey(patch.location) !== locKey(box.location)) {
    patch = { order: null, awaySince: patch.location?.away ? Date.now() : null, ...patch };
  }
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

// Everything needed to bring a deleted entry back, photos included.
export async function snapshotBox(id) {
  const box = boxById(id);
  const photos = (await Promise.all(box.photos.map((pid) => photoRecord(pid)))).filter(Boolean);
  return { box: structuredClone(box), photos };
}

export async function restoreBox({ box, photos }) {
  if (boxById(box.id)) return box;
  assertNumber(box.number, box.id);
  const tx = db.transaction('photos', 'readwrite');
  for (const p of photos) tx.objectStore('photos').put(p);
  await persist(done(tx));
  const restored = { ...box, photos: photos.map((p) => p.id), updatedAt: Date.now() };
  state.boxes.push(restored);
  writeBox(restored);
  sync.photos?.(photos);
  emit();
  return restored;
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

export function addShelf(levels = 4, room = state.rooms[0]?.id) {
  let i = 0;
  while (shelfById(shelfLetter(i))) i++;
  const shelf = { id: shelfLetter(i), room, note: '', levels };
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

export function addZone(name = '', room = state.rooms[0]?.id) {
  let n = 1;
  while (zoneById(`S${n}`)) n++;
  const zone = { id: `S${n}`, room, name: name.trim() };
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

export function addRoom(name) {
  name = name.trim();
  if (!name) throw new Error('Bitte gib dem Raum einen Namen.');
  let n = 1;
  while (roomById(`R${n}`)) n++;
  const room = { id: `R${n}`, name };
  state.rooms.push(room);
  writeSettings();
  emit();
  return room;
}

export function updateRoom(id, patch) {
  const room = roomById(id);
  if (!room) return;
  Object.assign(room, patch);
  writeSettings();
  emit();
}

export function removeRoom(id) {
  if (state.rooms.length < 2) throw new Error('Ein Raum muss bleiben.');
  if (shelvesIn(id).length || zonesIn(id).length) {
    throw new Error('Verschiebe zuerst seine Regale und Stellplätze in einen anderen Raum oder entferne sie.');
  }
  state.rooms = state.rooms.filter((r) => r.id !== id);
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

// The last printed number is shared so two phones don't print the same
// labels; everything else in meta belongs to this device.
export function setMeta(patch, { quiet = false } = {}) {
  Object.assign(state.meta, patch);
  if ('printedUpTo' in patch) writeSettings();
  else putSettings();
  if (!quiet) emit();
}

// levels: number of levels per shelf, e.g. [5, 3, 4]; zoneNames: free spots.
export function setupCellar(levels, zoneNames = []) {
  state.rooms = [{ id: 'R1', name: 'Keller' }];
  state.shelves = levels.map((n, i) => ({ id: shelfLetter(i), room: 'R1', note: '', levels: n }));
  state.zones = zoneNames.map((name, i) => ({ id: `S${i + 1}`, room: 'R1', name }));
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

async function replaceAll({ rooms = [], shelves, zones = [], categories, meta, boxes, photos }) {
  const tx = db.transaction(['meta', 'boxes', 'photos'], 'readwrite');
  for (const name of ['meta', 'boxes', 'photos']) tx.objectStore(name).clear();
  tx.objectStore('meta').put({ rooms, shelves, zones, categories, meta }, 'settings');
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
    const next = { ...withRooms(settings), categories: settings.categories ?? [] };
    const current = { rooms: state.rooms, shelves: state.shelves, zones: state.zones, categories: state.categories };
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      Object.assign(state, next);
      changed = true;
    }
    state.meta.printedUpTo = Math.max(state.meta.printedUpTo, settings.printedUpTo ?? 0);
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
    rooms: settings?.rooms ?? [],
    shelves: settings?.shelves ?? [],
    zones: settings?.zones ?? [],
    categories: settings?.categories ?? DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    meta: {
      ...freshMeta(),
      setupDone: true,
      lastBackup: state.meta.lastBackup,
      printedUpTo: settings?.printedUpTo ?? 0,
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
    rooms: data.rooms ?? [],
    shelves: data.shelves,
    zones: data.zones ?? [],
    categories: data.categories ?? [],
    meta: { ...freshMeta(), ...data.meta, setupDone: true, household: state.meta.household ?? null },
    boxes: data.boxes.map((b) => ({ kind: 'box', items: [], photos: [], notes: '', title: '', ...b })),
    photos,
  });
}

export const resetAll = () => replaceAll({ rooms: [], shelves: [], zones: [], categories: [], meta: freshMeta(), boxes: [], photos: [] });

// ---------------------------------------------------------------------------
// Demo data, to try the app before the real cellar is done.

// Boxes: [number, category, place, contents, notes]
const DEMO_BOXES = [
  [1, 'weihnachten', 'A1', 'Christbaumkugeln rot, Christbaumkugeln gold, Lametta, Baumspitze, Strohsterne'],
  [2, 'weihnachten', 'A1', 'Lichterkette innen (3×), Lichterkette außen, Verlängerungskabel, Zeitschaltuhr'],
  [3, 'weihnachten', 'A2', 'Krippe mit Figuren, Adventskranz-Ständer, Schwibbogen, Räuchermännchen', 'Zerbrechlich – nicht unten hinstellen.'],
  [4, 'deko', 'A3', 'Ostereier zum Aufhängen, Osterhasen, Eierbecher, Tischdecke Frühling'],
  [5, 'deko', 'A3', 'Kürbis-Lichter, Hexenkostüm, Skelett-Kostüm Kinder, Spinnweben-Deko, Schminke'],
  [6, 'kleidung', 'B1', 'Schneeanzug Gr. 110, Skihandschuhe, Mützen, Thermohosen'],
  [7, 'kleidung', 'B2', 'Bodys Gr. 62–74, Strampler, Schlafsack 70 cm, Mützchen', 'Für die Cousine aufheben.'],
  [8, 'kleidung', 'B2', 'Badehosen, Sommerkleider, Sonnenhüte, Flip-Flops, Strandtuch'],
  [9, 'freizeit', 'D5', 'Skibrillen, Skihelme (2×), Skiunterwäsche, Skiwachs'],
  [10, 'freizeit', 'E2', 'Zelt 4 Personen, Isomatten (3×), Gaskocher, Campinggeschirr, Stirnlampen'],
  [11, 'werkzeug', 'E1', 'Akkubohrer, Bit-Set, Wasserwaage, Schraubendreher, Dübel & Schrauben'],
  [12, 'elektronik', 'C2', 'HDMI-Kabel, USB-C-Ladegeräte, Mehrfachstecker, alte Handys, Router (alt)'],
  [13, 'kinder', 'D3', 'Duplo-Steine, Lego City Polizeistation, Lego-Anleitungen'],
  [14, 'haushalt', 'D2', 'Pappteller, Becher, Servietten, Luftballons, Girlanden'],
  [15, 'dokumente', 'D6', 'Ordner Steuer 2019–2021, Ordner Steuer 2022–2024, Mietvertrag alt, Garantiebelege'],
  [16, 'erinnerungen', 'D1', 'Fotoalben 1990–2005, Hochzeitsalbum, Kinderzeichnungen'],
  [17, 'haushalt', 'none', 'Geschenkpapier, Schleifenband, Geschenktüten, Grußkarten'],
  [18, 'haushalt', 'away', 'Raclette-Grill, Fondue-Set, Fonduegabeln', 'Gerade oben in der Küche.'],
];

// Loose items: [number, title, category, place, notes]
const DEMO_ITEMS = [
  [19, 'Weihnachtsbaum (künstlich)', 'weihnachten', '@S2', 'In der Originalhülle, 1,80 m, Baumständer liegt dabei.'],
  [20, 'Kinderwagen', 'kinder', '@S1'],
  [21, 'Großer Koffer', 'freizeit', 'B3', 'Steht im hohen unteren Fach.'],
  [22, 'Schlitten', 'freizeit', '@S4'],
];

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
    ...DEMO_BOXES.map(([number, category, where, items, notes = ''], i) =>
      entry(i, {
        kind: 'box', number, title: '', category, location: parseLocKey(where), items: items.split(', '), notes,
        awaySince: where === 'away' ? now - 12 * 86400000 : null,
      })),
    ...DEMO_ITEMS.map(([number, title, category, where, notes = ''], i) =>
      entry(DEMO_BOXES.length + i, { kind: 'item', number, title, category, location: parseLocKey(where), items: [], notes })),
  ];
  await replaceAll({
    rooms: [
      { id: 'R1', name: 'Keller' },
      { id: 'R2', name: 'Garage' },
    ],
    shelves: [
      { id: 'A', room: 'R1', note: 'Links neben der Tür', levels: 5 },
      { id: 'B', room: 'R1', note: 'Hohes Regal, linke Wand', levels: 3 },
      { id: 'C', room: 'R1', note: 'Rückwand', levels: 4 },
      { id: 'D', room: 'R1', note: 'Schmales Regal rechts', levels: 6 },
      { id: 'E', room: 'R2', note: 'Schwerlastregal an der Rückwand', levels: 3 },
    ],
    zones: [
      { id: 'S1', room: 'R1', name: 'Boden vor Regal C' },
      { id: 'S2', room: 'R1', name: 'Unter der Treppe' },
      { id: 'S3', room: 'R1', name: 'Wandhaken neben der Tür' },
      { id: 'S4', room: 'R2', name: 'Wandhaken Garage' },
    ],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    meta: { ...freshMeta(), setupDone: true, printedUpTo: 24, lastBackup: now },
    boxes,
    photos: [],
  });
}

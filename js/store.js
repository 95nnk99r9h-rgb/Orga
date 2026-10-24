// State and persistence. Everything is read from memory; writes update memory
// synchronously, notify subscribers and are persisted to IndexedDB in the
// background. Photos live in their own object store and are loaded lazily.

import { locKey, normalize, pad } from './format.js';

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

export const MAX_LEVELS = 12;

const freshMeta = () => ({ setupDone: false, lastBackup: null, printedUpTo: 0, printedShelves: false });

export const state = {
  shelves: [], // { id: 'A', note: '', levels: 5 }
  categories: [], // { id, name, color }
  boxes: [], // { id, number, title, category, location, items[], notes, photos[], createdAt, updatedAt }
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

const writeBox = (box) => persist(promisify(os('boxes', 'readwrite').put(box)));
const writeSettings = () =>
  persist(
    promisify(
      os('meta', 'readwrite').put({ shelves: state.shelves, categories: state.categories, meta: state.meta }, 'settings'),
    ),
  );

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

async function loadAll() {
  const settings = await promisify(os('meta').get('settings'));
  state.shelves = settings?.shelves ?? [];
  state.categories = settings?.categories ?? [];
  state.meta = { ...freshMeta(), ...settings?.meta };
  state.boxes = await promisify(os('boxes').getAll());
}

export const uid = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ---------------------------------------------------------------------------
// Queries

const byNumber = (a, b) => a.number - b.number;

export const boxById = (id) => state.boxes.find((b) => b.id === id);
export const boxByNumber = (n) => state.boxes.find((b) => b.number === n);
export const categoryById = (id) => state.categories.find((c) => c.id === id);
export const shelfById = (id) => state.shelves.find((s) => s.id === id);
export const sortedBoxes = () => [...state.boxes].sort(byNumber);

export const boxesAt = (shelf, level = null) =>
  state.boxes
    .filter((b) => b.location?.shelf === shelf && (level == null || b.location.level === level))
    .sort(byNumber);

export const unplacedBoxes = () => state.boxes.filter((b) => !b.location).sort(byNumber);
export const awayBoxes = () => state.boxes.filter((b) => b.location?.away).sort(byNumber);
export const boxesInCategory = (id) => state.boxes.filter((b) => (b.category ?? null) === id).sort(byNumber);
export const recentBoxes = (n = 5) => [...state.boxes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, n);
export const itemCount = () => state.boxes.reduce((n, b) => n + b.items.length, 0);

export function countAt(loc) {
  const key = locKey(loc);
  return state.boxes.filter((b) => locKey(b.location) === key).length;
}

export const nextNumber = () => state.boxes.reduce((max, b) => Math.max(max, b.number), 0) + 1;

export function isValidLocation(loc) {
  if (!loc || loc.away) return true;
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
    const other = [box.notes, categoryById(box.category)?.name, locKey(box.location)].map(normalize);
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
// Boxes

function assertNumber(number, selfId = null) {
  if (!Number.isInteger(number) || number < 1 || number > 9999) {
    throw new Error('Die Kistennummer muss zwischen 1 und 9999 liegen.');
  }
  const other = boxByNumber(number);
  if (other && other.id !== selfId) throw new Error(`Die Nummer ${pad(number)} ist schon vergeben.`);
}

export function createBox(data) {
  assertNumber(data.number);
  const now = Date.now();
  const box = {
    id: uid(),
    number: data.number,
    title: (data.title ?? '').trim(),
    category: data.category ?? null,
    location: data.location ?? null,
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
  if (!box) throw new Error('Kiste nicht gefunden.');
  if ('number' in patch) assertNumber(patch.number, id);
  Object.assign(box, patch, { updatedAt: Date.now() });
  writeBox(box);
  emit();
  return box;
}

export const moveBox = (id, location) => updateBox(id, { location });

export function deleteBox(id) {
  const box = boxById(id);
  if (!box) return;
  state.boxes = state.boxes.filter((b) => b.id !== id);
  const tx = db.transaction(['boxes', 'photos'], 'readwrite');
  tx.objectStore('boxes').delete(id);
  for (const pid of box.photos) tx.objectStore('photos').delete(pid);
  box.photos.forEach(forgetPhotoURL);
  persist(new Promise((res, rej) => ((tx.oncomplete = res), (tx.onerror = () => rej(tx.error)))));
  emit();
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
  await persist(new Promise((res, rej) => ((tx.oncomplete = res), (tx.onerror = () => rej(tx.error)))));
  return records.map((r) => r.id);
}

export function deletePhotos(ids) {
  if (!ids.length) return;
  const tx = db.transaction('photos', 'readwrite');
  for (const id of ids) {
    tx.objectStore('photos').delete(id);
    forgetPhotoURL(id);
  }
  persist(new Promise((res, rej) => ((tx.oncomplete = res), (tx.onerror = () => rej(tx.error)))));
}

// ---------------------------------------------------------------------------
// Shelves & categories

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
    if (blocked) throw new Error(`Auf Boden ${blocked.location.level} stehen noch Kisten. Räume sie zuerst um.`);
    patch = { ...patch, levels };
  }
  Object.assign(shelf, patch);
  writeSettings();
  emit();
}

export function removeShelf(id) {
  for (const box of state.boxes) {
    if (box.location?.shelf === id) {
      box.location = null;
      box.updatedAt = Date.now();
      writeBox(box);
    }
  }
  state.shelves = state.shelves.filter((s) => s.id !== id);
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

export function setMeta(patch) {
  Object.assign(state.meta, patch);
  writeSettings();
  emit();
}

export function setupCellar(shelfCount, levels) {
  state.shelves = Array.from({ length: shelfCount }, (_, i) => ({ id: shelfLetter(i), note: '', levels }));
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
    version: 1,
    exportedAt: new Date().toISOString(),
    shelves: state.shelves,
    categories: state.categories,
    meta: state.meta,
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

async function replaceAll({ shelves, categories, meta, boxes, photos }) {
  const tx = db.transaction(['meta', 'boxes', 'photos'], 'readwrite');
  for (const name of ['meta', 'boxes', 'photos']) tx.objectStore(name).clear();
  tx.objectStore('meta').put({ shelves, categories, meta }, 'settings');
  for (const b of boxes) tx.objectStore('boxes').put(b);
  for (const p of photos) tx.objectStore('photos').put(p);
  await new Promise((res, rej) => ((tx.oncomplete = res), (tx.onerror = () => rej(tx.error))));
  for (const key of photoURLs.keys()) forgetPhotoURL(key.split(':')[0]);
  await loadAll();
  emit();
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
    categories: data.categories ?? [],
    meta: { ...freshMeta(), ...data.meta, setupDone: true },
    boxes: data.boxes.map((b) => ({ items: [], photos: [], notes: '', title: '', ...b })),
    photos,
  });
}

export const resetAll = () => replaceAll({ shelves: [], categories: [], meta: freshMeta(), boxes: [], photos: [] });

// ---------------------------------------------------------------------------
// Demo data, to try the app before the real cellar is done.

const DEMO = [
  [1, 'Christbaumschmuck', 'weihnachten', 'A1', 'Christbaumkugeln rot, Christbaumkugeln gold, Lametta, Baumspitze, Strohsterne'],
  [2, 'Lichterketten', 'weihnachten', 'A1', 'Lichterkette innen (3×), Lichterkette außen, Verlängerungskabel, Zeitschaltuhr'],
  [3, 'Krippe & Adventsdeko', 'weihnachten', 'A2', 'Krippe mit Figuren, Adventskranz-Ständer, Schwibbogen, Räuchermännchen', 'Zerbrechlich – nicht unten hinstellen.'],
  [4, 'Osterdeko', 'deko', 'A3', 'Ostereier zum Aufhängen, Osterhasen, Eierbecher, Tischdecke Frühling'],
  [5, 'Halloween & Fasching', 'deko', 'A3', 'Kürbis-Lichter, Hexenkostüm, Skelett-Kostüm Kinder, Spinnweben-Deko, Schminke'],
  [6, 'Winterkleidung Kinder', 'kleidung', 'B1', 'Schneeanzug Gr. 110, Skihandschuhe, Mützen, Thermohosen'],
  [7, 'Babykleidung 62–74', 'kleidung', 'B2', 'Bodys, Strampler, Schlafsack 70 cm, Mützchen', 'Für die Cousine aufheben.'],
  [8, 'Sommersachen', 'kleidung', 'B2', 'Badehosen, Sommerkleider, Sonnenhüte, Flip-Flops, Strandtuch'],
  [9, 'Skiausrüstung', 'freizeit', 'B4', 'Skibrillen, Skihelme (2×), Skiunterwäsche, Skiwachs'],
  [10, 'Camping', 'freizeit', 'C4', 'Zelt 4 Personen, Isomatten (3×), Gaskocher, Campinggeschirr, Stirnlampen'],
  [11, 'Werkzeug', 'werkzeug', 'C4', 'Akkubohrer, Bit-Set, Wasserwaage, Schraubendreher, Dübel & Schrauben'],
  [12, 'Kabel & Ladegeräte', 'elektronik', 'C2', 'HDMI-Kabel, USB-C-Ladegeräte, Mehrfachstecker, alte Handys, Router (alt)'],
  [13, 'Lego & Duplo', 'kinder', 'D3', 'Duplo-Steine, Lego City Polizeistation, Lego-Anleitungen'],
  [14, 'Partygeschirr', 'haushalt', 'D2', 'Pappteller, Becher, Servietten, Luftballons, Girlanden'],
  [15, 'Steuer & Verträge', 'dokumente', 'D1', 'Ordner Steuer 2019–2021, Ordner Steuer 2022–2024, Mietvertrag alt, Garantiebelege'],
  [16, 'Fotoalben', 'erinnerungen', 'D1', 'Fotoalben 1990–2005, Hochzeitsalbum, Kinderzeichnungen'],
  [17, 'Geschenkpapier', 'haushalt', 'none', 'Geschenkpapier, Schleifenband, Geschenktüten, Grußkarten'],
  [18, 'Raclette & Fondue', 'haushalt', 'away', 'Raclette-Grill, Fondue-Set, Fonduegabeln', 'Gerade oben in der Küche.'],
];

export async function loadDemo() {
  const now = Date.now();
  const loc = (key) => (key === 'none' ? null : key === 'away' ? { away: true } : { shelf: key[0], level: Number(key.slice(1)) });
  const boxes = DEMO.map(([number, title, category, where, items, notes = ''], i) => ({
    id: uid(),
    number,
    title,
    category,
    location: loc(where),
    items: items.split(', '),
    notes,
    photos: [],
    createdAt: now - (30 - i) * 86400000,
    updatedAt: now - (DEMO.length - i) * 3600000 * 7,
  }));
  await replaceAll({
    shelves: [
      { id: 'A', note: 'Links neben der Tür', levels: 5 },
      { id: 'B', note: 'Linke Wand', levels: 5 },
      { id: 'C', note: 'Rückwand', levels: 4 },
      { id: 'D', note: 'Rechts unter dem Fenster', levels: 4 },
    ],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    meta: { ...freshMeta(), setupDone: true, printedUpTo: 24, printedShelves: true, lastBackup: now },
    boxes,
    photos: [],
  });
}

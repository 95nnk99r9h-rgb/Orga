// Online sync: several devices share one "household" in Firebase Firestore.
// The app stays local-first and always works from its own IndexedDB. This
// module mirrors local changes into the household and applies changes made
// on other devices. Firestore keeps writes made offline (also across app
// restarts) and sends them once there is a connection again.
//
//   households/{code}                { name, members: [uid], createdAt }
//   households/{code}/meta/settings  { rooms, shelves, zones, categories, printedUpTo, modifiedAt }
//   households/{code}/boxes/{id}     an entry as stored locally (photo ids only)
//   households/{code}/photos/{id}    { boxId, data: JPEG as data URL, createdAt }

import config from './firebase-config.js';
import {
  state, setSyncHooks, sharedSettings, applyRemote, adoptHousehold, setMeta, photoRecord, photoIds, storeRemotePhoto,
} from './store.js';
import { processImage, shrink } from './photos.js';

const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // without 0/O and 1/I/L
const CODE_LENGTH = 12;
const TIMEOUT_MS = 15000;
const PHOTO_RETRIES = [5, 20, 60]; // seconds; a photo may arrive after its box

export const syncConfigured = () => !!config?.projectId;
export const linkedHousehold = () => state.meta.household;
export const formatCode = (code) => code.match(/.{1,4}/g).join('-');

export function readCode(input) {
  const code = String(input ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_CHARS.includes(c)) ? code : null;
}

const newCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(CODE_LENGTH)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');

// off | connecting | synced | pending | offline | error
let status = { state: 'off', message: '' };
export const syncStatus = () => status;

function setStatus(next, message = '') {
  if (status.state === next && status.message === message) return;
  status = { state: next, message };
  window.dispatchEvent(new CustomEvent('fundort:sync'));
}

function report(err) {
  console.error(err);
  setStatus('error', err.code === 'permission-denied' ? 'Kein Zugriff auf den Haushalt.' : err.message);
}

function withTimeout(promise) {
  const message = 'Keine Verbindung zum Server. Prüfe das Internet und versuche es erneut.';
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(message)), TIMEOUT_MS))]);
}

// ---------------------------------------------------------------------------
// Firebase

let fb = null; // the SDK module
let auth = null;
let db = null;
let uid = null;
let setup = null;

async function connect() {
  setup ??= import('../vendor/firebase.mjs').then((sdk) => {
    fb = sdk;
    const app = fb.initializeApp(config);
    auth = fb.initializeAuth(app, { persistence: [fb.indexedDBLocalPersistence, fb.browserLocalPersistence] });
    db = fb.initializeFirestore(app, { localCache: fb.persistentLocalCache({ tabManager: fb.persistentSingleTabManager() }) });
    if (config.emulatorHost) {
      // Local Firebase emulator, for development only.
      fb.connectAuthEmulator(auth, `http://${config.emulatorHost}:9099`, { disableWarnings: true });
      fb.connectFirestoreEmulator(db, config.emulatorHost, 8080);
    }
  });
  await setup;
  if (uid) return;
  await auth.authStateReady();
  // An anonymous account per device; membership in a household is what counts.
  uid = (auth.currentUser ?? (await withTimeout(fb.signInAnonymously(auth))).user).uid;
}

const ref = (...path) => fb.doc(db, 'households', ...path);
const boxesOf = (code) => fb.collection(db, 'households', code, 'boxes');
const plain = (value) => JSON.parse(JSON.stringify(value)); // Firestore rejects undefined

const dataURL = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

// ---------------------------------------------------------------------------
// Local → household

const pushSettings = (code) => fb.setDoc(ref(code, 'meta', 'settings'), plain(sharedSettings())).catch(report);
const pushBox = (code, box) => fb.setDoc(ref(code, 'boxes', box.id), plain(box)).catch(report);

// Photos are stored downscaled inside the database (a document holds ~1 MB).
async function pushPhoto(code, record) {
  let blob = await shrink(record.full, 1280, 0.72);
  if (blob.size > 600_000) blob = await shrink(record.full, 900, 0.6);
  const data = await dataURL(blob);
  fb.setDoc(ref(code, 'photos', record.id), { boxId: record.boxId, data, createdAt: record.createdAt ?? Date.now() }).catch(report);
}

async function pushBoxPhotos(code, box) {
  for (const id of box.photos) {
    const record = await photoRecord(id);
    if (record) await pushPhoto(code, record);
  }
}

async function uploadAll(code, { prune = false } = {}) {
  pushSettings(code);
  for (let i = 0; i < state.boxes.length; i += 400) {
    const batch = fb.writeBatch(db);
    for (const box of state.boxes.slice(i, i + 400)) batch.set(ref(code, 'boxes', box.id), plain(box));
    batch.commit().catch(report);
  }
  if (prune) {
    const keep = new Set(state.boxes.map((b) => b.id));
    const remote = await fb.getDocs(boxesOf(code));
    for (const d of remote.docs) if (!keep.has(d.id)) fb.deleteDoc(d.ref).catch(report);
  }
  for (const box of state.boxes) await pushBoxPhotos(code, box);
}

// Hooks called by the store. Until the connection is up they are kept in a
// backlog, so nothing changed right after start is lost.
let ready = false;
const backlog = [];

function install(code) {
  const hooks = {
    box: (box) => pushBox(code, box),
    settings: () => pushSettings(code),
    deleteBox: (box) => {
      fb.deleteDoc(ref(code, 'boxes', box.id)).catch(report);
      for (const id of box.photos) fb.deleteDoc(ref(code, 'photos', id)).catch(report);
    },
    photos: (records) => {
      for (const r of records) {
        known?.add(r.id);
        pushPhoto(code, r).catch(report);
      }
    },
    deletePhotos: (ids) => ids.forEach((id) => fb.deleteDoc(ref(code, 'photos', id)).catch(report)),
    // Backup restored, data reset or demo loaded on this device.
    replaced: () => (state.meta.household?.id === code ? uploadAll(code, { prune: true }).catch(report) : detach()),
  };
  setSyncHooks(
    Object.fromEntries(
      Object.entries(hooks).map(([name, fn]) => [name, (...args) => (ready ? fn(...args) : backlog.push(() => fn(...args)))]),
    ),
  );
}

// ---------------------------------------------------------------------------
// Household → local

let known = null; // ids of photos stored on this device
const inflight = new Set();

async function fetchPhoto(code, boxId, id, attempt = 0) {
  if (known.has(id) || inflight.has(id)) return;
  inflight.add(id);
  try {
    const snap = await fb.getDoc(ref(code, 'photos', id));
    if (snap.exists()) {
      const { full, thumb } = await processImage(await (await fetch(snap.data().data)).blob());
      await storeRemotePhoto({ id, boxId, full, thumb, createdAt: snap.data().createdAt });
      known.add(id);
    } else if (attempt < PHOTO_RETRIES.length) {
      setTimeout(() => active === code && fetchPhoto(code, boxId, id, attempt + 1), PHOTO_RETRIES[attempt] * 1000);
    }
  } catch (err) {
    console.warn('Foto nicht geladen', err);
  } finally {
    inflight.delete(id);
  }
}

async function fetchMissingPhotos(code, boxes) {
  known ??= new Set(await photoIds());
  for (const box of boxes) for (const id of box.photos ?? []) await fetchPhoto(code, box.id, id);
}

// First answer from the server after (re)connecting: send what changed here
// while the sync wasn't running; drop what was deleted elsewhere meanwhile.
function reconcile(code, snap, removed) {
  const remote = new Map(snap.docs.map((d) => [d.id, d.data()]));
  const lastSync = state.meta.household?.lastSync ?? 0;
  for (const box of state.boxes) {
    const mine = box.modifiedAt ?? box.updatedAt ?? 0;
    const theirs = remote.get(box.id);
    if (!theirs) {
      if (mine > lastSync) {
        pushBox(code, box);
        pushBoxPhotos(code, box).catch(report);
      } else removed.push(box.id);
    } else if (mine > (theirs.modifiedAt ?? theirs.updatedAt ?? 0)) pushBox(code, box);
  }
}

function track(metadata) {
  if (!navigator.onLine) return setStatus('offline');
  if (metadata.hasPendingWrites) return setStatus('pending');
  if (metadata.fromCache) return setStatus('connecting');
  setStatus('synced');
  const h = state.meta.household;
  if (h && Date.now() - (h.lastSync ?? 0) > 60_000) setMeta({ household: { ...h, lastSync: Date.now() } }, { quiet: true });
}

let active = null; // code of the household being mirrored
let listeners = [];
let rejoined = false;

// Membership got lost (e.g. the device's anonymous account was reset by iOS):
// knowing the code is enough to join again.
function onListenError(code) {
  return (err) => {
    if (err.code === 'permission-denied' && !rejoined) {
      rejoined = true;
      fb.setDoc(ref(code), { members: fb.arrayUnion(uid) }, { merge: true }).then(() => attach(code), report);
    } else report(err);
  };
}

function attach(code) {
  listeners.forEach((stop) => stop());
  active = code;
  known = null;
  setStatus(navigator.onLine ? 'connecting' : 'offline');
  install(code);
  ready = true;
  backlog.splice(0).forEach((run) => run());

  let firstServerAnswer = true;
  listeners = [
    fb.onSnapshot(ref(code, 'meta', 'settings'), (snap) => {
      if (!snap.exists() || snap.metadata.hasPendingWrites) return;
      const remote = snap.data();
      if ((state.meta.settingsModifiedAt ?? 0) > (remote.modifiedAt ?? 0)) pushSettings(code);
      else applyRemote({ settings: remote });
    }, onListenError(code)),
    fb.onSnapshot(boxesOf(code), { includeMetadataChanges: true }, (snap) => {
      const boxes = [];
      const removed = [];
      for (const change of snap.docChanges()) {
        if (change.doc.metadata.hasPendingWrites) continue; // our own change, already applied
        if (change.type === 'removed') {
          removed.push(change.doc.id);
          // Its photos are deleted here too; fetch them again if it comes back.
          for (const id of change.doc.data().photos ?? []) known?.delete(id);
        } else boxes.push(change.doc.data());
      }
      if (firstServerAnswer && !snap.metadata.fromCache) {
        firstServerAnswer = false;
        reconcile(code, snap, removed);
      }
      applyRemote({ boxes, removed });
      fetchMissingPhotos(code, boxes);
      track(snap.metadata);
    }, onListenError(code)),
  ];
}

function detach() {
  listeners.forEach((stop) => stop());
  listeners = [];
  active = null;
  ready = false;
  backlog.length = 0;
  setSyncHooks({});
  setStatus('off');
}

// ---------------------------------------------------------------------------
// Public

export async function initSync() {
  if (!syncConfigured()) return;
  window.addEventListener('offline', () => active && setStatus('offline'));
  window.addEventListener('online', () => active && setStatus('connecting'));
  const household = state.meta.household;
  if (!household) return;
  install(household.id); // collect changes until connected
  setStatus('connecting');
  try {
    await connect();
    attach(household.id);
  } catch (err) {
    report(err);
  }
}

// This device's data becomes the household's data.
export async function createHousehold(name) {
  await connect();
  const code = newCode();
  await withTimeout(fb.setDoc(ref(code), { name, members: [uid], createdAt: Date.now() }));
  setMeta({ household: { id: code, name, lastSync: 0 } });
  attach(code);
  uploadAll(code).catch(report);
  return code;
}

// This device takes over the household's data.
export async function joinHousehold(code) {
  await connect();
  const household = await withTimeout(fb.getDoc(ref(code)));
  if (!household.exists()) throw new Error('Diesen Haushalt gibt es nicht. Bitte prüfe den Code.');
  if (!household.data().members?.includes(uid)) {
    await withTimeout(fb.setDoc(ref(code), { members: fb.arrayUnion(uid) }, { merge: true }));
  }
  const [settings, boxes] = await withTimeout(Promise.all([fb.getDoc(ref(code, 'meta', 'settings')), fb.getDocs(boxesOf(code))]));
  detach();
  await adoptHousehold({
    settings: settings.exists() ? settings.data() : null,
    boxes: boxes.docs.map((d) => d.data()),
    household: { id: code, name: household.data().name, lastSync: Date.now() },
  });
  attach(code);
}

// Stop syncing on this device; its data stays here.
export function leaveHousehold() {
  const household = state.meta.household;
  if (!household) return;
  if (fb && uid) fb.setDoc(ref(household.id), { members: fb.arrayRemove(uid) }, { merge: true }).catch(() => {});
  detach();
  setMeta({ household: null });
}

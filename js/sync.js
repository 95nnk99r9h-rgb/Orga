// Online sync: several devices share one "household" in Firebase Firestore.
// The app stays local-first and always works from its own IndexedDB. This
// module mirrors local changes into the household and applies changes made
// on other devices. Firestore keeps writes made offline (also across app
// restarts) and sends them once there is a connection again.
//
// Everyone signs in with e-mail and password; the household lists the
// accounts that belong to it. Devices set up before accounts existed sign
// in anonymously and keep working until they get an account.
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

// off | connecting | synced | pending | offline | signedOut | error
let status = { state: 'off', message: '' };
export const syncStatus = () => status;

const notify = () => window.dispatchEvent(new CustomEvent('fundort:sync'));

function setStatus(next, message = '') {
  if (status.state === next && status.message === message) return;
  status = { state: next, message };
  notify();
}

function report(err) {
  console.error(err);
  setStatus('error', err.code === 'permission-denied' ? 'Kein Zugriff auf den Haushalt.' : err.message);
}

const OFFLINE = 'Keine Verbindung zum Server. Prüfe das Internet und versuche es erneut.';

function withTimeout(promise) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(OFFLINE)), TIMEOUT_MS))]);
}

const WRONG_LOGIN = 'E-Mail-Adresse oder Passwort stimmen nicht.';
const TAKEN = 'Für diese E-Mail-Adresse gibt es schon ein Konto. Melde dich damit an.';
const DISABLED = 'Die Anmeldung mit E-Mail und Passwort ist im Firebase-Projekt nicht eingeschaltet (docs/ONLINE.md, Schritt 2).';
const AUTH_ERRORS = {
  'auth/invalid-email': 'Diese E-Mail-Adresse ist ungültig.',
  'auth/missing-email': 'Bitte gib deine E-Mail-Adresse ein.',
  'auth/missing-password': 'Bitte gib dein Passwort ein.',
  'auth/invalid-credential': WRONG_LOGIN,
  'auth/invalid-login-credentials': WRONG_LOGIN,
  'auth/wrong-password': WRONG_LOGIN,
  'auth/user-not-found': WRONG_LOGIN,
  'auth/email-already-in-use': TAKEN,
  'auth/credential-already-in-use': TAKEN,
  'auth/weak-password': 'Das Passwort ist zu kurz – es braucht mindestens 6 Zeichen.',
  'auth/password-does-not-meet-requirements': 'Das Passwort erfüllt die Vorgaben des Firebase-Projekts nicht.',
  'auth/user-disabled': 'Dieses Konto ist gesperrt.',
  'auth/too-many-requests': 'Zu viele Versuche. Warte ein paar Minuten und versuche es dann erneut.',
  'auth/network-request-failed': OFFLINE,
  'auth/operation-not-allowed': DISABLED,
  'auth/admin-restricted-operation': DISABLED,
};

const readable = (err) => (AUTH_ERRORS[err.code] ? Object.assign(new Error(AUTH_ERRORS[err.code]), { code: err.code }) : err);

// ---------------------------------------------------------------------------
// Firebase

let fb = null; // the SDK module
let auth = null;
let db = null;
let uid = null; // the signed-in account, null when signed out
let authKnown = false; // false until the stored sign-in has been read
let setup = null;

async function connect() {
  setup ??= import('../vendor/firebase.mjs').then((sdk) => {
    fb = sdk;
    const app = fb.initializeApp(config);
    auth = fb.initializeAuth(app, { persistence: [fb.indexedDBLocalPersistence, fb.browserLocalPersistence] });
    auth.languageCode = 'de'; // e-mails such as the password reset
    db = fb.initializeFirestore(app, { localCache: fb.persistentLocalCache({ tabManager: fb.persistentSingleTabManager() }) });
    if (config.emulatorHost) {
      // Local Firebase emulator, for development only.
      fb.connectAuthEmulator(auth, `http://${config.emulatorHost}:9099`, { disableWarnings: true });
      fb.connectFirestoreEmulator(db, config.emulatorHost, 8080);
    }
    fb.onAuthStateChanged(auth, (user) => {
      uid = user?.uid ?? null;
      authKnown = true;
      // Signed out elsewhere (account deleted or disabled): stop listening.
      if (!user && active) {
        pause();
        setStatus('signedOut');
      }
      notify();
    });
  }, (err) => {
    setup = null;
    throw err;
  });
  await setup;
  await auth.authStateReady();
  authKnown = true;
  uid = auth.currentUser?.uid ?? null;
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

// Membership got lost (e.g. a device's anonymous account was reset by iOS
// or left on another device): knowing the code is enough to join again.
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

// Stop listening but keep collecting local changes (see install) until the
// next attach – used while signed out or switching accounts.
function pause() {
  listeners.forEach((stop) => stop());
  listeners = [];
  active = null;
  ready = false;
}

function detach() {
  pause();
  backlog.length = 0;
  setSyncHooks({});
  setStatus('off');
}

// Signing in on a device that already shares a household keeps it shared:
// the account becomes a member; the device's old anonymous account leaves.
async function ensureMember(code, before) {
  const snap = await withTimeout(fb.getDoc(ref(code)));
  if (!snap.exists()) return;
  const members = snap.data().members ?? [];
  if (!members.includes(uid)) await withTimeout(fb.setDoc(ref(code), { members: fb.arrayUnion(uid) }, { merge: true }));
  if (before?.isAnonymous && before.uid !== uid && members.includes(before.uid)) {
    fb.setDoc(ref(code), { members: fb.arrayRemove(before.uid) }, { merge: true }).catch(() => {});
  }
}

async function switchAccount(task) {
  await connect();
  const before = auth.currentUser;
  const code = state.meta.household?.id;
  if (code) {
    pause();
    setStatus('connecting');
  }
  try {
    await withTimeout(task());
  } catch (err) {
    if (code && uid) attach(code); // still signed in as before
    else if (code) setStatus('signedOut');
    throw readable(err);
  }
  uid = auth.currentUser.uid;
  if (code) {
    await ensureMember(code, before).catch(report);
    attach(code);
  } else {
    mine = null;
    await findHouseholds();
  }
  notify();
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
    if (uid) attach(household.id);
    else setStatus('signedOut');
  } catch (err) {
    report(err);
  }
}

// The signed-in account: { email, anonymous }, null when signed out,
// undefined while not known yet (see loadAccount).
export function account() {
  if (!authKnown) return undefined;
  const user = auth.currentUser;
  return user ? { email: user.email, anonymous: user.isAnonymous } : null;
}

export const loadAccount = () => connect().catch(report);

export const signIn = (email, password) => switchAccount(() => fb.signInWithEmailAndPassword(auth, email, password));

// A device that shares a household with its anonymous account turns that
// account into one with e-mail and password, so its membership stays.
export const register = (email, password) =>
  switchAccount(() => {
    const user = auth.currentUser;
    return user?.isAnonymous
      ? fb.linkWithCredential(user, fb.EmailAuthProvider.credential(email, password))
      : fb.createUserWithEmailAndPassword(auth, email, password);
  });

export async function resetPassword(email) {
  await connect();
  try {
    await withTimeout(fb.sendPasswordResetEmail(auth, email));
  } catch (err) {
    throw readable(err);
  }
}

// The household stays linked: after signing in again, syncing continues
// with the changes made in the meantime.
export async function signOut() {
  await connect();
  if (state.meta.household) pause();
  mine = null;
  await fb.signOut(auth);
  uid = null;
  setStatus(state.meta.household ? 'signedOut' : 'off');
  notify();
}

// Households the signed-in account belongs to: [{ id, name }], null until
// looked up.
let mine = null;
let finding = null;
export const myHouseholds = () => mine;

export function findHouseholds() {
  finding ??= (async () => {
    try {
      await connect();
      if (!uid) return (mine = []);
      const snap = await withTimeout(fb.getDocs(fb.query(fb.collection(db, 'households'), fb.where('members', 'array-contains', uid))));
      mine = snap.docs.map((d) => ({ id: d.id, name: d.data().name }));
    } catch (err) {
      console.warn('Haushalte nicht gefunden', err); // e.g. rules from before accounts: join by code
      mine = [];
    } finally {
      finding = null;
    }
    notify();
    return mine;
  })();
  return finding;
}

// This device's data becomes the household's data.
export async function createHousehold(name) {
  await connect();
  if (!uid) throw new Error('Bitte melde dich zuerst an.');
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
  if (!uid) throw new Error('Bitte melde dich zuerst an.');
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

// Stop syncing on this device; its data stays here. An account stays a
// member (its other devices still use it); a device's anonymous account
// leaves the household.
export function leaveHousehold() {
  const household = state.meta.household;
  if (!household) return;
  if (auth?.currentUser?.isAnonymous) fb.setDoc(ref(household.id), { members: fb.arrayRemove(uid) }, { merge: true }).catch(() => {});
  detach();
  mine = null;
  setMeta({ household: null });
}

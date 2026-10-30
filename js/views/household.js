// "Gemeinsam nutzen": share the cellar with other devices through a
// household in Firebase (js/sync.js). Everyone signs in with e-mail and
// password. One creates the household, the others join with its code or by
// scanning its QR code; on a new phone signing in is enough to find it.

import { html, raw, icon, toast, alertDialog, confirmDialog, promptDialog } from '../ui.js';
import { navBar, largeTitle, catAttrs } from '../components.js';
import { state } from '../store.js';
import { unitsLabel } from '../format.js';
import { qrSVG, householdLink } from '../qr.js';
import {
  syncConfigured, syncStatus, formatCode, readCode, createHousehold, joinHousehold, leaveHousehold,
  account, loadAccount, signIn, register, resetPassword, signOut, myHouseholds, findHouseholds,
} from '../sync.js';
import { navigate, refresh } from '../router.js';

const GUIDE = 'https://github.com/95nnk99r9h-rgb/Orga/blob/HEAD/docs/ONLINE.md';

const STATUS = {
  off: ['gray', 'Aus'],
  connecting: ['orange', 'Verbinde …'],
  synced: ['green', 'Alles abgeglichen'],
  pending: ['blue', 'Wird hochgeladen …'],
  offline: ['orange', 'Offline – wird später abgeglichen'],
  signedOut: ['orange', 'Abgemeldet'],
  error: ['red', 'Fehler beim Abgleich'],
};

export function syncLabel() {
  if (!syncConfigured()) return 'Einrichten';
  if (!state.meta.household) return 'Aus';
  return STATUS[syncStatus().state][1];
}

let busy = false;

// The sign-in form keeps what was typed across re-renders. `mode` stays
// null until chosen, then the page picks what fits (see authForm).
const form = { mode: null, email: '', password: '', reveal: false, error: '', busy: false };

// "Alle Daten löschen" also forgets what was typed.
export const forgetForm = () => Object.assign(form, { mode: null, email: '', password: '', reveal: false, error: '' });

// No re-render under the user's fingers while a field has focus.
const typing = () => !!document.activeElement?.closest?.('.view-inner [data-form]');

const hero = (text, iconName = 'people') => html`
  <div class="card share-hero">
    <span class="share-icon" ${catAttrs('green')}>${icon(iconName)}</span>
    <p>${text}</p>
  </div>`;

function notConfigured() {
  return html`
    ${hero('Mit dem Online-Abgleich nutzt ihr Fundort zu zweit oder als ganze Familie: Alle sehen denselben Keller, Änderungen kommen in Sekunden auf allen Handys an.')}
    <h3 class="section-head">Noch nicht eingerichtet</h3>
    <div class="card note-card">Dafür braucht die App ein kostenloses Firebase-Projekt (Google). Das dauert einmalig etwa zehn Minuten – die Schritt-für-Schritt-Anleitung steht im Repository unter <b>docs/ONLINE.md</b>.</div>
    <a class="btn secondary" href="${GUIDE}" target="_blank" rel="noopener">${icon('book')} Anleitung öffnen</a>`;
}

function loading() {
  const { state: s, message } = syncStatus();
  return s === 'error'
    ? html`<div class="card note-card">${message}</div>`
    : html`<div class="list"><div class="cell muted-cell">Einen Moment …</div></div>`;
}

// ---------------------------------------------------------------------------
// Sign-in form

function authForm(fallback) {
  const mode = form.mode ?? fallback;
  const fresh = mode === 'register';
  return html`
    <div class="seg auth-seg" role="group" aria-label="Konto">
      <button type="button" data-mode="login" aria-pressed="${String(!fresh)}">Anmelden</button>
      <button type="button" data-mode="register" aria-pressed="${String(fresh)}">Konto anlegen</button>
    </div>
    <form class="card auth-form" data-form="auth" data-auth-mode="${mode}" novalidate>
      <div class="auth-field">
        <label for="auth-email">E-Mail-Adresse</label>
        <input id="auth-email" name="email" type="email" value="${form.email}" placeholder="name@beispiel.de"
          autocomplete="username" inputmode="email" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next">
      </div>
      <div class="auth-field">
        <label for="auth-password">Passwort</label>
        <div class="auth-pass">
          <input id="auth-password" name="password" type="${form.reveal ? 'text' : 'password'}"
            placeholder="${fresh ? 'Mindestens 6 Zeichen' : ''}" autocomplete="${fresh ? 'new-password' : 'current-password'}"
            autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go">
          <button type="button" class="auth-reveal" data-action="reveal" aria-pressed="${String(form.reveal)}"
            aria-label="${form.reveal ? 'Passwort verbergen' : 'Passwort anzeigen'}">${icon(form.reveal ? 'eyeSlash' : 'eye')}</button>
        </div>
      </div>
      ${form.error ? html`<p class="auth-error" role="alert">${icon('warning')}<span>${form.error}</span></p>` : ''}
      <button class="btn" type="submit" ${form.busy ? raw('disabled') : ''}>
        ${form.busy ? 'Einen Moment …' : fresh ? 'Konto anlegen' : 'Anmelden'}
      </button>
      ${fresh ? '' : html`<button type="button" class="btn plain" data-action="forgot">Passwort vergessen?</button>`}
    </form>
    <p class="section-foot">${fresh
      ? 'Jede Person legt sich ein eigenes Konto an. Nimm eine echte Adresse – dorthin kommt der Link, falls du dein Passwort einmal vergisst.'
      : 'Mit deinem Konto ist euer Keller auf jedem Gerät da – auch auf einem neuen Handy.'}</p>`;
}

function signedOut(household, invited) {
  return html`
    ${household
      ? syncCard(household)
      : hero(invited
        ? 'Du wurdest in einen Fundort-Haushalt eingeladen. Lege ein Konto an oder melde dich an – danach bist du sofort dabei.'
        : 'Mit einem Konto nutzt ihr Fundort gemeinsam: Alle sehen denselben Keller, Änderungen sind in Sekunden auf allen Handys – und auf einem neuen Handy ist nach der Anmeldung alles wieder da.', 'lock')}
    <h3 class="section-head">${household ? 'Wieder anmelden' : 'Konto'}</h3>
    ${authForm(invited ? 'register' : 'login')}
    ${household ? leaveButton() : ''}`;
}

function accountSection(user) {
  if (user.anonymous) {
    return html`
      <h3 class="section-head">Konto</h3>
      <div class="card note-card">Dieses Gerät ist noch ohne Konto mit dem Haushalt verbunden. Lege ein Konto an – dann ist euer Keller auch auf einem neuen Handy mit E-Mail und Passwort sofort wieder da.</div>
      ${authForm('register')}`;
  }
  return html`
    <h3 class="section-head">Konto</h3>
    <div class="list">
      <div class="cell">
        <span class="icon-tile" ${catAttrs('teal')}>${icon('person')}</span>
        <span class="cell-text"><span class="cell-title">${user.email}</span><span class="cell-sub">Angemeldet</span></span>
      </div>
      <button class="cell destructive center" data-action="sign-out">Abmelden</button>
    </div>
    <p class="section-foot">Melde dich auf einem neuen Gerät mit dieser Adresse an – euer Keller ist dann sofort wieder da.</p>`;
}

// ---------------------------------------------------------------------------
// Household

function syncCard(household) {
  const [color, label] = STATUS[syncStatus().state];
  const { message } = syncStatus();
  return html`
    <div class="card sync-card">
      <span class="share-icon" ${catAttrs('green')}>${icon('people')}</span>
      <span class="cell-text">
        <span class="cell-title">${household.name}</span>
        <span class="cell-sub sync-state"><span class="dot" ${catAttrs(color)}></span>${label}</span>
        ${message ? html`<span class="cell-sub wrap">${message}</span>` : ''}
      </span>
    </div>`;
}

const leaveButton = () => html`
  <div class="list spaced">
    <button class="cell destructive center" data-action="leave">Haushalt auf diesem Gerät verlassen</button>
  </div>`;

function unlinked(prefill, user) {
  const found = myHouseholds() ?? [];
  return html`
    ${hero('Lege einen Haushalt an und teile den Code. Alle Geräte im Haushalt sehen denselben Keller – live, und auch ohne Netz im Keller wird nichts vergessen.')}

    ${found.length
      ? html`
        <h3 class="section-head">Deine Haushalte</h3>
        <div class="list">
          ${found.map(
            (h) => html`
              <button class="cell" data-open="${h.id}" ${busy ? raw('disabled') : ''}>
                <span class="icon-tile" ${catAttrs('green')}>${icon('house')}</span>
                <span class="cell-text"><span class="cell-title">${h.name}</span><span class="cell-sub">Auf diesem Gerät öffnen</span></span>
                ${icon('chevron', 'chev')}
              </button>`,
          )}
        </div>
        <p class="section-foot">Dein Konto gehört schon dazu – tippen genügt.</p>`
      : ''}

    <h3 class="section-head">${found.length ? 'Neuer Haushalt' : 'Erstes Gerät'}</h3>
    <div class="list">
      <button class="cell" data-action="create" ${busy ? raw('disabled') : ''}>
        <span class="icon-tile" ${catAttrs('green')}>${icon('plus')}</span>
        <span class="cell-text"><span class="cell-title">Haushalt anlegen</span><span class="cell-sub">Die Daten dieses Geräts werden hochgeladen</span></span>
        ${icon('chevron', 'chev')}
      </button>
    </div>

    <h3 class="section-head">Einladung</h3>
    <form class="list" data-form="join">
      <label class="cell field">
        <span class="field-label">Code</span>
        <input name="code" value="${prefill ? formatCode(prefill) : ''}" placeholder="XXXX-XXXX-XXXX" autocomplete="off"
          autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Haushalts-Code">
      </label>
      <button class="cell tint-text center" type="submit" ${busy ? raw('disabled') : ''}>Haushalt beitreten</button>
    </form>
    <p class="section-foot">Den Code findest du auf einem Gerät, das schon dabei ist, unter „Mehr → Gemeinsam nutzen“. Du kannst den QR-Code dort auch mit „Scannen“ erfassen.</p>

    ${accountSection(user)}`;
}

function linked(household, user) {
  const paused = syncStatus().state === 'signedOut';
  return html`
    ${syncCard(household)}
    <p class="section-foot">${unitsLabel(state.boxes)} · ${paused ? 'Änderungen werden nach der Anmeldung geteilt.' : 'Änderungen auf diesem Gerät werden automatisch geteilt.'}</p>

    <h3 class="section-head">Weiteres Gerät hinzufügen</h3>
    <div class="card code-card">
      <div class="code-qr">${raw(qrSVG(householdLink(household.id)))}</div>
      <div class="code-text">${formatCode(household.id)}</div>
      <p>Auf dem anderen Handy Fundort öffnen, „Scannen“ tippen und diesen QR-Code erfassen – oder unter „Mehr → Gemeinsam nutzen“ den Code eingeben.</p>
      <button class="pill-btn tinted" data-action="share">${icon('share')} Code teilen</button>
    </div>
    <p class="section-foot">Wer den Code kennt, kann mit einem Konto im Haushalt mitlesen und mitarbeiten. Teile ihn nur mit deiner Familie.</p>

    ${accountSection(user)}
    ${leaveButton()}`;
}

// ---------------------------------------------------------------------------
// Actions

async function share(code) {
  const text = `Tritt unserem Fundort-Keller bei – Code: ${formatCode(code)}`;
  if (navigator.share) {
    try {
      return await navigator.share({ title: 'Fundort-Haushalt', text, url: householdLink(code) });
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${householdLink(code)}`);
    toast('Code kopiert', 'checkCircle');
  } catch {
    alertDialog({ title: 'Haushalts-Code', message: formatCode(code) });
  }
}

async function run(task, success) {
  busy = true;
  toast('Verbinde …', 'refresh');
  try {
    await task();
    toast(success);
  } catch (err) {
    alertDialog({ title: 'Das hat nicht geklappt', message: err.message });
  } finally {
    busy = false;
  }
}

// This device takes over the household's data.
async function openHousehold(code, success = 'Haushalt beigetreten') {
  if (state.boxes.length && !(await confirmDialog({
    title: 'Haushalt beitreten?',
    message: `Die ${unitsLabel(state.boxes)} auf diesem Gerät werden durch die Daten des Haushalts ersetzt. Erstelle vorher ein Backup, wenn du sie behalten möchtest.`,
    confirm: 'Beitreten',
  }))) return;
  await run(() => joinHousehold(code), success);
  if (state.meta.household) navigate('/', { replace: true });
}

async function submitAuth(el, invited) {
  const fresh = el.dataset.authMode === 'register';
  form.email = el.email.value.trim();
  form.password = el.password.value;
  form.error = !form.email
    ? 'Bitte gib deine E-Mail-Adresse ein.'
    : !form.password
      ? 'Bitte gib dein Passwort ein.'
      : fresh && form.password.length < 6
        ? 'Das Passwort braucht mindestens 6 Zeichen.'
        : '';
  if (form.error) return refresh();

  form.busy = true;
  refresh();
  try {
    await (fresh ? register : signIn)(form.email, form.password);
    Object.assign(form, { mode: null, password: '', reveal: false });
    toast(fresh ? 'Konto angelegt' : 'Angemeldet');
  } catch (err) {
    form.error = err.message;
    return;
  } finally {
    form.busy = false;
    refresh();
  }

  // Straight into the household: the invitation, or the only one found.
  if (state.meta.household) return;
  const found = myHouseholds() ?? [];
  if (invited) await openHousehold(invited);
  else if (found.length === 1) await openHousehold(found[0].id, `„${found[0].name}“ geladen`);
}

async function forgot() {
  if (!form.email) {
    form.error = 'Gib oben deine E-Mail-Adresse ein – dorthin kommt der Link zum Zurücksetzen.';
    return refresh();
  }
  try {
    await resetPassword(form.email);
    form.error = '';
    refresh();
    alertDialog({
      title: 'E-Mail ist unterwegs',
      message: `Falls es für ${form.email} ein Konto gibt, kommt gleich ein Link, mit dem du ein neues Passwort festlegst. Schau auch im Spam-Ordner nach.`,
    });
  } catch (err) {
    form.error = err.message;
    refresh();
  }
}

async function confirmSignOut() {
  const unsent = ['pending', 'offline'].includes(syncStatus().state);
  const ok = await confirmDialog({
    title: 'Abmelden?',
    message: state.meta.household
      ? `Dieses Gerät gleicht dann nicht mehr ab, die Daten bleiben hier. Sobald du dich wieder anmeldest, geht es weiter.${unsent ? ' Noch nicht alle Änderungen sind hochgeladen – sie folgen nach der nächsten Anmeldung.' : ''}`
      : 'Du kannst dich jederzeit wieder anmelden.',
    confirm: 'Abmelden',
    destructive: true,
  });
  if (!ok) return;
  await signOut();
  toast('Abgemeldet');
}

export const householdView = {
  tab: 'more',
  title: 'Gemeinsam nutzen',
  get syncAware() {
    return !typing(); // re-render when the sync status or the account changes
  },
  get static() {
    return typing();
  },
  render({ code } = {}) {
    const household = state.meta.household;
    const user = syncConfigured() ? account() : null;
    const invited = household ? null : readCode(code);
    let body;
    if (!syncConfigured()) body = notConfigured();
    else if (user === undefined) body = loading();
    else if (!user || (user.anonymous && !household)) body = signedOut(household, invited);
    else body = household ? linked(household, user) : unlinked(invited, user);
    return html`
      ${navBar({ title: 'Gemeinsam nutzen', back: '/mehr' })}
      <main class="page">
        ${largeTitle('Gemeinsam nutzen')}
        ${body}
      </main>`;
  },
  mount(root, { code } = {}) {
    if (syncConfigured()) {
      const user = account();
      if (user === undefined) loadAccount();
      else if (user && !user.anonymous && !state.meta.household && myHouseholds() === null) findHouseholds();
    }
    const invited = state.meta.household ? null : readCode(code);

    const authEl = root.querySelector('[data-form="auth"]');
    if (authEl) {
      authEl.password.value = form.password;
      authEl.addEventListener('input', (e) => {
        if (e.target.name === 'email') form.email = e.target.value.trim();
        if (e.target.name === 'password') form.password = e.target.value;
      });
      authEl.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!form.busy) submitAuth(authEl, invited);
      });
    }

    root.querySelector('[data-form="join"]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const target = readCode(e.target.code.value);
      if (!target) return alertDialog({ title: 'Code unvollständig', message: 'Der Code hat zwölf Zeichen, z. B. KXR4-9TQM-2HWP.' });
      openHousehold(target);
    });

    root.addEventListener('click', async (e) => {
      const mode = e.target.closest('[data-mode]')?.dataset.mode;
      if (mode) {
        Object.assign(form, { mode, error: '' });
        return refresh();
      }
      const open = e.target.closest('[data-open]')?.dataset.open;
      if (open && !busy) {
        const h = myHouseholds()?.find((x) => x.id === open);
        return openHousehold(open, h ? `„${h.name}“ geladen` : undefined);
      }
      const btn = e.target.closest('[data-action]');
      const action = btn?.dataset.action;
      if (action === 'reveal') {
        form.reveal = !form.reveal;
        authEl.password.type = form.reveal ? 'text' : 'password';
        btn.setAttribute('aria-pressed', String(form.reveal));
        btn.setAttribute('aria-label', form.reveal ? 'Passwort verbergen' : 'Passwort anzeigen');
        btn.innerHTML = String(icon(form.reveal ? 'eyeSlash' : 'eye'));
        authEl.password.focus();
      }
      if (action === 'forgot') forgot();
      if (action === 'sign-out') confirmSignOut();
      if (action === 'create' && !busy) {
        const name = await promptDialog({ title: 'Haushalt anlegen', message: 'Wie soll er heißen?', value: 'Unser Keller', confirm: 'Anlegen' });
        if (name == null) return;
        await run(() => createHousehold(name || 'Unser Keller'), 'Haushalt angelegt');
      }
      if (action === 'share') share(state.meta.household.id);
      if (action === 'leave' && (await confirmDialog({
        title: 'Haushalt verlassen?',
        message: 'Dieses Gerät gleicht dann nicht mehr ab. Die Daten bleiben hier erhalten, und du kannst dem Haushalt jederzeit wieder beitreten.',
        confirm: 'Verlassen',
        destructive: true,
      }))) {
        leaveHousehold();
        toast('Haushalt verlassen');
      }
    });
  },
};

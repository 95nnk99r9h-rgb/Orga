// "Gemeinsam nutzen": share the cellar with other devices through a
// household in Firebase (js/sync.js). One device creates it, the others join
// with its code or by scanning its QR code.

import { html, raw, icon, toast, alertDialog, confirmDialog, promptDialog } from '../ui.js';
import { navBar, largeTitle, catAttrs } from '../components.js';
import { state } from '../store.js';
import { unitsLabel } from '../format.js';
import { qrSVG, householdLink } from '../qr.js';
import { syncConfigured, syncStatus, formatCode, readCode, createHousehold, joinHousehold, leaveHousehold } from '../sync.js';
import { navigate } from '../router.js';

const GUIDE = 'https://github.com/95nnk99r9h-rgb/Orga/blob/HEAD/docs/ONLINE.md';

const STATUS = {
  off: ['gray', 'Aus'],
  connecting: ['orange', 'Verbinde …'],
  synced: ['green', 'Alles abgeglichen'],
  pending: ['blue', 'Wird hochgeladen …'],
  offline: ['orange', 'Offline – wird später abgeglichen'],
  error: ['red', 'Fehler beim Abgleich'],
};

export function syncLabel() {
  if (!syncConfigured()) return 'Einrichten';
  if (!state.meta.household) return 'Aus';
  return STATUS[syncStatus().state][1];
}

let busy = false;

const hero = (text) => html`
  <div class="card share-hero">
    <span class="share-icon" ${catAttrs('green')}>${icon('people')}</span>
    <p>${text}</p>
  </div>`;

function notConfigured() {
  return html`
    ${hero('Mit dem Online-Abgleich nutzt ihr Fundort zu zweit oder als ganze Familie: Alle sehen denselben Keller, Änderungen kommen in Sekunden auf allen Handys an.')}
    <h3 class="section-head">Noch nicht eingerichtet</h3>
    <div class="card note-card">Dafür braucht die App ein kostenloses Firebase-Projekt (Google). Das dauert einmalig etwa zehn Minuten – die Schritt-für-Schritt-Anleitung steht im Repository unter <b>docs/ONLINE.md</b>.</div>
    <a class="btn secondary" href="${GUIDE}" target="_blank" rel="noopener">${icon('book')} Anleitung öffnen</a>`;
}

function unlinked(prefill) {
  return html`
    ${hero('Lege einen Haushalt an und teile den Code. Alle Geräte im Haushalt sehen denselben Keller – live, und auch ohne Netz im Keller wird nichts vergessen.')}

    <h3 class="section-head">Erstes Gerät</h3>
    <div class="list">
      <button class="cell" data-action="create" ${busy ? raw('disabled') : ''}>
        <span class="icon-tile" ${catAttrs('green')}>${icon('plus')}</span>
        <span class="cell-text"><span class="cell-title">Haushalt anlegen</span><span class="cell-sub">Die Daten dieses Geräts werden hochgeladen</span></span>
        ${icon('chevron', 'chev')}
      </button>
    </div>

    <h3 class="section-head">Weitere Geräte</h3>
    <form class="list" data-form="join">
      <label class="cell field">
        <span class="field-label">Code</span>
        <input name="code" value="${prefill ? formatCode(prefill) : ''}" placeholder="XXXX-XXXX-XXXX" autocomplete="off"
          autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Haushalts-Code">
      </label>
      <button class="cell tint-text center" type="submit" ${busy ? raw('disabled') : ''}>Haushalt beitreten</button>
    </form>
    <p class="section-foot">Den Code findest du auf dem ersten Gerät unter „Mehr → Gemeinsam nutzen“. Du kannst den QR-Code dort auch mit „Scannen“ erfassen.</p>`;
}

function linked(household) {
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
    </div>
    <p class="section-foot">${unitsLabel(state.boxes)} · Änderungen auf diesem Gerät werden automatisch geteilt.</p>

    <h3 class="section-head">Weiteres Gerät hinzufügen</h3>
    <div class="card code-card">
      <div class="code-qr">${raw(qrSVG(householdLink(household.id)))}</div>
      <div class="code-text">${formatCode(household.id)}</div>
      <p>Auf dem anderen Handy Fundort öffnen, „Scannen“ tippen und diesen QR-Code erfassen – oder unter „Mehr → Gemeinsam nutzen“ den Code eingeben.</p>
      <button class="pill-btn tinted" data-action="share">${icon('share')} Code teilen</button>
    </div>
    <p class="section-foot">Wer den Code kennt, kann im Haushalt mitlesen und mitarbeiten. Teile ihn nur mit deiner Familie.</p>

    <div class="list spaced">
      <button class="cell destructive center" data-action="leave">Haushalt auf diesem Gerät verlassen</button>
    </div>`;
}

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

export const householdView = {
  tab: 'more',
  title: 'Gemeinsam nutzen',
  syncAware: true, // re-render when the sync status changes
  render({ code } = {}) {
    const household = state.meta.household;
    return html`
      ${navBar({ title: 'Gemeinsam nutzen', back: '/mehr' })}
      <main class="page">
        ${largeTitle('Gemeinsam nutzen')}
        ${!syncConfigured() ? notConfigured() : household ? linked(household) : unlinked(readCode(code))}
      </main>`;
  },
  mount(root) {
    root.querySelector('[data-form="join"]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const code = readCode(e.target.code.value);
      if (!code) return alertDialog({ title: 'Code unvollständig', message: 'Der Code hat zwölf Zeichen, z. B. KXR4-9TQM-2HWP.' });
      if (state.boxes.length && !(await confirmDialog({
        title: 'Haushalt beitreten?',
        message: `Die ${unitsLabel(state.boxes)} auf diesem Gerät werden durch die Daten des Haushalts ersetzt. Erstelle vorher ein Backup, wenn du sie behalten möchtest.`,
        confirm: 'Beitreten',
      }))) return;
      await run(() => joinHousehold(code), 'Haushalt beigetreten');
      if (state.meta.household) navigate('/', { replace: true });
    });

    root.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'create' && !busy) {
        const name = await promptDialog({ title: 'Haushalt anlegen', message: 'Wie soll er heißen?', value: 'Unser Keller', confirm: 'Anlegen' });
        if (name == null) return;
        await run(() => createHousehold(name || 'Unser Keller'), 'Haushalt angelegt');
      }
      if (action === 'share') share(state.meta.household.id);
      if (action === 'leave' && (await confirmDialog({
        title: 'Haushalt verlassen?',
        message: 'Dieses Gerät gleicht dann nicht mehr ab. Die Daten bleiben hier erhalten, und du kannst jederzeit mit dem Code wieder beitreten.',
        confirm: 'Verlassen',
        destructive: true,
      }))) {
        leaveHousehold();
        toast('Haushalt verlassen');
      }
    });
  },
};

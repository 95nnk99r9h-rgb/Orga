// "Mehr" tab: shelves, categories, backups and the system guide.

import { html, raw, icon, openSheet, confirmDialog, alertDialog, promptDialog, toast, shareOrDownload, pickFile } from '../ui.js';
import { navBar, largeTitle, catAttrs, stepper } from '../components.js';
import {
  state, COLORS, MAX_LEVELS, ZONE_SUGGESTIONS, addShelf, updateShelf, removeShelf, addZone, updateZone, removeZone,
  addRoom, updateRoom, removeRoom, shelvesIn, zonesIn, multiRoom,
  boxesAt, boxesInZone, saveCategory, removeCategory, categoryById, boxesInCategory, exportData, importData, resetAll,
  loadDemo, setMeta,
} from '../store.js';
import { dateLabel, unitsLabel, plural } from '../format.js';
import { navigate, refresh } from '../router.js';
import { canInstall, install } from '../install.js';
import { THEMES, getTheme, setTheme } from '../theme.js';
import { leaveHousehold, signOut, syncConfigured } from '../sync.js';
import { syncLabel, forgetForm } from './household.js';

const row = ({ iconName, color, title, detail = '', href = null, action = null, cls = '' }) => {
  const inner = html`
    <span class="icon-tile" ${catAttrs(color)}>${icon(iconName)}</span>
    <span class="cell-title grow">${title}</span>
    ${detail ? html`<span class="cell-detail">${detail}</span>` : ''}
    ${href ? icon('chevron', 'chev') : ''}`;
  return href
    ? html`<a class="cell ${cls}" href="${href}">${inner}</a>`
    : html`<button class="cell ${cls}" data-action="${action}">${inner}</button>`;
};

async function doExport() {
  const data = await exportData();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const day = new Date().toISOString().slice(0, 10);
  if (await shareOrDownload(blob, `fundort-backup-${day}.json`)) {
    setMeta({ lastBackup: Date.now() });
    toast('Backup erstellt', 'download');
  }
}

async function doImport() {
  const [file] = await pickFile('application/json,.json');
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return alertDialog({ title: 'Datei nicht lesbar', message: 'Bitte wähle eine Fundort-Backup-Datei (.json).' });
  }
  if (!(await confirmDialog({
    title: 'Backup wiederherstellen?',
    message: `Das Backup enthält ${unitsLabel(data.boxes ?? [])}. ${state.meta.household ? 'Die Daten im Haushalt werden für alle Geräte ersetzt.' : 'Alle aktuellen Daten auf diesem Gerät werden ersetzt.'}`,
    confirm: 'Ersetzen',
    destructive: true,
  }))) return;
  try {
    await importData(data);
    toast('Backup wiederhergestellt');
  } catch (err) {
    alertDialog({ title: 'Import fehlgeschlagen', message: err.message });
  }
}

export const moreView = {
  tab: 'more',
  title: 'Mehr',
  syncAware: true, // shows the sync status
  render() {
    const backup = state.meta.lastBackup ? `Letztes Backup: ${dateLabel(state.meta.lastBackup)}.` : 'Noch kein Backup erstellt.';
    return html`
      ${navBar({ title: 'Mehr' })}
      <main class="page">
        ${largeTitle('Mehr')}
        <h3 class="section-head">Keller</h3>
        <div class="list">
          ${row({ iconName: 'shelves', color: 'blue', title: 'Lagerorte', detail: multiRoom() ? plural(state.rooms.length, 'Raum', 'Räume') : `${state.shelves.length} + ${state.zones.length}`, href: '#/mehr/regale' })}
          ${row({ iconName: 'circles', color: 'orange', title: 'Kategorien', detail: String(state.categories.length), href: '#/mehr/kategorien' })}
          ${row({ iconName: 'people', color: 'green', title: 'Gemeinsam nutzen', detail: syncLabel(), href: '#/mehr/haushalt' })}
        </div>

        ${canInstall()
          ? html`
            <div class="list install-row">
              ${row({ iconName: 'homescreen', color: 'blue', title: 'Als App installieren', action: 'install' })}
            </div>`
          : ''}

        <h3 class="section-head">Darstellung</h3>
        <div class="seg theme-seg" role="group" aria-label="Darstellung">
          ${THEMES.map(([key, label]) => html`<button type="button" data-theme-set="${key}" aria-pressed="${String(getTheme() === key)}">${label}</button>`)}
        </div>
        <p class="section-foot">„Automatisch“ folgt der Einstellung deines iPhones.</p>

        <h3 class="section-head">Anleitung</h3>
        <div class="list">
          ${row({ iconName: 'book', color: 'green', title: 'Das Fundort-System', href: '#/system' })}
          ${!state.boxes.length && !state.meta.household ? row({ iconName: 'sparkles', color: 'purple', title: 'Beispieldaten laden', action: 'demo' }) : ''}
        </div>

        <h3 class="section-head">Daten</h3>
        <div class="list">
          ${row({ iconName: 'share', color: 'blue', title: 'Backup erstellen', action: 'export' })}
          ${row({ iconName: 'download', color: 'teal', title: 'Backup wiederherstellen', action: 'import' })}
        </div>
        <p class="section-foot">${state.meta.household ? 'Die Daten werden mit deinem Haushalt abgeglichen und liegen zusätzlich auf diesem Gerät.' : 'Alle Daten liegen nur auf diesem Gerät.'} ${backup} Sichere das Backup z. B. in iCloud Drive.</p>

        <div class="list spaced">
          <button class="cell destructive center" data-action="reset">Alle Daten löschen</button>
        </div>
        <p class="meta-foot">Fundort 1.0 · Ordnung für Keller, Dachboden &amp; Garage</p>
      </main>`;
  },
  mount(root) {
    root.addEventListener('click', async (e) => {
      const theme = e.target.closest('[data-theme-set]')?.dataset.themeSet;
      if (theme) {
        setTheme(theme);
        return refresh();
      }
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'install') install();
      if (action === 'export') doExport();
      if (action === 'import') doImport();
      if (action === 'demo') {
        await loadDemo();
        toast('Beispielkeller geladen', 'sparkles');
        navigate('/', { replace: true });
      }
      if (action === 'reset' && (await confirmDialog({
        title: 'Alle Daten löschen?',
        message: state.meta.household
          ? 'Dieses Gerät verlässt den Haushalt, meldet sich ab und löscht alles, was hier gespeichert ist. Im Haushalt und auf den anderen Geräten bleibt alles erhalten.'
          : 'Kisten, Einzelstücke, Fotos, Lagerorte und Kategorien werden von diesem Gerät entfernt. Erstelle vorher ein Backup.',
        confirm: 'Alles löschen',
        destructive: true,
      }))) {
        leaveHousehold();
        if (syncConfigured()) await signOut().catch(() => {});
        forgetForm();
        await resetAll();
        navigate('/willkommen', { replace: true });
      }
    });
  },
};

// ---------------------------------------------------------------------------

// With several rooms, shelves and zones can be moved between them.
const roomSelect = (attr, id, current) => html`
  <select class="room-select" ${raw(`${attr}="${id}"`)} aria-label="Raum">
    ${state.rooms.map((r) => html`<option value="${r.id}" ${r.id === current ? raw('selected') : ''}>${r.name}</option>`)}
  </select>`;

function shelfBlock(s, multi) {
  return html`
    <h3 class="section-head">Regal ${s.id} · ${unitsLabel(boxesAt(s.id))}</h3>
    <div class="list">
      <label class="cell field">
        <span class="field-label">Ort</span>
        <input data-note="${s.id}" value="${s.note}" placeholder="z. B. links neben der Tür" enterkeyhint="done">
      </label>
      <div class="cell">
        <span class="cell-title grow">Böden</span>
        ${stepper({ name: s.id, value: s.levels, min: 1, max: MAX_LEVELS })}
      </div>
      ${multi
        ? html`<label class="cell"><span class="cell-title grow">Raum</span>${roomSelect('data-shelf-room', s.id, s.room)}</label>`
        : ''}
      <button class="cell destructive" data-remove="${s.id}">Regal ${s.id} entfernen</button>
    </div>`;
}

function zoneList(zones, room, multi) {
  return html`
    <div class="list">
      ${zones.map(
        (z) => html`
          <div class="cell zone-edit">
            <a class="zone-code sm" href="#/platz/${z.id}" aria-label="Stellplatz ${z.id} ansehen">${z.id}</a>
            <input data-zone="${z.id}" value="${z.name}" placeholder="z. B. unter der Treppe" enterkeyhint="done" aria-label="Name von ${z.id}">
            ${multi ? roomSelect('data-zone-room', z.id, z.room) : ''}
            <span class="cell-detail small">${boxesInZone(z.id).length || ''}</span>
            <button class="icon-btn danger" data-remove-zone="${z.id}" aria-label="Stellplatz ${z.id} entfernen">${icon('trash')}</button>
          </div>`,
      )}
      <button class="cell tint-text" data-add-zone="${room.id}">${icon('plus', 'add-icon')} <span class="cell-title">Stellplatz hinzufügen</span></button>
    </div>`;
}

export const shelfSettingsView = {
  tab: 'more',
  title: 'Lagerorte',
  render() {
    const multi = multiRoom();
    const unused = ZONE_SUGGESTIONS.filter((name) => !state.zones.some((z) => z.name === name));
    return html`
      ${navBar({ title: 'Lagerorte', back: '/mehr' })}
      <main class="page">
        ${largeTitle('Lagerorte')}
        <p class="lead">Regale bekommen Buchstaben – am besten links neben der Tür beginnend, einmal rundherum. Jedes Regal hat so viele Böden, wie es eben hat; gezählt wird von oben nach unten.</p>

        <h3 class="section-head">Räume</h3>
        <div class="list">
          ${state.rooms.map(
            (r) => html`
              <div class="cell room-edit">
                <span class="icon-tile" ${catAttrs('blue')}>${icon('house')}</span>
                <input data-room="${r.id}" value="${r.name}" placeholder="z. B. Dachboden" enterkeyhint="done" aria-label="Name des Raums">
                <span class="cell-detail small">${plural(shelvesIn(r.id).length, 'Regal', 'Regale')}</span>
                ${multi ? html`<button class="icon-btn danger" data-remove-room="${r.id}" aria-label="${r.name} entfernen">${icon('trash')}</button>` : ''}
              </div>`,
          )}
          <button class="cell tint-text" data-action="add-room">${icon('plus', 'add-icon')} <span class="cell-title">Raum hinzufügen</span></button>
        </div>
        <p class="section-foot">Zum Beispiel Keller, Dachboden und Garage – jeder mit eigenen Regalen und Stellplätzen. Buchstaben und Nummern zählen über alle Räume weiter, so bleibt jede Adresse eindeutig.</p>

        ${state.rooms.map((room) => {
          const shelves = shelvesIn(room.id);
          return html`
            <h2 class="title2">${multi ? room.name : 'Regale'}</h2>
            ${shelves.map((s) => shelfBlock(s, multi))}
            <button class="btn secondary" data-add-shelf="${room.id}">${icon('plus')} Regal hinzufügen</button>

            ${multi ? html`<h3 class="section-head">Stellplätze</h3>` : html`
              <h2 class="title2">Stellplätze</h2>
              <p class="lead">Für alles, was nicht im Regal steht: Großes auf dem Boden, Wandhaken, Ecken. Sie heißen S1, S2 …</p>`}
            ${zoneList(zonesIn(room.id), room, multi)}`;
        })}
        ${!multi && unused.length
          ? html`
            <p class="section-foot">Vorschläge</p>
            <div class="chips suggestions">
              ${unused.map((name) => html`<button type="button" class="chip add" data-suggest="${name}">${icon('plus')}${name}</button>`)}
            </div>`
          : ''}
      </main>`;
  },
  mount(root) {
    root.addEventListener('change', (e) => {
      const { note, zone, room, shelfRoom, zoneRoom } = e.target.dataset;
      if (note) updateShelf(note, { note: e.target.value.trim() });
      if (zone) updateZone(zone, { name: e.target.value.trim() });
      if (room && e.target.value.trim()) updateRoom(room, { name: e.target.value.trim() });
      if (shelfRoom) updateShelf(shelfRoom, { room: e.target.value });
      if (zoneRoom) updateZone(zoneRoom, { room: e.target.value });
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.target.dataset.note || e.target.dataset.zone || e.target.dataset.room)) e.target.blur();
    });
    root.addEventListener('click', async (e) => {
      const step = e.target.closest('[data-step]');
      if (step) {
        const id = step.closest('[data-stepper]').dataset.stepper;
        const shelf = state.shelves.find((s) => s.id === id);
        try {
          updateShelf(id, { levels: shelf.levels + Number(step.dataset.step) });
        } catch (err) {
          alertDialog({ title: 'Geht gerade nicht', message: err.message });
        }
        return;
      }
      const remove = e.target.closest('[data-remove]')?.dataset.remove;
      if (remove) {
        const n = boxesAt(remove).length;
        if (await confirmDialog({
          title: `Regal ${remove} entfernen?`,
          message: n ? `${unitsLabel(boxesAt(remove))} verlieren ihren Platz und landen unter „Ohne Platz“.` : '',
          confirm: 'Entfernen',
          destructive: true,
        })) removeShelf(remove);
        return;
      }
      const removeZ = e.target.closest('[data-remove-zone]')?.dataset.removeZone;
      if (removeZ) {
        const here = boxesInZone(removeZ);
        if (await confirmDialog({
          title: `Stellplatz ${removeZ} entfernen?`,
          message: here.length ? `${unitsLabel(here)} verlieren ihren Platz und landen unter „Ohne Platz“.` : '',
          confirm: 'Entfernen',
          destructive: true,
        })) removeZone(removeZ);
        return;
      }
      const removeR = e.target.closest('[data-remove-room]')?.dataset.removeRoom;
      if (removeR) {
        const room = state.rooms.find((r) => r.id === removeR);
        try {
          if (shelvesIn(removeR).length || zonesIn(removeR).length) return removeRoom(removeR); // explains why not
          if (await confirmDialog({ title: `„${room.name}“ entfernen?`, confirm: 'Entfernen', destructive: true })) removeRoom(removeR);
        } catch (err) {
          alertDialog({ title: 'Geht gerade nicht', message: err.message });
        }
        return;
      }
      const suggest = e.target.closest('[data-suggest]')?.dataset.suggest;
      if (suggest) {
        const zone = addZone(suggest);
        return toast(`${zone.id} · ${zone.name} angelegt`);
      }
      const addZoneTo = e.target.closest('[data-add-zone]')?.dataset.addZone;
      if (addZoneTo) {
        const zone = addZone('', addZoneTo);
        // The page re-rendered on change, so look the new field up afresh.
        document.querySelector(`[data-zone="${zone.id}"]`)?.focus();
        return;
      }
      const addShelfTo = e.target.closest('[data-add-shelf]')?.dataset.addShelf;
      if (addShelfTo) {
        const shelf = addShelf(shelvesIn(addShelfTo).at(-1)?.levels ?? state.shelves.at(-1)?.levels ?? 4, addShelfTo);
        return toast(`Regal ${shelf.id} hinzugefügt`);
      }
      if (e.target.closest('[data-action="add-room"]')) {
        const name = await promptDialog({ title: 'Neuer Raum', message: 'Zum Beispiel Dachboden oder Garage.', placeholder: 'Name', confirm: 'Hinzufügen' });
        if (!name?.trim()) return;
        const room = addRoom(name);
        toast(`${room.name} hinzugefügt`);
      }
    });
  },
};

// ---------------------------------------------------------------------------

function openCategoryEditor(cat = null) {
  let color = cat?.color ?? COLORS.find((c) => !state.categories.some((x) => x.color === c)) ?? 'blue';
  openSheet({
    title: cat ? 'Kategorie bearbeiten' : 'Neue Kategorie',
    doneLabel: 'Sichern',
    body: html`
      <div class="list">
        <label class="cell field">
          <span class="field-label">Name</span>
          <input name="name" value="${cat?.name ?? ''}" placeholder="z. B. Garten" enterkeyhint="done">
        </label>
      </div>
      <h3 class="section-head">Farbe</h3>
      <div class="card pad palette">
        ${COLORS.map((c) => html`<button type="button" class="swatch" data-color="${c}" ${catAttrs(c)} aria-pressed="${String(c === color)}" aria-label="${c}"></button>`)}
      </div>
      ${cat
        ? html`<div class="list spaced"><button type="button" class="cell destructive center" data-delete>Kategorie löschen</button></div>`
        : ''}`,
    onMount(el, close) {
      el.addEventListener('click', async (e) => {
        const sw = e.target.closest('[data-color]');
        if (sw) {
          color = sw.dataset.color;
          el.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b === sw)));
        }
        if (e.target.closest('[data-delete]')) {
          const tagged = boxesInCategory(cat.id);
          if (await confirmDialog({
            title: `„${cat.name}“ löschen?`,
            message: tagged.length ? `${unitsLabel(tagged)} behalten ihren Inhalt, aber keine Kategorie.` : '',
            confirm: 'Löschen',
            destructive: true,
          })) {
            removeCategory(cat.id);
            close();
          }
        }
      });
    },
    done(el) {
      saveCategory({ id: cat?.id, name: el.querySelector('[name="name"]').value, color });
    },
  });
}

export const categorySettingsView = {
  tab: 'more',
  title: 'Kategorien',
  render() {
    return html`
      ${navBar({ title: 'Kategorien', back: '/mehr', right: html`<button class="circle-btn glass" data-action="add" aria-label="Neue Kategorie">${icon('plus')}</button>` })}
      <main class="page">
        ${largeTitle('Kategorien')}
        <p class="lead">Jede Kategorie hat eine Farbe. Sie erscheint auf dem Etikett und in der App – so erkennst du Weihnachtskisten schon von Weitem.</p>
        <div class="list">
          ${state.categories.map(
            (c) => html`
              <button class="cell" data-edit="${c.id}">
                <span class="cat-icon" ${catAttrs(c.color)}>${icon('tag')}</span>
                <span class="cell-title grow">${c.name}</span>
                <span class="cell-detail">${boxesInCategory(c.id).length}</span>${icon('chevron', 'chev')}
              </button>`,
          )}
          <button class="cell tint-text" data-action="add">${icon('plus', 'add-icon')} <span class="cell-title">Neue Kategorie</span></button>
        </div>
      </main>`;
  },
  mount(root) {
    root.addEventListener('click', (e) => {
      const edit = e.target.closest('[data-edit]');
      if (edit) openCategoryEditor(categoryById(edit.dataset.edit));
      if (e.target.closest('[data-action="add"]')) openCategoryEditor();
    });
  },
};


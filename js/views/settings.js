// "Mehr" tab: shelves, categories, backups and the system guide.

import { html, icon, openSheet, confirmDialog, alertDialog, toast, shareOrDownload, pickFile } from '../ui.js';
import { navBar, largeTitle, catAttrs, stepper } from '../components.js';
import {
  state, COLORS, MAX_LEVELS, ZONE_SUGGESTIONS, addShelf, updateShelf, removeShelf, addZone, updateZone, removeZone,
  boxesAt, boxesInZone, saveCategory, removeCategory, categoryById, boxesInCategory, exportData, importData, resetAll,
  loadDemo, setMeta,
} from '../store.js';
import { dateLabel, unitsLabel } from '../format.js';
import { navigate } from '../router.js';

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
    message: `Das Backup enthält ${unitsLabel(data.boxes ?? [])}. Alle aktuellen Daten auf diesem Gerät werden ersetzt.`,
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
  render() {
    const backup = state.meta.lastBackup ? `Letztes Backup: ${dateLabel(state.meta.lastBackup)}.` : 'Noch kein Backup erstellt.';
    return html`
      ${navBar({ title: 'Mehr' })}
      <main class="page">
        ${largeTitle('Mehr')}
        <h3 class="section-head">Keller</h3>
        <div class="list">
          ${row({ iconName: 'shelves', color: 'blue', title: 'Lagerorte', detail: `${state.shelves.length} + ${state.zones.length}`, href: '#/mehr/regale' })}
          ${row({ iconName: 'circles', color: 'orange', title: 'Kategorien', detail: String(state.categories.length), href: '#/mehr/kategorien' })}
        </div>

        <h3 class="section-head">Anleitung</h3>
        <div class="list">
          ${row({ iconName: 'book', color: 'green', title: 'Das Fundort-System', href: '#/system' })}
          ${!state.boxes.length ? row({ iconName: 'sparkles', color: 'purple', title: 'Beispieldaten laden', action: 'demo' }) : ''}
        </div>

        <h3 class="section-head">Daten</h3>
        <div class="list">
          ${row({ iconName: 'share', color: 'blue', title: 'Backup erstellen', action: 'export' })}
          ${row({ iconName: 'download', color: 'teal', title: 'Backup wiederherstellen', action: 'import' })}
        </div>
        <p class="section-foot">Alle Daten bleiben auf diesem Gerät. ${backup} Sichere das Backup z. B. in iCloud Drive, um es auf ein anderes Gerät zu übertragen.</p>

        <div class="list spaced">
          <button class="cell destructive center" data-action="reset">Alle Daten löschen</button>
        </div>
        <p class="meta-foot">Fundort 1.0 · Ordnung für Keller, Dachboden &amp; Garage</p>
      </main>`;
  },
  mount(root) {
    root.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'export') doExport();
      if (action === 'import') doImport();
      if (action === 'demo') {
        await loadDemo();
        toast('Beispielkeller geladen', 'sparkles');
        navigate('/', { replace: true });
      }
      if (action === 'reset' && (await confirmDialog({
        title: 'Alle Daten löschen?',
        message: 'Kisten, Einzelstücke, Fotos, Lagerorte und Kategorien werden von diesem Gerät entfernt. Erstelle vorher ein Backup.',
        confirm: 'Alles löschen',
        destructive: true,
      }))) {
        await resetAll();
        navigate('/willkommen', { replace: true });
      }
    });
  },
};

// ---------------------------------------------------------------------------

export const shelfSettingsView = {
  tab: 'more',
  title: 'Lagerorte',
  render() {
    const unused = ZONE_SUGGESTIONS.filter((name) => !state.zones.some((z) => z.name === name));
    return html`
      ${navBar({ title: 'Lagerorte', back: '/mehr' })}
      <main class="page">
        ${largeTitle('Lagerorte')}
        <p class="lead">Regale bekommen Buchstaben – am besten links neben der Tür beginnend, einmal rundherum. Jedes Regal hat so viele Böden, wie es eben hat; gezählt wird von oben nach unten.</p>
        ${state.shelves.map(
          (s) => html`
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
              <button class="cell destructive" data-remove="${s.id}">Regal ${s.id} entfernen</button>
            </div>`,
        )}
        <button class="btn secondary" data-action="add">${icon('plus')} Regal hinzufügen</button>

        <h2 class="title2">Stellplätze</h2>
        <p class="lead">Für alles, was nicht im Regal steht: Großes auf dem Boden, Wandhaken, Ecken – oder Orte außerhalb des Kellers wie Garage und Dachboden. Sie heißen S1, S2 …</p>
        <div class="list">
          ${state.zones.map(
            (z) => html`
              <div class="cell zone-edit">
                <a class="zone-code sm" href="#/platz/${z.id}" aria-label="Stellplatz ${z.id} ansehen">${z.id}</a>
                <input data-zone="${z.id}" value="${z.name}" placeholder="z. B. unter der Treppe" enterkeyhint="done" aria-label="Name von ${z.id}">
                <span class="cell-detail small">${boxesInZone(z.id).length || ''}</span>
                <button class="icon-btn danger" data-remove-zone="${z.id}" aria-label="Stellplatz ${z.id} entfernen">${icon('trash')}</button>
              </div>`,
          )}
          <button class="cell tint-text" data-action="add-zone">${icon('plus', 'add-icon')} <span class="cell-title">Stellplatz hinzufügen</span></button>
        </div>
        ${unused.length
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
      const { note, zone } = e.target.dataset;
      if (note) updateShelf(note, { note: e.target.value.trim() });
      if (zone) updateZone(zone, { name: e.target.value.trim() });
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.target.dataset.note || e.target.dataset.zone)) e.target.blur();
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
      const suggest = e.target.closest('[data-suggest]')?.dataset.suggest;
      if (suggest) {
        const zone = addZone(suggest);
        return toast(`${zone.id} · ${zone.name} angelegt`);
      }
      if (e.target.closest('[data-action="add-zone"]')) {
        const zone = addZone();
        // The page re-rendered on change, so look the new field up afresh.
        document.querySelector(`[data-zone="${zone.id}"]`)?.focus();
        return;
      }
      if (e.target.closest('[data-action="add"]')) {
        const shelf = addShelf(state.shelves.at(-1)?.levels ?? 4);
        toast(`Regal ${shelf.id} hinzugefügt`);
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


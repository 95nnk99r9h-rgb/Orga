// Start page: search across all boxes, smart filters and recent boxes.

import { html, icon } from '../ui.js';
import { navBar, largeTitle, newBoxButton, boxRow, emptyState, highlight, catAttrs, itemsPreview } from '../components.js';
import { state, search, sortedBoxes, unplacedBoxes, awayBoxes, boxesInCategory, recentBoxes, categoryById, itemCount } from '../store.js';
import { normalize, plural, locShort } from '../format.js';
import { navigate } from '../router.js';
import { presetLabels } from './labels.js';

let query = '';
let filter = null; // 'all' | 'none' | 'away' | 'cat:<id>' | 'cat:'

const FILTERS = {
  all: { label: 'Alle Kisten', icon: 'box', color: 'blue', boxes: sortedBoxes },
  none: { label: 'Ohne Platz', icon: 'tray', color: 'orange', boxes: unplacedBoxes },
  away: { label: 'Entnommen', icon: 'house', color: 'gray', boxes: awayBoxes },
};

function filterInfo(f) {
  if (FILTERS[f]) return FILTERS[f];
  const id = f.slice(4) || null;
  const cat = categoryById(id);
  return { label: cat?.name ?? 'Ohne Kategorie', color: cat?.color ?? 'gray', boxes: () => boxesInCategory(id) };
}

function searchResults() {
  const results = search(query);
  if (!results.length) {
    return emptyState({
      iconName: 'search',
      title: `Keine Treffer für „${query.trim()}“`,
      text: 'Versuche einen Wortteil, z. B. „licht“ statt „Lichterketten“.',
    });
  }
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return html`
    <h3 class="section-head">${plural(results.length, 'Kiste', 'Kisten')}</h3>
    <div class="list">
      ${results.map(({ box, matchedItems }) => {
        // Show matching items first so "where is X" is answered in the list.
        const rest = box.items.filter((it) => !matchedItems.includes(it));
        const shown = [...matchedItems, ...rest].slice(0, 4);
        const more = box.items.length - shown.length;
        const sub = html`<b class="loc-tag">${locShort(box.location)}</b> ${
          box.items.length
            ? html`${shown.map((it, i) => html`${i ? ', ' : ''}${matchedItems.includes(it) ? highlight(it, terms) : it}`)}${more > 0 ? ` +${more}` : ''}`
            : itemsPreview(box.items)
        }`;
        return boxRow(box, { sub });
      })}
    </div>`;
}

function filtered() {
  const info = filterInfo(filter);
  const boxes = info.boxes();
  return html`
    <div class="filter-bar">
      <button class="filter-pill" data-action="clear-filter" ${catAttrs(info.color)}>
        <span class="dot"></span>${info.label}${icon('xmark')}
      </button>
      <span class="filter-count">${plural(boxes.length, 'Kiste', 'Kisten')}</span>
    </div>
    ${boxes.length ? html`<div class="list">${boxes.map((b) => boxRow(b))}</div>` : emptyState({ iconName: 'checkCircle', title: 'Nichts zu sehen', text: 'In dieser Auswahl gibt es gerade keine Kisten.' })}`;
}

function setupChecklist() {
  const { printedShelves, printedUpTo } = state.meta;
  const step = (done, n, title, text, action) => html`
    <button class="cell step ${done ? 'done' : ''}" data-action="${action}">
      <span class="step-num">${done ? icon('check') : n}</span>
      <span class="cell-text"><span class="cell-title">${title}</span><span class="cell-sub">${text}</span></span>
      ${icon('chevron', 'chev')}
    </button>`;
  return html`
    <div class="card intro-card">
      <h2>Los geht’s</h2>
      <p>In drei Schritten vom Kistenchaos zum Keller, in dem du alles findest.</p>
    </div>
    <div class="list">
      ${step(printedShelves, 1, 'Regale beschriften', 'Für jeden Boden ein Etikett drucken', 'labels-shelves')}
      ${step(printedUpTo > 0, 2, 'Kisten-Etiketten drucken', 'Nummern vorab drucken, z. B. 001–008', 'labels-boxes')}
      ${step(false, 3, 'Erste Kiste erfassen', 'Etikett drauf, Foto, Stichworte, Platz', 'new-box')}
    </div>
    <a class="btn secondary spaced" href="#/system">${icon('book')} So funktioniert das System</a>`;
}

function dashboard() {
  if (!state.boxes.length) return setupChecklist();
  const cats = [...state.categories.map((c) => c.id), null]
    .map((id) => ({ id, n: boxesInCategory(id).length }))
    .filter((c) => c.n);
  const backupDue =
    state.boxes.length >= 5 && (!state.meta.lastBackup || Date.now() - state.meta.lastBackup > 30 * 86400000);
  return html`
    <div class="tiles">
      ${Object.entries(FILTERS).map(
        ([key, f]) => html`
          <button class="tile" data-filter="${key}" ${catAttrs(f.color)}>
            <span class="tile-icon">${icon(f.icon)}</span>
            <span class="tile-count">${f.boxes().length}</span>
            <span class="tile-label">${f.label}</span>
          </button>`,
      )}
    </div>
    <p class="stat-line">${plural(itemCount(), 'Gegenstand', 'Gegenstände')} in ${plural(state.boxes.length, 'Kiste', 'Kisten')} erfasst</p>

    ${backupDue
      ? html`
        <a class="card notice" href="#/mehr">
          <span class="icon-tile" ${catAttrs('orange')}>${icon('warning')}</span>
          <span class="cell-text">
            <span class="cell-title">Zeit für ein Backup</span>
            <span class="cell-sub">Deine Daten liegen nur auf diesem Gerät.</span>
          </span>
          ${icon('chevron', 'chev')}
        </a>`
      : ''}

    <h3 class="section-head">Kategorien</h3>
    <div class="list">
      ${cats.map(({ id, n }) => {
        const cat = categoryById(id);
        return html`
          <button class="cell" data-filter="cat:${id ?? ''}">
            <span class="cat-icon" ${catAttrs(cat?.color ?? 'gray')}>${icon('tag')}</span>
            <span class="cell-title grow">${cat?.name ?? 'Ohne Kategorie'}</span>
            <span class="cell-detail">${n}</span>${icon('chevron', 'chev')}
          </button>`;
      })}
    </div>

    <h3 class="section-head">Zuletzt geändert</h3>
    <div class="list">${recentBoxes(5).map((b) => boxRow(b))}</div>`;
}

const results = () => (query.trim() ? searchResults() : filter ? filtered() : dashboard());

export default {
  tab: 'home',
  title: 'Suchen',
  render() {
    return html`
      ${navBar({ title: 'Suchen', right: newBoxButton() })}
      <main class="page">
        ${largeTitle('Suchen')}
        <form class="search" role="search" data-form="search">
          ${icon('search')}
          <input type="search" name="q" value="${query}" placeholder="Gegenstand, Kiste oder Platz" aria-label="Suchen"
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
          <button type="button" class="search-clear" data-action="clear-search" aria-label="Suche löschen" ${query ? '' : 'hidden'}>${icon('xmark')}</button>
        </form>
        <div id="results">${results()}</div>
      </main>`;
  },
  mount(root) {
    const input = root.querySelector('input[name="q"]');
    const clear = root.querySelector('.search-clear');
    const out = root.querySelector('#results');
    const update = () => {
      out.innerHTML = String(results());
      clear.hidden = !query;
    };
    input.addEventListener('input', () => {
      query = input.value;
      update();
    });
    root.querySelector('[data-form="search"]').addEventListener('submit', (e) => {
      e.preventDefault();
      input.blur();
    });
    root.addEventListener('click', (e) => {
      const step = e.target.closest('[data-action^="labels-"]');
      if (step) {
        presetLabels(step.dataset.action === 'labels-shelves' ? { mode: 'shelves' } : { mode: 'boxes', source: 'new' });
        return navigate('/etiketten');
      }
      const t = e.target.closest('[data-filter], [data-action="clear-filter"], [data-action="clear-search"]');
      if (!t) return;
      if (t.dataset.filter) filter = t.dataset.filter;
      else if (t.dataset.action === 'clear-filter') filter = null;
      else {
        query = '';
        input.value = '';
        input.focus();
      }
      update();
      if (t.dataset.filter) window.scrollTo({ top: 0 });
    });
  },
};

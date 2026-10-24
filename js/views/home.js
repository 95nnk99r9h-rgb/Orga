// Start page: the storage overview ("Lager") with search on top. Typing
// replaces the overview with results; an active but empty search field shows
// recently changed entries and a cancel button, like search on iOS.

import { html, icon } from '../ui.js';
import { navBar, largeTitle, newBoxButton, boxRow, emptyState, highlight, catAttrs, hydratePhotos } from '../components.js';
import {
  state, search, boxesOfKind, unplacedBoxes, awayBoxes, boxesInCategory, recentBoxes, categoryById, itemCount,
} from '../store.js';
import { normalize, plural, boxTitle, unitsLabel } from '../format.js';
import { shelfCard, zoneCard, bindRows } from './shelves.js';
import { installCard, showInstallHint, install, dismissInstallHint } from '../install.js';

let query = '';
let filter = null; // a FILTERS key, or 'cat:<id>' ('cat:' = without category)
let searching = false; // search field active: recents instead of the overview

const FILTERS = {
  box: { label: 'Kisten', icon: 'box', color: 'blue', boxes: () => boxesOfKind('box') },
  item: { label: 'Einzelstücke', icon: 'item', color: 'indigo', boxes: () => boxesOfKind('item') },
  none: { label: 'Ohne Platz', icon: 'tray', color: 'orange', boxes: unplacedBoxes },
  away: { label: 'Entnommen', icon: 'house', color: 'gray', boxes: awayBoxes },
};

function filterInfo(f) {
  if (FILTERS[f]) return FILTERS[f];
  const id = f.slice(4) || null;
  const cat = categoryById(id);
  return { label: cat?.name ?? 'Ohne Kategorie', color: cat?.color ?? 'gray', boxes: () => boxesInCategory(id) };
}

// ---------------------------------------------------------------------------
// Overview

function filterChips() {
  const kinds = Object.entries(FILTERS)
    .map(([key, f]) => ({ key, n: f.boxes().length, label: f.label, color: f.color, mark: icon(f.icon) }))
    .filter((c) => c.n);
  const cats = [...state.categories.map((c) => c.id), null]
    .map((id) => {
      const cat = categoryById(id);
      return { key: `cat:${id ?? ''}`, n: boxesInCategory(id).length, label: cat?.name ?? 'Ohne Kategorie', color: cat?.color ?? 'gray', mark: html`<span class="dot"></span>` };
    })
    .filter((c) => c.n);
  const chip = (c) => html`<button class="fchip" data-filter="${c.key}" ${catAttrs(c.color)}>${c.mark}${c.label}<b>${c.n}</b></button>`;
  return html`
    <div class="filter-chips" aria-label="Filter">
      ${kinds.map(chip)}${kinds.length && cats.length ? html`<span class="fchip-sep"></span>` : ''}${cats.map(chip)}
    </div>`;
}

function overview() {
  const unplaced = unplacedBoxes();
  const away = awayBoxes();
  const backupDue =
    state.boxes.length >= 5 && (!state.meta.lastBackup || Date.now() - state.meta.lastBackup > 30 * 86400000);
  return html`
    ${showInstallHint() ? installCard() : ''}
    ${state.boxes.length ? filterChips() : ''}
    ${backupDue
      ? html`
        <a class="card notice spaced-bottom" href="#/mehr">
          <span class="icon-tile" ${catAttrs('orange')}>${icon('warning')}</span>
          <span class="cell-text">
            <span class="cell-title">Zeit für ein Backup</span>
            <span class="cell-sub">Deine Daten liegen nur auf diesem Gerät.</span>
          </span>
          ${icon('chevron', 'chev')}
        </a>`
      : ''}
    ${state.shelves.length
      ? state.shelves.map(shelfCard)
      : emptyState({
          iconName: 'shelves',
          title: 'Noch keine Regale',
          text: 'Lege fest, welche Regale und Stellplätze dein Keller hat.',
          action: html`<a class="btn" href="#/mehr/regale">Lagerorte einrichten</a>`,
        })}
    ${zoneCard()}
    ${unplaced.length ? html`<h3 class="section-head">Ohne festen Platz</h3><div class="list">${unplaced.map((b) => boxRow(b))}</div>` : ''}
    ${away.length ? html`<h3 class="section-head">Nicht im Keller</h3><div class="list">${away.map((b) => boxRow(b))}</div>` : ''}
    <a class="btn secondary spaced" href="#/mehr/regale">${icon('pencil')} Regale &amp; Stellplätze bearbeiten</a>
    ${state.boxes.length ? html`<p class="stat-line">${unitsLabel(state.boxes)} · ${plural(itemCount(), 'Gegenstand', 'Gegenstände')}</p>` : ''}`;
}

// ---------------------------------------------------------------------------
// Search and filters

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
    <h3 class="section-head">${unitsLabel(results.map((r) => r.box))}</h3>
    <div class="list">
      ${results.map(({ box, matchedItems }) => {
        if (box.kind === 'item' || !box.items.length) return boxRow(box, { title: highlight(boxTitle(box), terms) });
        // Matching contents first, so "where is X" is answered in the list.
        const rest = box.items.filter((it) => !matchedItems.includes(it));
        const title = [...matchedItems, ...rest].map((it, i) => html`${i ? ', ' : ''}${matchedItems.includes(it) ? highlight(it, terms) : it}`);
        return boxRow(box, { title });
      })}
    </div>`;
}

function recents() {
  if (!state.boxes.length) {
    return emptyState({ iconName: 'search', title: 'Noch nichts erfasst', text: 'Sobald etwas erfasst ist, findest du es hier per Stichwort.' });
  }
  return html`
    <h3 class="section-head">Zuletzt geändert</h3>
    <div class="list">${recentBoxes(6).map((b) => boxRow(b))}</div>
    <p class="section-foot">Suche nach Gegenständen, Titeln, Nummern („42“), Plätzen („B3“, „Treppe“) oder Kategorien.</p>`;
}

function filtered() {
  const info = filterInfo(filter);
  const boxes = info.boxes();
  return html`
    <div class="filter-bar">
      <button class="filter-pill" data-action="clear-filter" ${catAttrs(info.color)}>
        <span class="dot"></span>${info.label}${icon('xmark')}
      </button>
      <span class="filter-count">${unitsLabel(boxes)}</span>
    </div>
    ${boxes.length ? html`<div class="list">${boxes.map((b) => boxRow(b))}</div>` : emptyState({ iconName: 'checkCircle', title: 'Nichts zu sehen', text: 'In dieser Auswahl gibt es gerade nichts.' })}`;
}

const content = () => (query.trim() ? searchResults() : searching ? recents() : filter ? filtered() : overview());

export default {
  tab: 'home',
  title: 'Lager',
  render() {
    return html`
      ${navBar({ title: 'Lager', right: newBoxButton() })}
      <main class="page">
        ${largeTitle('Lager', `${plural(state.shelves.length, 'Regal', 'Regale')} · ${plural(state.zones.length, 'Stellplatz', 'Stellplätze')}`)}
        <div class="search-row ${searching ? 'active' : ''}">
          <form class="search" role="search" data-form="search">
            ${icon('search')}
            <input type="search" name="q" value="${query}" placeholder="Suchen" aria-label="Suchen"
              autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
            <button type="button" class="search-clear" data-action="clear-search" aria-label="Suche löschen" ${query ? '' : 'hidden'}>${icon('xmark')}</button>
          </form>
          <button type="button" class="search-cancel" data-action="cancel-search">Abbrechen</button>
        </div>
        <div id="results">${content()}</div>
      </main>`;
  },
  mount(root) {
    const input = root.querySelector('input[name="q"]');
    const clear = root.querySelector('.search-clear');
    const row = root.querySelector('.search-row');
    const out = root.querySelector('#results');
    const update = () => {
      out.innerHTML = String(content());
      clear.hidden = !query;
      row.classList.toggle('active', searching);
      hydratePhotos(out);
    };

    input.addEventListener('focus', () => {
      if (searching) return;
      searching = true;
      update();
    });
    input.addEventListener('input', () => {
      query = input.value;
      update();
    });
    root.querySelector('[data-form="search"]').addEventListener('submit', (e) => {
      e.preventDefault();
      input.blur();
    });

    root.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'install') return install();
      if (action === 'dismiss-install') {
        dismissInstallHint();
        return update();
      }
      if (action === 'cancel-search') {
        query = '';
        searching = false;
        input.value = '';
        input.blur();
        return update();
      }
      if (action === 'clear-search') {
        query = '';
        input.value = '';
        input.focus();
        return update();
      }
      if (action === 'clear-filter') {
        filter = null;
        return update();
      }
      const chip = e.target.closest('[data-filter]');
      if (chip) {
        filter = chip.dataset.filter;
        update();
        window.scrollTo({ top: 0 });
      }
    });
    bindRows(root);
  },
};

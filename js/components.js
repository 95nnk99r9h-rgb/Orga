// Reusable building blocks for views.

import { html, raw, icon, esc } from './ui.js';
import { state, categoryById, countAt, photoURL, photoURLCached, shelvesIn, zonesIn, multiRoom } from './store.js';
import { pad, boxTitle, kindOf, locKey, locShort, sinceLabel } from './format.js';

export function navBar({ title = '', back = null, left = '', right = '' } = {}) {
  return html`
    <header class="nav" data-nav>
      <div class="nav-inner">
        <div class="nav-side">
          ${back ? html`<button class="circle-btn glass" data-action="back" data-fallback="${back}" aria-label="Zurück">${icon('chevronLeft')}</button>` : left}
        </div>
        <div class="nav-title">${title}</div>
        <div class="nav-side end">${right}</div>
      </div>
    </header>`;
}

export const largeTitle = (title, sub = '') =>
  html`<div class="large-title"><h1 data-title-anchor>${title}</h1>${sub ? html`<p>${sub}</p>` : ''}</div>`;

export const newBoxButton = () =>
  html`<button class="circle-btn glass" data-action="new-box" aria-label="Neu erfassen">${icon('plus')}</button>`;

export const colorOf = (box) => categoryById(box.category)?.color ?? 'gray';
export const catAttrs = (color) => raw(`style="--cat: var(--c-${esc(color ?? 'gray')})" data-c="${esc(color ?? 'gray')}"`);

// Boxes are rounded squares, loose items are circles.
export const badge = (box, cls = '') =>
  html`<span class="badge ${box.kind === 'item' ? 'item' : ''} ${cls}" ${catAttrs(colorOf(box))}>${pad(box.number)}</span>`;

export const boxChip = (box) =>
  html`<a class="box-chip ${box.kind === 'item' ? 'item' : ''}" href="#/kiste/${box.number}" data-id="${box.id}" draggable="false" ${catAttrs(colorOf(box))} title="${boxTitle(box)}">${pad(box.number)}</a>`;

// Square showing where something is: "B3" for a shelf level, "S1" for a zone.
export function placeCode(loc, cls = '') {
  if (loc?.zone) return html`<span class="loc-code zone ${cls}">${loc.zone}</span>`;
  if (loc && !loc.away) return html`<span class="loc-code ${cls}">${loc.shelf}${loc.level}</span>`;
  return html`<span class="loc-code muted ${cls}">${icon(loc ? 'house' : 'tray')}</span>`;
}

export function photoImg(id, size = 'thumb', cls = '') {
  const src = photoURLCached(id, size);
  return html`<img class="${cls}" data-photo="${id}" data-size="${size}" ${src ? raw(`src="${esc(src)}"`) : ''} alt="" decoding="async">`;
}

export async function hydratePhotos(root) {
  for (const img of root.querySelectorAll('img[data-photo]:not([src])')) {
    const url = await photoURL(img.dataset.photo, img.dataset.size);
    if (url) img.src = url;
  }
}

// Highlights query hits inside already-plain text.
export function highlight(text, terms) {
  if (!terms.length) return html`${text}`;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return raw(String(text).split(re).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join(''));
}

// One list row: what it is (a box's contents, an item's title), below where
// it stands (for taken-out entries since when) and its category. On a place's
// own page the place is left out.
export function boxRow(box, { title = null, showLoc = true, href = `#/kiste/${box.number}`, trailing = null } = {}) {
  const kind = categoryById(box.category)?.name ?? kindOf(box).name;
  const since = box.location?.away && box.awaySince ? ` ${sinceLabel(box.awaySince)}` : '';
  return html`
    <a class="cell box-row" href="${href}">
      ${badge(box)}
      <span class="cell-text">
        <span class="cell-title">${title ?? boxTitle(box)}</span>
        <span class="cell-sub">${showLoc ? html`<b class="loc-tag">${locShort(box.location)}${since}</b> ` : ''}${kind}</span>
      </span>
      ${box.photos[0] ? photoImg(box.photos[0], 'thumb', 'row-thumb') : ''}
      ${trailing ?? icon('chevron', 'chev')}
    </a>`;
}

export function emptyState({ iconName = 'box', title, text = '', action = '' }) {
  return html`
    <div class="empty">
      <span class="empty-icon">${icon(iconName)}</span>
      <h2>${title}</h2>
      ${text ? html`<p>${text}</p>` : ''}
      ${action}
    </div>`;
}

// Tiny side view of a shelf, with the active level highlighted (1 = top).
export function shelfDiagram(levels, active = null) {
  return html`<span class="shelf-diagram" aria-hidden="true">${Array.from(
    { length: levels },
    (_, i) => html`<i class="${i + 1 === active ? 'on' : ''}"></i>`,
  )}</span>`;
}

// Place picker: a grid of shelves (columns) × levels (rows, top to bottom),
// shelves may differ in height; zones and the two special states below. With
// several rooms, each room gets its own grid and zones under its name.
export function locationGrid(selected, { exclude = null } = {}) {
  const sel = locKey(selected);
  const count = (loc) => countAt(loc) - (exclude && locKey(exclude.location) === locKey(loc) ? 1 : 0);

  const grid = (shelves) => {
    if (!shelves.length) return '';
    const maxLevels = Math.max(...shelves.map((s) => s.levels));
    const cells = [html`<span></span>`, ...shelves.map((s) => html`<span class="lg-head">${s.id}</span>`)];
    for (let level = 1; level <= maxLevels; level++) {
      cells.push(html`<span class="lg-rowhead">${level}</span>`);
      for (const s of shelves) {
        if (level > s.levels) {
          cells.push(html`<span class="lg-void"></span>`);
          continue;
        }
        const key = `${s.id}${level}`;
        const n = count({ shelf: s.id, level });
        cells.push(html`
          <button type="button" class="lg-cell" data-loc="${key}" aria-pressed="${String(sel === key)}" aria-label="Regal ${s.id}, Boden ${level}">
            <span>${key}</span><small>${n || '–'}</small>
          </button>`);
      }
    }
    return html`
      <div class="lg-scroll">
        <div class="lg-grid" style="--cols:${shelves.length}">${cells}</div>
      </div>`;
  };

  const zones = (list, label) =>
    list.length
      ? html`
        <div class="lg-label">${label}</div>
        <div class="lg-zones">
          ${list.map((z) => {
            const n = count({ zone: z.id });
            return html`
              <button type="button" class="lg-zone" data-loc="@${z.id}" aria-pressed="${String(sel === `@${z.id}`)}" aria-label="Stellplatz ${z.id} ${z.name}">
                <span class="lg-zone-code">${z.id}</span>
                <span class="lg-zone-name">${z.name || 'Stellplatz'}</span>
                <small>${n || '–'}</small>
              </button>`;
          })}
        </div>`
      : '';

  const places = multiRoom()
    ? state.rooms.map(
        (room) => html`
          <div class="lg-room">${room.name}</div>
          ${grid(shelvesIn(room.id))}
          ${zones(zonesIn(room.id), 'Stellplätze')}`,
      )
    : html`${grid(state.shelves)}${zones(state.zones, 'Stellplätze')}`;

  return html`
    <div class="locgrid">
      ${places}
      <div class="lg-extra">
        <button type="button" class="lg-opt" data-loc="none" aria-pressed="${String(sel === 'none')}">${icon('tray')} Ohne festen Platz</button>
        <button type="button" class="lg-opt" data-loc="away" aria-pressed="${String(sel === 'away')}">${icon('house')} Entnommen</button>
      </div>
    </div>`;
}

export function toggleRow({ name, label, checked, sub = '' }) {
  return html`
    <label class="cell toggle-row">
      <span class="cell-text"><span class="cell-title">${label}</span>${sub ? html`<span class="cell-sub">${sub}</span>` : ''}</span>
      <input type="checkbox" class="switch" name="${name}" ${checked ? raw('checked') : ''}>
    </label>`;
}

export function stepper({ name, value, min = 1, max = 99 }) {
  return html`
    <span class="stepper" data-stepper="${name}" data-min="${min}" data-max="${max}">
      <button type="button" data-step="-1" aria-label="Weniger" ${value <= min ? raw('disabled') : ''}>${icon('minus')}</button>
      <output>${value}</output>
      <button type="button" data-step="1" aria-label="Mehr" ${value >= max ? raw('disabled') : ''}>${icon('plus')}</button>
    </span>`;
}

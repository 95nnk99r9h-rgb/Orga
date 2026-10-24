// Reusable building blocks for views.

import { html, raw, icon, esc } from './ui.js';
import { state, categoryById, countAt, photoURL, photoURLCached } from './store.js';
import { pad, boxTitle, locKey, locShort } from './format.js';

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
  html`<button class="circle-btn glass" data-action="new-box" aria-label="Neue Kiste">${icon('plus')}</button>`;

export const colorOf = (box) => categoryById(box.category)?.color ?? 'gray';
export const catAttrs = (color) => raw(`style="--cat: var(--c-${esc(color ?? 'gray')})" data-c="${esc(color ?? 'gray')}"`);

export const badge = (box, cls = '') =>
  html`<span class="badge ${cls}" ${catAttrs(colorOf(box))}>${pad(box.number)}</span>`;

export function itemsPreview(items, max = 3) {
  if (!items.length) return 'Noch kein Inhalt erfasst';
  const shown = items.slice(0, max).join(', ');
  return items.length > max ? `${shown} +${items.length - max}` : shown;
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

export function boxRow(box, { sub = null, href = `#/kiste/${box.number}`, trailing = null } = {}) {
  return html`
    <a class="cell box-row" href="${href}">
      ${badge(box)}
      <span class="cell-text">
        <span class="cell-title">${boxTitle(box)}</span>
        <span class="cell-sub">${sub ?? html`<b class="loc-tag">${locShort(box.location)}</b> ${itemsPreview(box.items)}`}</span>
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

// Grid picker: columns are shelves, rows are levels (top to bottom).
export function locationGrid(selected, { exclude = null } = {}) {
  const sel = locKey(selected);
  const maxLevels = Math.max(1, ...state.shelves.map((s) => s.levels));
  const count = (loc) => countAt(loc) - (exclude && locKey(exclude.location) === locKey(loc) ? 1 : 0);
  const cells = [];
  cells.push(html`<span></span>`);
  for (const s of state.shelves) cells.push(html`<span class="lg-head">${s.id}</span>`);
  for (let level = 1; level <= maxLevels; level++) {
    cells.push(html`<span class="lg-rowhead">${level}</span>`);
    for (const s of state.shelves) {
      if (level > s.levels) {
        cells.push(html`<span class="lg-void"></span>`);
        continue;
      }
      const key = `${s.id}${level}`;
      const n = count({ shelf: s.id, level });
      cells.push(html`
        <button type="button" class="lg-cell" data-loc="${key}" aria-pressed="${String(sel === key)}" aria-label="Regal ${s.id}, Boden ${level}">
          <span>${key}</span><small>${n ? n : '–'}</small>
        </button>`);
    }
  }
  return html`
    <div class="locgrid">
      <div class="lg-scroll">
        <div class="lg-grid" style="--cols:${state.shelves.length}">${cells}</div>
      </div>
      <div class="lg-extra">
        <button type="button" class="lg-opt" data-loc="none" aria-pressed="${String(sel === 'none')}">${icon('tray')} Ohne festen Platz</button>
        <button type="button" class="lg-opt" data-loc="away" aria-pressed="${String(sel === 'away')}">${icon('house')} Nicht im Keller</button>
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

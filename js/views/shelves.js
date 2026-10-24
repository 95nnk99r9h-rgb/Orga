// Storage building blocks – drawn shelves for "Lager", rows of number chips
// for "Liste" – and the detail pages for a shelf, a level and a zone.

import { html, icon } from '../ui.js';
import { navBar, largeTitle, boxRow, boxChip, emptyState, shelfDiagram, catAttrs, colorOf } from '../components.js';
import { state, shelfById, zoneById, boxesAt, boxesInZone, unplacedBoxes, awayBoxes } from '../store.js';
import { pad, plural, unitsLabel, unitName, boxTitle } from '../format.js';
import { navigate } from '../router.js';
import { newBox, openPickBoxSheet } from './box.js';
import { presetLabels } from './labels.js';

const chips = (boxes) => (boxes.length ? boxes.map(boxChip) : html`<span class="level-empty">leer</span>`);

function levelRow(shelf, level) {
  return html`
    <div class="level-row" data-href="/regal/${shelf.id}/${level}">
      <a class="level-num" href="#/regal/${shelf.id}/${level}" aria-label="Boden ${level}">${level}</a>
      <span class="level-chips">${chips(boxesAt(shelf.id, level))}</span>
      ${icon('chevron', 'chev')}
    </div>`;
}

const shelfHead = (shelf) => html`
  <a class="shelf-head" href="#/regal/${shelf.id}">
    <span class="shelf-letter">${shelf.id}</span>
    <span class="cell-text">
      <span class="cell-title">Regal ${shelf.id}</span>
      <span class="cell-sub">${shelf.note ? `${shelf.note} · ` : ''}${plural(shelf.levels, 'Boden', 'Böden')} · ${unitsLabel(boxesAt(shelf.id))}</span>
    </span>
    ${icon('chevron', 'chev')}
  </a>`;

const zonesHead = () => html`
  <div class="shelf-head static">
    <span class="zone-code">${icon('zone')}</span>
    <span class="cell-text">
      <span class="cell-title">Stellplätze</span>
      <span class="cell-sub">Außerhalb der Regale</span>
    </span>
  </div>`;

export function shelfCard(shelf) {
  return html`
    <section class="card shelf-card">
      ${shelfHead(shelf)}
      ${Array.from({ length: shelf.levels }, (_, i) => levelRow(shelf, i + 1))}
    </section>`;
}

export function zoneCard() {
  if (!state.zones.length) return '';
  return html`
    <section class="card shelf-card">
      ${zonesHead()}
      ${state.zones.map(
        (z) => html`
          <div class="level-row zone-row" data-href="/platz/${z.id}">
            <a class="zone-code sm" href="#/platz/${z.id}" aria-label="Stellplatz ${z.id}">${z.id}</a>
            <span class="zone-main">
              <span class="zone-name">${z.name || `Stellplatz ${z.id}`}</span>
              <span class="level-chips">${chips(boxesInZone(z.id))}</span>
            </span>
            ${icon('chevron', 'chev')}
          </div>`,
      )}
    </section>`;
}

// ---------------------------------------------------------------------------
// Drawn shelves: compartments from top to bottom with the entries standing on
// each board; the board carries the level address like the printed label.

function crate(box) {
  const isItem = box.kind === 'item';
  return html`
    <a class="crate ${isItem ? 'item' : ''}" href="#/kiste/${box.number}" ${catAttrs(colorOf(box))} aria-label="${unitName(box)}: ${boxTitle(box)}">
      ${isItem ? '' : html`<span class="crate-lid"></span>`}
      <span class="crate-label">${pad(box.number)}</span>
      <span class="crate-name">${isItem ? boxTitle(box) : box.items.join(', ') || 'leer'}</span>
    </a>`;
}

export function rackCard(shelf) {
  return html`
    <section class="card rack">
      ${shelfHead(shelf)}
      <div class="rack-frame">
        ${Array.from({ length: shelf.levels }, (_, i) => {
          const level = i + 1;
          const boxes = boxesAt(shelf.id, level);
          return html`
            <div class="rack-level" data-href="/regal/${shelf.id}/${level}">
              ${boxes.length ? boxes.map(crate) : html`<span class="rack-empty">leer</span>`}
            </div>
            <div class="rack-board"><a class="rack-tag" href="#/regal/${shelf.id}/${level}" aria-label="Boden ${shelf.id}${level}">${shelf.id}${level}</a></div>`;
        })}
      </div>
    </section>`;
}

const floor = ({ href = null, code = '', name, boxes, empty = 'frei' }) => html`
  <div class="floor ${href ? '' : 'outside'}" ${href ? html`data-href="${href}"` : ''}>
    <div class="floor-row">${boxes.length ? boxes.map(crate) : html`<span class="rack-empty">${empty}</span>`}</div>
    ${href
      ? html`<a class="floor-tag" href="#${href}">${code ? html`<b>${code}</b>` : ''}${name}</a>`
      : html`<span class="floor-tag">${name}</span>`}
  </div>`;

export function zoneRack() {
  if (!state.zones.length) {
    return html`
      <a class="card notice spaced-bottom" href="#/mehr/regale">
        <span class="icon-tile" ${catAttrs('green')}>${icon('zone')}</span>
        <span class="cell-text">
          <span class="cell-title">Stellplätze anlegen</span>
          <span class="cell-sub wrap">Für Großes ohne Regal, z. B. unter der Treppe oder in der Garage.</span>
        </span>
        ${icon('chevron', 'chev')}
      </a>`;
  }
  return html`
    <section class="card rack">
      ${zonesHead()}
      <div class="floors">
        ${state.zones.map((z) => floor({ href: `/platz/${z.id}`, code: z.id, name: z.name || `Stellplatz ${z.id}`, boxes: boxesInZone(z.id) }))}
      </div>
    </section>`;
}

// Entries without a place in the cellar, drawn the same way.
export function outsideRack() {
  const unplaced = unplacedBoxes();
  const away = awayBoxes();
  if (!unplaced.length && !away.length) return '';
  return html`
    <section class="card rack">
      <div class="shelf-head static">
        <span class="zone-code muted">${icon('tray')}</span>
        <span class="cell-text">
          <span class="cell-title">Außerhalb</span>
          <span class="cell-sub">Ohne festen Platz oder entnommen</span>
        </span>
      </div>
      <div class="floors">
        ${unplaced.length ? floor({ name: 'Ohne festen Platz', boxes: unplaced }) : ''}
        ${away.length ? floor({ name: 'Nicht im Keller', boxes: away }) : ''}
      </div>
    </section>`;
}

// Tapping anywhere on a row (outside its chips) opens the level or zone.
export function bindRows(root) {
  root.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const row = e.target.closest('[data-href]');
    if (row) navigate(row.dataset.href);
  });
}

const notFound = (what) => html`
  ${navBar({ back: '/' })}
  <main class="page">${emptyState({ iconName: 'shelves', title: `${what} gibt es nicht`, text: 'Prüfe die Lagerorte unter „Mehr“.' })}</main>`;

const actionRow = (action, color, iconName, title) => html`
  <button class="cell" data-action="${action}">
    <span class="icon-tile" ${catAttrs(color)}>${icon(iconName)}</span>
    <span class="cell-title">${title}</span>${icon('chevron', 'chev')}
  </button>`;

const placeList = (boxes, empty) =>
  html`<div class="list">${boxes.length ? boxes.map((b) => boxRow(b, { showLoc: false })) : html`<div class="cell muted-cell">${empty}</div>`}</div>`;

// Shared actions for a level or a zone.
function bindPlace(root, loc, labelPreset) {
  root.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'put-here') openPickBoxSheet(loc);
    if (action === 'new-here') newBox({ location: loc });
    if (action === 'new-item-here') newBox({ location: loc, kind: 'item' });
    if (action === 'print') {
      presetLabels({ mode: 'places', ...labelPreset });
      navigate('/etiketten');
    }
  });
}

export const shelfView = {
  title: ({ shelf }) => `Regal ${shelf}`,
  render({ shelf: id }) {
    const shelf = shelfById(id);
    if (!shelf) return notFound(`Regal ${id}`);
    return html`
      ${navBar({ title: `Regal ${id}`, back: '/' })}
      <main class="page">
        ${largeTitle(`Regal ${id}`, `${shelf.note ? `${shelf.note} · ` : ''}${plural(shelf.levels, 'Boden', 'Böden')}`)}
        ${Array.from({ length: shelf.levels }, (_, i) => {
          const level = i + 1;
          return html`
            <a class="section-head link" href="#/regal/${id}/${level}">Boden ${level}${level === 1 ? ' · oben' : level === shelf.levels ? ' · unten' : ''} ${icon('chevron')}</a>
            ${placeList(boxesAt(id, level), 'Leer')}`;
        })}
        <div class="list actions">${actionRow('print', 'blue', 'printer', `Etiketten für Regal ${id} drucken`)}</div>
      </main>`;
  },
  mount(root, { shelf }) {
    bindPlace(root, null, { shelves: [shelf], zones: [] });
  },
};

export const levelView = {
  title: ({ shelf, level }) => `${shelf}${level}`,
  render({ shelf: id, level }) {
    const shelf = shelfById(id);
    level = Number(level);
    if (!shelf || !(level >= 1 && level <= shelf.levels)) return notFound(`Boden ${id}${level}`);
    const boxes = boxesAt(id, level);
    const n = shelf.levels;
    const where = n === 1 ? 'Einziger Boden' : level === 1 ? `Oberster von ${n} Böden` : level === n ? `Unterster von ${n} Böden` : `${level}. von ${n} Böden, von oben`;
    return html`
      ${navBar({ title: `${id}${level}`, back: `/regal/${id}` })}
      <main class="page">
        <section class="level-hero">
          ${shelfDiagram(shelf.levels, level)}
          <div>
            <span class="level-code">${id}${level}</span>
            <h1 data-title-anchor>Regal ${id} · Boden ${level}</h1>
            <p>${where}${shelf.note ? ` · ${shelf.note}` : ''}</p>
          </div>
        </section>
        <h3 class="section-head">${unitsLabel(boxes)}</h3>
        ${placeList(boxes, 'Hier steht noch nichts.')}
        <div class="list actions">
          ${actionRow('put-here', 'green', 'move', 'Hierher stellen')}
          ${actionRow('new-here', 'orange', 'box', 'Neue Kiste hier erfassen')}
          ${actionRow('new-item-here', 'indigo', 'item', 'Neues Einzelstück hier erfassen')}
          ${actionRow('print', 'blue', 'printer', `Etiketten für Regal ${id} drucken`)}
        </div>
      </main>`;
  },
  mount(root, { shelf, level }) {
    bindPlace(root, { shelf, level: Number(level) }, { shelves: [shelf], zones: [] });
  },
};

export const zoneView = {
  title: ({ zone }) => `Stellplatz ${zone}`,
  render({ zone: id }) {
    const zone = zoneById(id);
    if (!zone) return notFound(`Stellplatz ${id}`);
    const boxes = boxesInZone(id);
    return html`
      ${navBar({ title: zone.name || `Stellplatz ${id}`, back: '/' })}
      <main class="page">
        <section class="level-hero">
          <span class="zone-code lg">${id}</span>
          <div>
            <span class="level-code zone">Stellplatz ${id}</span>
            <h1 data-title-anchor>${zone.name || `Stellplatz ${id}`}</h1>
            <p>Außerhalb der Regale</p>
          </div>
        </section>
        <h3 class="section-head">${unitsLabel(boxes)}</h3>
        ${placeList(boxes, 'Hier steht noch nichts.')}
        <div class="list actions">
          ${actionRow('put-here', 'green', 'move', 'Hierher stellen')}
          ${actionRow('new-item-here', 'indigo', 'item', 'Neues Einzelstück hier erfassen')}
          ${actionRow('new-here', 'orange', 'box', 'Neue Kiste hier erfassen')}
          ${actionRow('print', 'blue', 'printer', 'Etikett drucken')}
        </div>
      </main>`;
  },
  mount(root, { zone }) {
    bindPlace(root, { zone }, { shelves: [], zones: [zone], signs: false });
  },
};

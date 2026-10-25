// Storage building blocks – shelf and zone cards with rows of number chips
// for the start page – and the detail pages for a shelf, a level and a zone.

import { html, icon } from '../ui.js';
import { navBar, largeTitle, boxRow, crate, emptyState, shelfDiagram, catAttrs } from '../components.js';
import { state, shelfById, zoneById, roomById, boxesAt, boxesInZone, shelvesIn, zonesIn, multiRoom } from '../store.js';
import { plural, unitsLabel } from '../format.js';
import { navigate } from '../router.js';
import { newBox, openPickBoxSheet } from './box.js';
import { presetLabels } from './labels.js';

// The start page draws each shelf: uprights, a board per level with a small
// level label on its front edge, and the crates standing on it.
const free = () => html`<span class="rack-free" aria-hidden="true">${icon('plus')}</span>`;
const crates = (boxes) => (boxes.length ? boxes.map(crate) : free());

function rackLevel(shelf, level) {
  return html`
    <div class="rack-level" data-href="/regal/${shelf.id}/${level}">
      <div class="rack-slots" data-reorder>${crates(boxesAt(shelf.id, level))}</div>
      <a class="rack-tag" href="#/regal/${shelf.id}/${level}" aria-label="Regal ${shelf.id}, Boden ${level}">${shelf.id}${level}</a>
    </div>`;
}

const shelfHead = (shelf) => html`
  <a class="rack-head" href="#/regal/${shelf.id}">
    <span class="shelf-letter">${shelf.id}</span>
    <span class="cell-text">
      <span class="cell-title">Regal ${shelf.id}</span>
      <span class="cell-sub">${shelf.note ? `${shelf.note} · ` : ''}${plural(shelf.levels, 'Boden', 'Böden')} · ${unitsLabel(boxesAt(shelf.id))}</span>
    </span>
    ${icon('chevron', 'chev')}
  </a>`;

export function shelfCard(shelf) {
  return html`
    <section class="rack">
      ${shelfHead(shelf)}
      <div class="rack-frame">${Array.from({ length: shelf.levels }, (_, i) => rackLevel(shelf, i + 1))}</div>
    </section>`;
}

// Zones are spots on the floor, each marked with a kraft plate.
// zones: the zones to show (one room's); notice: invite to create some if none.
export function zoneCard(zones = state.zones, { notice = true } = {}) {
  if (!zones.length) {
    if (!notice) return '';
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
    <section class="rack floor">
      <div class="rack-head static">
        <span class="zone-code">${icon('zone')}</span>
        <span class="cell-text">
          <span class="cell-title">Stellplätze</span>
          <span class="cell-sub">Außerhalb der Regale</span>
        </span>
      </div>
      ${zones.map(
        (z) => html`
          <div class="rack-level floor-spot" data-href="/platz/${z.id}">
            <a class="floor-plate" href="#/platz/${z.id}" aria-label="Stellplatz ${z.id}"><b>${z.id}</b><span>${z.name || `Stellplatz ${z.id}`}</span></a>
            <div class="rack-slots" data-reorder>${crates(boxesInZone(z.id))}</div>
          </div>`,
      )}
    </section>`;
}

// With several rooms the start page shows each room under its name.
export function roomBlock(room) {
  const shelves = shelvesIn(room.id);
  const zones = zonesIn(room.id);
  return html`
    <h2 class="room-title">${room.name}<small>${plural(shelves.length, 'Regal', 'Regale')} · ${plural(zones.length, 'Stellplatz', 'Stellplätze')}</small></h2>
    <div class="shelf-grid">
      ${shelves.map(shelfCard)}
      ${zoneCard(zones, { notice: false })}
      ${shelves.length || zones.length
        ? ''
        : html`<a class="card notice spaced-bottom" href="#/mehr/regale">
            <span class="icon-tile" ${catAttrs('blue')}>${icon('shelves')}</span>
            <span class="cell-text"><span class="cell-title">Noch leer</span><span class="cell-sub wrap">Regale und Stellplätze für diesen Raum unter „Lagerorte“ anlegen.</span></span>
            ${icon('chevron', 'chev')}
          </a>`}
    </div>`;
}

const roomPrefix = (place) => (multiRoom() ? `${roomById(place.room)?.name} · ` : '');

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
    if (action === 'print' || action === 'print-list') {
      presetLabels({ mode: action === 'print' ? 'places' : 'lists', ...labelPreset });
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
        ${largeTitle(`Regal ${id}`, `${roomPrefix(shelf)}${shelf.note ? `${shelf.note} · ` : ''}${plural(shelf.levels, 'Boden', 'Böden')}`)}
        ${Array.from({ length: shelf.levels }, (_, i) => {
          const level = i + 1;
          return html`
            <a class="section-head link" href="#/regal/${id}/${level}">Boden ${level}${level === 1 ? ' · oben' : level === shelf.levels ? ' · unten' : ''} ${icon('chevron')}</a>
            ${placeList(boxesAt(id, level), 'Leer')}`;
        })}
        <div class="list actions">
          ${actionRow('print-list', 'teal', 'list', 'Inhaltsliste drucken')}
          ${actionRow('print', 'blue', 'printer', `Etiketten für Regal ${id} drucken`)}
        </div>
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
            <p>${roomPrefix(shelf)}${where}${shelf.note ? ` · ${shelf.note}` : ''}</p>
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
            <p>${multiRoom() ? `${roomPrefix(zone)}außerhalb der Regale` : 'Außerhalb der Regale'}</p>
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

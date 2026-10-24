// Shelf overview, a single shelf, and a single level ("Boden").

import { html, icon } from '../ui.js';
import { navBar, largeTitle, newBoxButton, boxRow, emptyState, shelfDiagram, catAttrs, colorOf, itemsPreview } from '../components.js';
import { state, shelfById, boxesAt, unplacedBoxes, awayBoxes } from '../store.js';
import { pad, boxTitle, plural } from '../format.js';
import { navigate } from '../router.js';
import { newBox, openPickBoxSheet } from './box.js';
import { presetLabels } from './labels.js';

function levelRow(shelf, level) {
  const boxes = boxesAt(shelf.id, level);
  return html`
    <div class="level-row" data-href="/regal/${shelf.id}/${level}">
      <a class="level-num" href="#/regal/${shelf.id}/${level}" aria-label="Boden ${level}">${level}</a>
      <span class="level-chips">
        ${boxes.length
          ? boxes.map((b) => html`<a class="box-chip" href="#/kiste/${b.number}" ${catAttrs(colorOf(b))} title="${boxTitle(b)}">${pad(b.number)}</a>`)
          : html`<span class="level-empty">leer</span>`}
      </span>
      ${icon('chevron', 'chev')}
    </div>`;
}

function shelfCard(shelf) {
  const count = boxesAt(shelf.id).length;
  return html`
    <section class="card shelf-card">
      <a class="shelf-head" href="#/regal/${shelf.id}">
        <span class="shelf-letter">${shelf.id}</span>
        <span class="cell-text">
          <span class="cell-title">Regal ${shelf.id}</span>
          <span class="cell-sub">${shelf.note || plural(shelf.levels, 'Boden', 'Böden')}</span>
        </span>
        <span class="cell-detail">${plural(count, 'Kiste', 'Kisten')}</span>
        ${icon('chevron', 'chev')}
      </a>
      ${Array.from({ length: shelf.levels }, (_, i) => levelRow(shelf, i + 1))}
    </section>`;
}

// Tapping anywhere on a level row (outside its chips) opens the level.
function bindRows(root) {
  root.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const row = e.target.closest('[data-href]');
    if (row) navigate(row.dataset.href);
  });
}

export const shelvesView = {
  tab: 'shelves',
  title: 'Regale',
  render() {
    const unplaced = unplacedBoxes();
    const away = awayBoxes();
    return html`
      ${navBar({ title: 'Regale', right: newBoxButton() })}
      <main class="page">
        ${largeTitle('Regale', `${plural(state.shelves.length, 'Regal', 'Regale')} · ${plural(state.boxes.length, 'Kiste', 'Kisten')}`)}
        ${state.shelves.length
          ? state.shelves.map(shelfCard)
          : emptyState({
              iconName: 'shelves',
              title: 'Noch keine Regale',
              text: 'Lege fest, wie viele Regale und Böden dein Keller hat.',
              action: html`<a class="btn" href="#/mehr/regale">Regale einrichten</a>`,
            })}
        ${unplaced.length ? html`<h3 class="section-head">Ohne festen Platz</h3><div class="list">${unplaced.map((b) => boxRow(b))}</div>` : ''}
        ${away.length ? html`<h3 class="section-head">Nicht im Keller</h3><div class="list">${away.map((b) => boxRow(b))}</div>` : ''}
        ${state.shelves.length ? html`<a class="btn secondary spaced" href="#/mehr/regale">${icon('pencil')} Regale bearbeiten</a>` : ''}
      </main>`;
  },
  mount: bindRows,
};

const notFound = (what) => html`
  ${navBar({ back: '/regale' })}
  <main class="page">${emptyState({ iconName: 'shelves', title: `${what} gibt es nicht`, text: 'Prüfe die Regale unter „Mehr“.' })}</main>`;

export const shelfView = {
  title: ({ shelf }) => `Regal ${shelf}`,
  render({ shelf: id }) {
    const shelf = shelfById(id);
    if (!shelf) return notFound(`Regal ${id}`);
    return html`
      ${navBar({ title: `Regal ${id}`, back: '/regale' })}
      <main class="page">
        ${largeTitle(`Regal ${id}`, shelf.note || plural(shelf.levels, 'Boden', 'Böden'))}
        ${Array.from({ length: shelf.levels }, (_, i) => {
          const level = i + 1;
          const boxes = boxesAt(id, level);
          return html`
            <a class="section-head link" href="#/regal/${id}/${level}">Boden ${level}${level === 1 ? ' · oben' : level === shelf.levels ? ' · unten' : ''} ${icon('chevron')}</a>
            <div class="list">
              ${boxes.length ? boxes.map((b) => boxRow(b, { sub: itemsPreview(b.items) })) : html`<div class="cell muted-cell">Leer</div>`}
            </div>`;
        })}
        <div class="list actions">
          <button class="cell" data-action="print">
            <span class="icon-tile" ${catAttrs('blue')}>${icon('printer')}</span>
            <span class="cell-title">Etiketten für Regal ${id} drucken</span>${icon('chevron', 'chev')}
          </button>
        </div>
      </main>`;
  },
  mount(root, { shelf }) {
    root.addEventListener('click', (e) => {
      if (!e.target.closest('[data-action="print"]')) return;
      presetLabels({ mode: 'shelves', shelves: [shelf] });
      navigate('/etiketten');
    });
  },
};

export const levelView = {
  title: ({ shelf, level }) => `${shelf}${level}`,
  render({ shelf: id, level }) {
    const shelf = shelfById(id);
    level = Number(level);
    if (!shelf || !(level >= 1 && level <= shelf.levels)) return notFound(`Boden ${id}${level}`);
    const boxes = boxesAt(id, level);
    const where = level === 1 ? 'Oberster Boden' : level === shelf.levels ? 'Unterster Boden' : `${level}. Boden von oben`;
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
        <h3 class="section-head">${plural(boxes.length, 'Kiste', 'Kisten')}</h3>
        <div class="list">
          ${boxes.length ? boxes.map((b) => boxRow(b, { sub: itemsPreview(b.items) })) : html`<div class="cell muted-cell">Hier steht noch nichts.</div>`}
        </div>
        <div class="list actions">
          <button class="cell" data-action="put-here">
            <span class="icon-tile" ${catAttrs('green')}>${icon('move')}</span>
            <span class="cell-title">Kiste hierher stellen</span>${icon('chevron', 'chev')}
          </button>
          <button class="cell" data-action="new-here">
            <span class="icon-tile" ${catAttrs('orange')}>${icon('plus')}</span>
            <span class="cell-title">Neue Kiste hier anlegen</span>${icon('chevron', 'chev')}
          </button>
          <button class="cell" data-action="print">
            <span class="icon-tile" ${catAttrs('blue')}>${icon('printer')}</span>
            <span class="cell-title">Etiketten für Regal ${id} drucken</span>${icon('chevron', 'chev')}
          </button>
        </div>
      </main>`;
  },
  mount(root, { shelf, level }) {
    const loc = { shelf, level: Number(level) };
    root.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'put-here') openPickBoxSheet(loc);
      if (action === 'new-here') newBox({ location: loc });
      if (action === 'print') {
        presetLabels({ mode: 'shelves', shelves: [shelf] });
        navigate('/etiketten');
      }
    });
  },
};

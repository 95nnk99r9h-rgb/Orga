// Start page "Lager": every shelf, level and zone as rows of number chips,
// with search and filter chips on top. Entries on a level can be reordered
// by holding and dragging their chip.

import { html, icon } from '../ui.js';
import { boxRow, emptyState, catAttrs } from '../components.js';
import { state, unplacedBoxes, awayBoxes, itemCount, reorderBoxes } from '../store.js';
import { plural, unitsLabel, locKey } from '../format.js';
import { browseView, filterChips } from './browse.js';
import { shelfCard, zoneCard, bindRows } from './shelves.js';
import { installCard, showInstallHint } from '../install.js';
import { enableReorder } from '../reorder.js';

function overview() {
  const unplaced = unplacedBoxes();
  const away = awayBoxes();
  const backupDue =
    state.boxes.length >= 5 && (!state.meta.lastBackup || Date.now() - state.meta.lastBackup > 30 * 86400000);
  const perPlace = new Map();
  for (const b of state.boxes) {
    if (b.location && !b.location.away) perPlace.set(locKey(b.location), (perPlace.get(locKey(b.location)) ?? 0) + 1);
  }
  const crowded = [...perPlace.values()].some((n) => n > 1);
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
    ${crowded ? html`<p class="section-foot center">Tipp: Nummer gedrückt halten und ziehen, um die Reihenfolge auf einem Boden zu ändern.</p>` : ''}
    ${unplaced.length ? html`<h3 class="section-head">Ohne festen Platz</h3><div class="list">${unplaced.map((b) => boxRow(b))}</div>` : ''}
    ${away.length ? html`<h3 class="section-head">Nicht im Keller</h3><div class="list">${away.map((b) => boxRow(b))}</div>` : ''}
    <a class="btn secondary spaced" href="#/mehr/regale">${icon('pencil')} Regale &amp; Stellplätze bearbeiten</a>
    ${state.boxes.length ? html`<p class="stat-line">${unitsLabel(state.boxes)} · ${plural(itemCount(), 'Gegenstand', 'Gegenstände')}</p>` : ''}`;
}

export default browseView({
  tab: 'home',
  title: 'Lager',
  subtitle: () => `${plural(state.shelves.length, 'Regal', 'Regale')} · ${plural(state.zones.length, 'Stellplatz', 'Stellplätze')}`,
  overview,
  bind(root) {
    bindRows(root);
    enableReorder(root, reorderBoxes);
  },
});

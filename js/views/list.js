// "Liste": all boxes and loose items as rows of number chips per shelf level
// and zone, with filter chips and search on top.

import { html, icon } from '../ui.js';
import { boxRow, emptyState } from '../components.js';
import { state, unplacedBoxes, awayBoxes, itemCount } from '../store.js';
import { plural, unitsLabel } from '../format.js';
import { browseView, filterChips } from './browse.js';
import { shelfCard, zoneCard, bindRows } from './shelves.js';

function overview() {
  const unplaced = unplacedBoxes();
  const away = awayBoxes();
  return html`
    ${state.boxes.length ? filterChips() : ''}
    ${state.shelves.length
      ? state.shelves.map(shelfCard)
      : emptyState({ iconName: 'list', title: 'Noch keine Regale', text: 'Lege unter „Mehr → Lagerorte“ fest, welche Regale es gibt.' })}
    ${zoneCard()}
    ${unplaced.length ? html`<h3 class="section-head">Ohne festen Platz</h3><div class="list">${unplaced.map((b) => boxRow(b))}</div>` : ''}
    ${away.length ? html`<h3 class="section-head">Nicht im Keller</h3><div class="list">${away.map((b) => boxRow(b))}</div>` : ''}
    <a class="btn secondary spaced" href="#/mehr/regale">${icon('pencil')} Regale &amp; Stellplätze bearbeiten</a>
    ${state.boxes.length ? html`<p class="stat-line">${unitsLabel(state.boxes)} · ${plural(itemCount(), 'Gegenstand', 'Gegenstände')}</p>` : ''}`;
}

export default browseView({
  tab: 'list',
  title: 'Liste',
  subtitle: () => unitsLabel(state.boxes),
  overview,
  bind: bindRows,
});

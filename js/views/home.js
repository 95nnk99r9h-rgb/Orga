// Start page "Lager": every shelf drawn with its boxes and items, the spots
// outside the shelves, and search on top. Each stored entry can be tapped.

import { html, icon } from '../ui.js';
import { emptyState, catAttrs } from '../components.js';
import { state } from '../store.js';
import { plural } from '../format.js';
import { browseView } from './browse.js';
import { rackCard, zoneRack, outsideRack, bindRows } from './shelves.js';
import { installCard, showInstallHint } from '../install.js';

function overview() {
  const backupDue =
    state.boxes.length >= 5 && (!state.meta.lastBackup || Date.now() - state.meta.lastBackup > 30 * 86400000);
  return html`
    ${showInstallHint() ? installCard() : ''}
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
      ? state.shelves.map(rackCard)
      : emptyState({
          iconName: 'shelves',
          title: 'Noch keine Regale',
          text: 'Lege fest, welche Regale und Stellplätze dein Keller hat.',
          action: html`<a class="btn" href="#/mehr/regale">Lagerorte einrichten</a>`,
        })}
    ${zoneRack()}
    ${outsideRack()}
    <a class="btn secondary spaced" href="#/mehr/regale">${icon('pencil')} Regale &amp; Stellplätze bearbeiten</a>`;
}

export default browseView({
  tab: 'home',
  title: 'Lager',
  subtitle: () => `${plural(state.shelves.length, 'Regal', 'Regale')} · ${plural(state.zones.length, 'Stellplatz', 'Stellplätze')}`,
  overview,
  bind: bindRows,
});

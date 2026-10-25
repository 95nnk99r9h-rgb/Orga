// Start page "Lager": every shelf, level and zone as rows of number chips,
// with search and filter chips on top. Entries on a level can be reordered
// by holding and dragging their chip. What expires soon is pointed out first.

import { html, icon, alertDialog } from '../ui.js';
import { boxRow, emptyState, catAttrs } from '../components.js';
import { state, unplacedBoxes, awayBoxes, itemCount, reorderBoxes, expiringBoxes, isDemo, setDemo } from '../store.js';
import { plural, unitsLabel, locKey, monthsLeft, warnSpan } from '../format.js';
import { browseView, filterChips } from './browse.js';
import { shelfCard, zoneCard, bindRows } from './shelves.js';
import { installCard, showInstallHint } from '../install.js';
import { enableReorder } from '../reorder.js';

const demoBanner = () => html`
  <div class="card notice demo-banner spaced-bottom">
    <span class="icon-tile" ${catAttrs('purple')}>${icon('sparkles')}</span>
    <span class="cell-text">
      <span class="cell-title">Demo-Modus</span>
      <span class="cell-sub wrap">Beispielapotheke – deine Daten bleiben unberührt.</span>
    </span>
    <button class="pill-btn tinted" data-action="exit-demo">Beenden</button>
  </div>`;

function expiryNotice() {
  const expiring = expiringBoxes();
  if (!expiring.length) return '';
  const expired = expiring.filter((b) => monthsLeft(b.expiry) < 0).length;
  const soon = expiring.length - expired;
  const parts = [];
  if (expired) parts.push(`${expired} abgelaufen`);
  if (soon) parts.push(`${soon} ${soon === 1 ? 'läuft' : 'laufen'} ${warnSpan(state.meta.expiryWarn)} ab`);
  return html`
    <button type="button" class="card notice spaced-bottom" data-filter="expiry">
      <span class="icon-tile" ${catAttrs(expired ? 'red' : 'orange')}>${icon('calendar')}</span>
      <span class="cell-text">
        <span class="cell-title">Verfall prüfen</span>
        <span class="cell-sub wrap">${parts.join(' · ')}</span>
      </span>
      ${icon('chevron', 'chev')}
    </button>`;
}

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
    ${isDemo() ? demoBanner() : ''}
    ${showInstallHint() ? installCard() : ''}
    ${state.boxes.length ? filterChips() : ''}
    ${expiryNotice()}
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
          text: 'Lege fest, welche Regale und Stellplätze dein Lager hat.',
          action: html`<a class="btn" href="#/mehr/regale">Lagerorte einrichten</a>`,
        })}
    ${zoneCard()}
    ${crowded ? html`<p class="section-foot center">Tipp: Nummer gedrückt halten und ziehen, um die Reihenfolge auf einem Boden zu ändern.</p>` : ''}
    ${unplaced.length ? html`<h3 class="section-head">Ohne festen Platz</h3><div class="list">${unplaced.map((b) => boxRow(b))}</div>` : ''}
    ${away.length ? html`<h3 class="section-head">Nicht im Lager</h3><div class="list">${away.map((b) => boxRow(b))}</div>` : ''}
    <a class="btn secondary spaced" href="#/mehr/regale">${icon('pencil')} Regale &amp; Stellplätze bearbeiten</a>
    ${state.boxes.length ? html`<p class="stat-line">${unitsLabel(state.boxes)} · ${plural(itemCount(), 'Artikel', 'Artikel')}</p>` : ''}`;
}

export default browseView({
  tab: 'home',
  title: 'Lager',
  subtitle: () => `${plural(state.shelves.length, 'Regal', 'Regale')} · ${plural(state.zones.length, 'Stellplatz', 'Stellplätze')}`,
  overview,
  bind(root) {
    bindRows(root);
    enableReorder(root, reorderBoxes);
    root.addEventListener('click', (e) => {
      if (!e.target.closest('[data-action="exit-demo"]')) return;
      try {
        setDemo(false);
      } catch (err) {
        alertDialog({ title: 'Geht gerade nicht', message: err.message });
      }
    });
  },
});

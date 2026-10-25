// First launch: explain the idea in a few lines, then describe the stockroom –
// each shelf with its own number of levels, plus spots outside the shelves.

import { html, icon, toast, alertDialog } from '../ui.js';
import { catAttrs, stepper } from '../components.js';
import { setupCellar, setDemo, shelfLetter, MAX_LEVELS, ZONE_SUGGESTIONS } from '../store.js';
import { plural } from '../format.js';
import { switchTab, refresh, navigate } from '../router.js';
import { syncConfigured } from '../sync.js';

const setup = { levels: [5, 5, 4], zones: new Set(['Kühlschrank (2–8 °C)', 'Sperrlager']) };

const FEATURES = [
  ['tag', 'blue', 'Nummer drauf', 'Jede Kiste und jedes große Einzelstück bekommt eine feste Nummer mit QR-Code.'],
  ['shelves', 'orange', 'Platz zuweisen', 'Jeder Regalboden hat eine Adresse wie „B3“, freie Stellplätze heißen S1, S2 …'],
  ['search', 'green', 'Sofort finden', 'Tippe „Ibuprofen“ oder eine PZN und sieh, wo die Kiste steht.'],
  ['calendar', 'red', 'Verfall im Blick', 'Die App zeigt, was bald abläuft – für die monatliche Verfallskontrolle.'],
];

export default {
  title: 'Willkommen',
  hideTabbar: true,
  render() {
    const total = setup.levels.reduce((a, b) => a + b, 0);
    return html`
      <main class="page welcome">
        <img class="app-icon" src="icons/icon.svg" alt="" width="96" height="96">
        <h1>Willkommen bei Fundort</h1>
        <p class="lead center">Ordnung im Apothekenlager – mit Nummern, Etiketten und einer App, die sich alles merkt.</p>

        <div class="features">
          ${FEATURES.map(
            ([ic, color, t, d]) => html`
              <div class="feature">
                <span class="feature-icon" ${catAttrs(color)}>${icon(ic)}</span>
                <div><h3>${t}</h3><p>${d}</p></div>
              </div>`,
          )}
        </div>

        <h3 class="section-head">Deine Regale</h3>
        <div class="list">
          <div class="cell"><span class="cell-title grow">Anzahl Regale</span>${stepper({ name: 'count', value: setup.levels.length, min: 0, max: 26 })}</div>
        </div>
        ${setup.levels.length
          ? html`
            <h3 class="section-head">Böden pro Regal</h3>
            <div class="list">
              ${setup.levels.map(
                (n, i) => html`
                  <div class="cell">
                    <span class="shelf-letter sm">${shelfLetter(i)}</span>
                    <span class="cell-title grow">Regal ${shelfLetter(i)}</span>
                    ${stepper({ name: `levels-${i}`, value: n, min: 1, max: MAX_LEVELS })}
                  </div>`,
              )}
            </div>
            <p class="section-foot">Jedes Regal kann unterschiedlich viele Böden haben – zusammen ${plural(total, 'Boden', 'Böden')}. Gezählt wird von oben nach unten.</p>`
          : ''}

        <h3 class="section-head">Stellplätze ohne Regal</h3>
        <div class="chips">
          ${ZONE_SUGGESTIONS.map(
            (name) => html`<button type="button" class="chip zone-chip" data-zone-name="${name}" aria-pressed="${String(setup.zones.has(name))}">${icon(setup.zones.has(name) ? 'check' : 'plus')}${name}</button>`,
          )}
        </div>
        <p class="section-foot">Für Kühlware, Sperrware oder Großes wie Rollatoren und Aufsteller. Eigene Stellplätze kannst du später unter „Mehr → Lagerorte“ anlegen.</p>

        <div class="welcome-actions">
          <button class="btn" data-action="setup">Lager einrichten</button>
          ${syncConfigured() ? html`<button class="btn secondary" data-action="join">${icon('people')} Einem Team beitreten</button>` : ''}
          <button class="btn plain" data-action="demo">${icon('sparkles')} Erst im Demo-Modus ausprobieren</button>
        </div>
      </main>`;
  },
  mount(root) {
    root.addEventListener('click', (e) => {
      const step = e.target.closest('[data-step]');
      if (step) {
        const s = step.closest('[data-stepper]');
        const delta = Number(step.dataset.step);
        if (s.dataset.stepper === 'count') {
          if (delta > 0) setup.levels.push(setup.levels.at(-1) ?? 5);
          else setup.levels.pop();
        } else {
          const i = Number(s.dataset.stepper.split('-')[1]);
          setup.levels[i] = Math.max(1, Math.min(MAX_LEVELS, setup.levels[i] + delta));
        }
        return refresh();
      }
      const zone = e.target.closest('[data-zone-name]')?.dataset.zoneName;
      if (zone) {
        setup.zones.has(zone) ? setup.zones.delete(zone) : setup.zones.add(zone);
        return refresh();
      }
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'setup') {
        setupCellar(setup.levels, ZONE_SUGGESTIONS.filter((name) => setup.zones.has(name)));
        switchTab('/');
        toast('Lager eingerichtet');
      }
      if (action === 'join') return navigate('/mehr/haushalt');
      if (action === 'demo') {
        try {
          setDemo(true);
        } catch (err) {
          alertDialog({ title: 'Geht gerade nicht', message: err.message });
        }
      }
    });
  },
};

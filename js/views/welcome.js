// First launch: explain the idea in three lines and set up the shelves.

import { html, icon, toast } from '../ui.js';
import { catAttrs, stepper } from '../components.js';
import { setupCellar, loadDemo, MAX_LEVELS } from '../store.js';
import { plural } from '../format.js';
import { switchTab, refresh } from '../router.js';

const setup = { shelves: 4, levels: 5 };

const FEATURES = [
  ['tag', 'blue', 'Etikett drauf', 'Jede Kiste bekommt eine feste Nummer mit QR-Code.'],
  ['shelves', 'orange', 'Platz zuweisen', 'Jeder Regalboden hat eine Adresse wie „B3“.'],
  ['search', 'green', 'Sofort finden', 'Tippe „Lichterkette“ und sieh, in welcher Kiste sie liegt.'],
];

export default {
  title: 'Willkommen',
  hideTabbar: true,
  render() {
    return html`
      <main class="page welcome">
        <img class="app-icon" src="icons/icon.svg" alt="" width="96" height="96">
        <h1>Willkommen bei Fundort</h1>
        <p class="lead center">Ordnung im Keller – mit Nummern, Etiketten und einer App, die sich alles merkt.</p>

        <div class="features">
          ${FEATURES.map(
            ([ic, color, t, d]) => html`
              <div class="feature">
                <span class="feature-icon" ${catAttrs(color)}>${icon(ic)}</span>
                <div><h3>${t}</h3><p>${d}</p></div>
              </div>`,
          )}
        </div>

        <h3 class="section-head">Dein Keller</h3>
        <div class="list">
          <div class="cell"><span class="cell-title grow">Regale</span>${stepper({ name: 'shelves', value: setup.shelves, min: 1, max: 26 })}</div>
          <div class="cell"><span class="cell-title grow">Böden pro Regal</span>${stepper({ name: 'levels', value: setup.levels, min: 1, max: MAX_LEVELS })}</div>
        </div>
        <p class="section-foot">Ergibt ${plural(setup.shelves * setup.levels, 'Boden', 'Böden')} von A1 bis ${String.fromCharCode(64 + setup.shelves)}${setup.levels}. Unterschiedlich hohe Regale kannst du später einzeln anpassen.</p>

        <div class="welcome-actions">
          <button class="btn" data-action="setup">Keller einrichten</button>
          <button class="btn plain" data-action="demo">${icon('sparkles')} Erst mit Beispieldaten ausprobieren</button>
        </div>
      </main>`;
  },
  mount(root) {
    root.addEventListener('click', async (e) => {
      const step = e.target.closest('[data-step]');
      if (step) {
        const s = step.closest('[data-stepper]');
        const key = s.dataset.stepper;
        setup[key] = Math.max(Number(s.dataset.min), Math.min(Number(s.dataset.max), setup[key] + Number(step.dataset.step)));
        return refresh();
      }
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'setup') {
        setupCellar(setup.shelves, setup.levels);
        switchTab('/');
        toast('Keller eingerichtet');
      }
      if (action === 'demo') {
        await loadDemo();
        switchTab('/');
        toast('Beispielkeller geladen', 'sparkles');
      }
    });
  },
};

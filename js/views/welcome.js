// First launch: explain the idea in three lines, then describe the cellar –
// each shelf with its own number of levels, plus spots outside the shelves.

import { html, raw, icon, toast } from '../ui.js';
import { catAttrs, stepper } from '../components.js';
import { setupCellar, loadDemo, shelfLetter, MAX_LEVELS, ZONE_SUGGESTIONS } from '../store.js';
import { plural } from '../format.js';
import { switchTab, refresh, navigate } from '../router.js';
import { syncConfigured } from '../sync.js';

const setup = { levels: [5, 5, 4], zones: new Set(['Unter der Treppe']) };

// A shelf with numbered boxes, drawn in the app's colours (css .ill-*).
const ILLUSTRATION = raw(`
<svg class="ill" viewBox="0 0 320 212" aria-hidden="true">
  <rect class="ill-shadow" x="18" y="202" width="292" height="8" rx="4"/>
  <rect class="ill-frame" x="22" y="6" width="10" height="198" rx="2"/>
  <rect class="ill-frame" x="296" y="6" width="10" height="198" rx="2"/>

  <rect class="ill-box" x="44" y="22" width="94" height="50" rx="3"/>
  <path class="ill-lid" d="M44 34h94"/>
  <rect class="ill-tape" x="80" y="16" width="26" height="10" transform="rotate(5 93 21)"/>
  <rect class="ill-paper" x="56" y="42" width="46" height="22" rx="2"/>
  <rect class="ill-stripe c1" x="59" y="45" width="3.5" height="16" rx="1"/>
  <text class="ill-num" x="66" y="58">001</text>
  <rect class="ill-box" x="146" y="36" width="66" height="36" rx="3"/>
  <path class="ill-lid" d="M146 46h66"/>
  <rect class="ill-paper" x="154" y="51" width="40" height="17" rx="2"/>
  <rect class="ill-stripe c2" x="157" y="53.5" width="3" height="12" rx="1"/>
  <text class="ill-num sm" x="163" y="64">002</text>
  <rect class="ill-free" x="222" y="30" width="62" height="40" rx="4"/>
  <path class="ill-plus" d="M253 42v16M245 50h16"/>
  <rect class="ill-board" x="32" y="72" width="264" height="8"/>

  <rect class="ill-box" x="46" y="92" width="74" height="44" rx="3"/>
  <path class="ill-lid" d="M46 103h74"/>
  <rect class="ill-paper" x="56" y="110" width="44" height="20" rx="2"/>
  <rect class="ill-stripe c3" x="59" y="112.5" width="3.5" height="15" rx="1"/>
  <text class="ill-num" x="66" y="125">007</text>
  <circle class="ill-tag" cx="152" cy="118" r="17"/>
  <circle class="ill-eyelet" cx="152" cy="108" r="3"/>
  <text class="ill-num sm" x="141" y="126">021</text>
  <rect class="ill-box" x="184" y="84" width="100" height="52" rx="3"/>
  <path class="ill-lid" d="M184 96h100"/>
  <rect class="ill-paper" x="196" y="104" width="46" height="22" rx="2"/>
  <rect class="ill-stripe c4" x="199" y="107" width="3.5" height="16" rx="1"/>
  <text class="ill-num" x="206" y="120">012</text>
  <rect class="ill-board" x="32" y="136" width="264" height="8"/>

  <rect class="ill-box" x="44" y="150" width="116" height="50" rx="3"/>
  <path class="ill-lid" d="M44 162h116"/>
  <rect class="ill-paper" x="58" y="170" width="46" height="22" rx="2"/>
  <rect class="ill-stripe c5" x="61" y="173" width="3.5" height="16" rx="1"/>
  <text class="ill-num" x="68" y="186">015</text>
  <rect class="ill-plate" x="236" y="164" width="44" height="30" rx="5"/>
  <text class="ill-plate-text" x="245" y="184">C3</text>
  <rect class="ill-board" x="32" y="200" width="264" height="8"/>
</svg>`);

const FEATURES = [
  ['tag', 'teal', 'Nummer drauf', 'Jede Kiste und jedes große Einzelstück bekommt eine feste Nummer mit QR-Code.'],
  ['shelves', 'brown', 'Platz zuweisen', 'Jeder Regalboden hat eine Adresse wie „B3“, freie Stellplätze heißen S1, S2 …'],
  ['search', 'orange', 'Sofort finden', 'Tippe „Lichterkette“ und sieh, wo sie liegt.'],
];

export default {
  title: 'Willkommen',
  hideTabbar: true,
  render() {
    const total = setup.levels.reduce((a, b) => a + b, 0);
    return html`
      <main class="page welcome">
        <div class="welcome-brand"><img class="app-icon" src="icons/icon.svg" alt="" width="48" height="48"><span>Fundort</span></div>
        <h1>Alles hat seinen Platz.</h1>
        <p class="lead">Ordnung im Keller – mit Nummern, Etiketten und einer App, die sich merkt, was wo steht.</p>
        ${ILLUSTRATION}

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
        <p class="section-foot">Für Großes wie Weihnachtsbaum, Koffer oder Kinderwagen. Eigene Stellplätze kannst du später unter „Mehr → Lagerorte“ anlegen.</p>

        <div class="welcome-actions">
          <button class="btn" data-action="setup">Keller einrichten</button>
          ${syncConfigured() ? html`<button class="btn secondary" data-action="join">${icon('person')} Anmelden &amp; Haushalt beitreten</button>` : ''}
          <button class="btn plain" data-action="demo">${icon('sparkles')} Erst mit Beispieldaten ausprobieren</button>
        </div>
      </main>`;
  },
  mount(root) {
    root.addEventListener('click', async (e) => {
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
        toast('Keller eingerichtet');
      }
      if (action === 'join') return navigate('/mehr/haushalt');
      if (action === 'demo') {
        await loadDemo();
        switchTab('/');
        toast('Beispielkeller geladen', 'sparkles');
      }
    });
  },
};

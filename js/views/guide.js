// "Das Fundort-System": the method behind the app, in the app.

import { html, raw, icon } from '../ui.js';
import { navBar, largeTitle, catAttrs } from '../components.js';
import { state } from '../store.js';
import { qrSVG, boxCode } from '../qr.js';

const RULES = [
  {
    n: 1,
    color: 'blue',
    iconName: 'shelves',
    title: 'Jeder Platz hat eine Adresse',
    text: 'Regale bekommen Buchstaben – A, B, C … links neben der Tür beginnend, einmal rundherum. Ihre Böden werden von oben nach unten gezählt, jedes Regal so weit, wie es Böden hat. „B3“ heißt: Regal B, dritter Boden von oben.',
  },
  {
    n: 2,
    color: 'green',
    iconName: 'zone',
    title: 'Was nicht ins Regal passt, bekommt einen Stellplatz',
    text: 'Feste Plätze außerhalb der Regale heißen S1, S2 … – zum Beispiel „Unter der Treppe“, „Wandhaken“ oder auch „Garage“. Ein Etikett an der Wand oder auf dem Boden markiert sie.',
  },
  {
    n: 3,
    color: 'orange',
    iconName: 'tag',
    title: 'Alles bekommt eine Nummer',
    text: 'Kisten und große Einzelstücke ohne Kiste – Weihnachtsbaum, Koffer, Kinderwagen – bekommen fortlaufend 001, 002, 003 … Die Nummer bleibt für immer. Aufs Etikett kommen nur Nummer, Farbe und QR-Code; bei Einzelstücken als Aufkleber oder Anhänger.',
  },
  {
    n: 4,
    color: 'indigo',
    iconName: 'search',
    title: 'Die App merkt sich den Rest',
    text: 'Foto, Inhalt bzw. Titel und Platz stehen in der App. Gesucht wird am Handy, nicht im Regal: „Lichterkette“ eintippen und sehen, dass sie in Kiste 002 auf A1 liegt.',
  },
];

const DAY = [
  ['Regale und Stellplätze beschriften', 'Unter „Etiketten → Regale & Plätze“ drucken. Je ein Etikett mittig an die Vorderkante jedes Bodens, Stellplatz-Etiketten an die Wand oder auf den Boden.'],
  ['Nummern vorab drucken', 'Unter „Etiketten → Nummern“ z. B. 001–024. Die Etiketten passen für Kisten und Einzelstücke.'],
  ['Stück für Stück erfassen', 'Etikett auf die Stirnseite kleben (bei Einzelstücken gut sichtbar oder als Anhänger), scannen, „Kiste“ oder „Einzelstück“ tippen und ein Foto machen. Bei Kisten 3–10 Stichworte zum Inhalt eintippen, bei Einzelstücken nur einen Titel.'],
  ['Einlagern', 'Ins Regal oder auf den Stellplatz stellen und dessen Etikett scannen. Fertig – die App weiß jetzt, wo es steht.'],
  ['Gleich aussortieren', 'Was du beim Durchsehen nicht mehr brauchst, kommt in eine Kiste „Spenden“ oder „Weg“ – nicht zurück ins Regal.'],
];

const HABITS = [
  ['weight', 'brown', 'Schweres nach unten', 'Werkzeug, Dokumente und Bücher auf die unteren Böden, Leichtes nach oben.'],
  ['eye', 'blue', 'Häufiges auf Augenhöhe', 'Was du oft brauchst, gehört auf einen mittleren Boden und nach vorne.'],
  ['item', 'indigo', 'Großes an feste Stellplätze', 'Weihnachtsbaum, Koffer & Co. bekommen einen eigenen Stellplatz, statt im Weg zu stehen. Hohe Teile passen oft auf den untersten Boden.'],
  ['calendar', 'red', 'Saisonal tauschen', 'Im Herbst rücken Weihnachtskisten nach vorn, im Frühjahr Ostern und Garten.'],
  ['move', 'green', 'Raus = austragen', 'Nimmst du etwas mit nach oben, markiere es als „Entnommen“. Zurück: Nummer und Platz scannen.'],
  ['tag', 'orange', 'Etikett zum Gang', 'Immer auf die Seite, die man im Regal sieht. Bei Stapeln auf jede Kiste einzeln.'],
  ['box', 'teal', 'Gleiche Kisten', 'Stapelbare Boxen mit Deckel (z. B. 45–60 l) schützen vor Staub und Feuchtigkeit und nutzen den Platz besser.'],
  ['refresh', 'purple', 'Einmal im Jahr Keller-Check', 'Alles „Ohne Platz“ auflösen, Inhalte kurz prüfen, Unbenutztes aussortieren.'],
  ['people', 'pink', 'Alle machen mit', 'Die App auf allen Handys im Haushalt installieren und ein gemeinsames Backup teilen.'],
];

export default {
  title: 'Das System',
  render() {
    return html`
      ${navBar({ title: 'Das System', back: '/mehr' })}
      <main class="page guide">
        ${largeTitle('Das Fundort-System', 'Vier Regeln für einen Keller, in dem man alles wiederfindet.')}

        <div class="rule-stack">
          ${RULES.map(
            (r) => html`
              <section class="card rule">
                <span class="rule-icon" ${catAttrs(r.color)}>${icon(r.iconName)}</span>
                <div>
                  <span class="rule-n">Regel ${r.n}</span>
                  <h2>${r.title}</h2>
                  <p>${r.text}</p>
                </div>
              </section>`,
          )}
        </div>

        <section class="card example">
          <div class="example-label">
            <span class="example-stripe"></span>
            <span class="example-kicker">Weihnachten</span>
            <span class="example-num">042</span>
            <span class="example-qr">${raw(qrSVG(boxCode(42)))}</span>
          </div>
          <p><strong>So sieht ein Etikett aus.</strong> Groß die Nummer, die Farbe zeigt die Kategorie, der QR-Code öffnet die Kiste in der App.</p>
        </section>

        <h2 class="title2">Der Einräum-Tag</h2>
        <p class="lead">Rechne mit 1–2 Minuten pro Stück. Zu zweit geht es doppelt so schnell: eine Person räumt, eine tippt.</p>
        <ol class="timeline">
          ${DAY.map(([t, d], i) => html`<li><span class="tl-n">${i + 1}</span><div><h3>${t}</h3><p>${d}</p></div></li>`)}
        </ol>

        <h2 class="title2">Gute Gewohnheiten</h2>
        <div class="list">
          ${HABITS.map(
            ([ic, color, t, d]) => html`
              <div class="cell habit">
                <span class="icon-tile" ${catAttrs(color)}>${icon(ic)}</span>
                <span class="cell-text"><span class="cell-title">${t}</span><span class="cell-sub wrap">${d}</span></span>
              </div>`,
          )}
        </div>

        <h2 class="title2">Farben</h2>
        <p class="lead">Die Farbe einer Kategorie wird als Streifen aufs Etikett gedruckt. Druckst du schwarz-weiß, helfen farbige Klebepunkte.</p>
        <div class="card pad legend">
          ${state.categories.map((c) => html`<span class="legend-item" ${catAttrs(c.color)}><span class="dot"></span>${c.name}</span>`)}
        </div>

        <a class="btn spaced" href="#/etiketten">${icon('printer')} Etiketten drucken</a>
      </main>`;
  },
};

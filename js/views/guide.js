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
    title: 'Jeder Boden hat eine Adresse',
    text: 'Regale bekommen Buchstaben – A, B, C … links neben der Tür beginnend, einmal rundherum. Böden werden von oben nach unten gezählt. „B3“ heißt: Regal B, dritter Boden von oben.',
  },
  {
    n: 2,
    color: 'orange',
    iconName: 'tag',
    title: 'Jede Kiste hat eine Nummer',
    text: 'Fortlaufend 001, 002, 003 … Die Nummer bleibt für immer, auch wenn die Kiste umzieht oder sich der Inhalt ändert. Aufs Etikett kommen deshalb nur Nummer, Farbe und QR-Code – kein Inhalt.',
  },
  {
    n: 3,
    color: 'green',
    iconName: 'search',
    title: 'Die App merkt sich den Rest',
    text: 'Foto, Stichworte und Platz stehen in der App. Gesucht wird am Handy, nicht im Regal: „Lichterkette“ eintippen und sehen, dass sie in Kiste 002 auf A1 liegt.',
  },
];

const DAY = [
  ['Regale beschriften', 'Unter „Etiketten → Regale & Böden“ drucken und je ein Etikett mittig an die Vorderkante jedes Bodens kleben.'],
  ['Kisten-Etiketten vorab drucken', 'Unter „Etiketten → Kisten“ z. B. 001–024. So hast du beim Einräumen immer das nächste Etikett zur Hand.'],
  ['Kiste für Kiste erfassen', 'Etikett auf die Stirnseite kleben, scannen, „Erfassen“ tippen, ein Foto vom offenen Inhalt machen und 3–10 Stichworte eintippen.'],
  ['Einlagern', 'Kiste ins Regal stellen und das Boden-Etikett scannen. Fertig – die App weiß jetzt, wo sie steht.'],
  ['Gleich aussortieren', 'Was du beim Durchsehen nicht mehr brauchst, kommt in eine Kiste „Spenden“ oder „Weg“ – nicht zurück ins Regal.'],
];

const HABITS = [
  ['weight', 'brown', 'Schweres nach unten', 'Werkzeug, Dokumente und Bücher auf die unteren Böden, Leichtes nach oben.'],
  ['eye', 'blue', 'Häufiges auf Augenhöhe', 'Was du oft brauchst, gehört auf Boden 2 oder 3 und nach vorne.'],
  ['calendar', 'red', 'Saisonal tauschen', 'Im Herbst rücken Weihnachtskisten nach vorn, im Frühjahr Ostern und Garten.'],
  ['move', 'green', 'Raus = austragen', 'Nimmst du eine Kiste mit nach oben, markiere sie als „Entnommen“. Zurück ins Regal: Kiste und Boden scannen.'],
  ['tag', 'orange', 'Etikett zum Gang', 'Immer auf die Seite, die man im Regal sieht. Bei Stapeln auf jede Kiste einzeln.'],
  ['box', 'indigo', 'Gleiche Kisten', 'Stapelbare Boxen mit Deckel (z. B. 45–60 l) schützen vor Staub und Feuchtigkeit und nutzen den Platz besser.'],
  ['refresh', 'purple', 'Einmal im Jahr Keller-Check', 'Kisten „Ohne Platz“ auflösen, Inhalte kurz prüfen, Unbenutztes aussortieren.'],
  ['people', 'teal', 'Alle machen mit', 'Die App auf allen Handys im Haushalt installieren und ein gemeinsames Backup teilen.'],
];

export default {
  title: 'Das System',
  render() {
    return html`
      ${navBar({ title: 'Das System', back: '/mehr' })}
      <main class="page guide">
        ${largeTitle('Das Fundort-System', 'Drei Regeln für einen Keller, in dem man alles wiederfindet.')}

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
        <p class="lead">Rechne mit 1–2 Minuten pro Kiste. Zu zweit geht es doppelt so schnell: eine Person räumt, eine tippt.</p>
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

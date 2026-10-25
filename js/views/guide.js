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
    title: 'Was nicht ins Regal gehört, bekommt einen Stellplatz',
    text: 'Feste Plätze außerhalb der Regale heißen S1, S2 … – zum Beispiel „Kühlschrank“, „Sperrlager“ oder „Keller“. Ein Etikett an der Tür, an der Wand oder auf dem Boden markiert sie.',
  },
  {
    n: 3,
    color: 'orange',
    iconName: 'tag',
    title: 'Alles bekommt eine Nummer',
    text: 'Kisten und Einzelstücke ohne Kiste – Rollator, Aufsteller, Leihgeräte – bekommen fortlaufend 001, 002, 003 … Die Nummer bleibt für immer. Aufs Etikett kommen nur Nummer, Farbe und QR-Code; bei Einzelstücken als Aufkleber oder Anhänger.',
  },
  {
    n: 4,
    color: 'indigo',
    iconName: 'search',
    title: 'Die App merkt sich den Rest',
    text: 'Inhalt, Verfall, Foto und Platz stehen in der App. Gesucht wird am Handy, nicht im Regal: „Ibuprofen“ eintippen und sehen, dass es in Kiste 001 auf A1 steht.',
  },
];

const DAY = [
  ['Regale und Stellplätze beschriften', 'Unter „Etiketten → Regale & Plätze“ drucken. Je ein Etikett mittig an die Vorderkante jedes Bodens, Stellplatz-Etiketten an Kühlschrank, Sperrlager oder Wand.'],
  ['Nummern vorab drucken', 'Unter „Etiketten → Nummern“ z. B. 001–024. Die Etiketten passen für Kisten und Einzelstücke.'],
  ['Stück für Stück erfassen', 'Etikett auf die Stirnseite kleben, scannen, „Kiste“ oder „Einzelstück“ tippen und ein Foto machen. Bei Kisten die Artikel eintippen und den frühesten Verfall, bei Einzelstücken nur einen Titel.'],
  ['Einlagern', 'Ins Regal oder auf den Stellplatz stellen und dessen Etikett scannen. Fertig – die App weiß jetzt, wo es steht.'],
  ['Gleich aussondern', 'Abgelaufenes, Beschädigtes und Retouren kommen sofort ins Sperrlager – als eigene Kiste erfasst, nicht zurück ins Regal.'],
];

const HABITS = [
  ['calendar', 'red', 'Verfall beim Einlagern eintragen', 'Bei gemischten Kisten zählt der früheste Artikel. Was bald abläuft, zeigt die App unter „Verfall“ im Lager.'],
  ['refresh', 'purple', 'Monatliche Verfallskontrolle', 'Einmal im Monat „Verfall“ öffnen: Kurzläufer vorziehen, abverkaufen, retournieren oder aussondern.'],
  ['eye', 'blue', 'Kurzläufer nach vorn', 'Was zuerst abläuft, steht vorne und wird zuerst verbraucht (First Expired, First Out).'],
  ['warning', 'orange', 'Sperrware klar trennen', 'Retouren, Rückrufe und Beanstandungen gehören auf den Stellplatz „Sperrlager“ – deutlich getrennt von verkehrsfähiger Ware.'],
  ['move', 'green', 'Raus = austragen', 'Holst du eine Kiste in die Offizin oder verleihst ein Gerät, markiere es als „Nicht im Lager“. Zurück: Nummer und Platz scannen.'],
  ['weight', 'brown', 'Schweres nach unten', 'Flüssigkeiten, Großpackungen und schwere Kartons auf die unteren Böden, Leichtes nach oben.'],
  ['tag', 'teal', 'Etikett zum Gang', 'Immer auf die Seite, die man im Regal sieht. Bei Stapeln auf jede Kiste einzeln.'],
  ['hand', 'pink', 'Keine Patientendaten', 'Namen, Bestellungen oder Rezepte von Kundinnen und Kunden gehören nicht in Fundort – Leihgeräte nur mit Leihschein-Nummer aus der Warenwirtschaft.'],
  ['book', 'gray', 'Ergänzt, ersetzt nicht', 'Bestände, BtM-Dokumentation und Temperaturprotokolle bleiben in Warenwirtschaft und vorgeschriebenen Systemen. Fundort zeigt, wo etwas steht.'],
  ['people', 'indigo', 'Das ganze Team macht mit', 'Die App auf den Geräten im Team installieren und „Gemeinsam nutzen“ einrichten. Wer etwas umlagert, scannt kurz mit.'],
];

export default {
  title: 'Das System',
  render() {
    return html`
      ${navBar({ title: 'Das System', back: '/mehr' })}
      <main class="page guide">
        ${largeTitle('Das Fundort-System', 'Vier Regeln für ein Lager, in dem man alles wiederfindet.')}

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
            <span class="example-kicker">Überbestand</span>
            <span class="example-num">042</span>
            <span class="example-qr">${raw(qrSVG(boxCode(42)))}</span>
          </div>
          <p><strong>So sieht ein Etikett aus.</strong> Groß die Nummer, die Farbe zeigt die Kategorie, der QR-Code öffnet die Kiste in der App.</p>
        </section>

        <h2 class="title2">Der Einrichtungstag</h2>
        <p class="lead">Rechne mit 1–2 Minuten pro Stück. Zu zweit geht es doppelt so schnell: eine Person räumt, eine tippt – gut für einen ruhigen Nachmittag oder nach Ladenschluss.</p>
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

// Printable label sheets (A4) for numbered entries and for places.
// Number labels carry only number, QR code and (optionally) category and
// title – what is inside lives in the app, so a label never needs rewriting.

import { html, raw, icon, openSheet } from '../ui.js';
import { navBar, largeTitle, toggleRow, stepper, badge } from '../components.js';
import { state, sortedBoxes, categoryById, nextNumber, setMeta, COLOR_HEX } from '../store.js';
import { pad, boxTitle, kindOf, plural, unitsLabel } from '../format.js';
import { qrSVG, boxCode, levelCode, shelfCode, zoneCode } from '../qr.js';
import { refresh } from '../router.js';

const FORMATS = {
  large: { label: 'Groß', size: '105 × 74 mm', perPage: 8, hint: '8 pro A4-Bogen · gut lesbar aus 3 m' },
  small: { label: 'Klein', size: '70 × 37 mm', perPage: 24, hint: '24 pro A4-Bogen · auch als Anhänger' },
};

const opts = {
  mode: 'boxes', // 'boxes' (number labels) | 'places' (levels, shelf signs, zones)
  source: 'new', // 'new' | 'existing'
  from: null, // first number for new labels; null = next free
  sheets: 1,
  ids: null, // Set of entry ids to print, null = all
  shelves: null, // Set of shelf ids, null = all
  zones: null, // Set of zone ids, null = all
  signs: true,
  format: 'large',
  titles: false,
  cutLines: true,
  skip: 0,
};

export function presetLabels({ mode, source, ids, shelves, zones, signs }) {
  opts.mode = mode;
  if (source) opts.source = source;
  if (ids) opts.ids = new Set(ids);
  if (shelves) opts.shelves = new Set(shelves);
  if (zones) opts.zones = new Set(zones);
  if (signs != null) opts.signs = signs;
}

const fromNumber = () => opts.from ?? Math.max(nextNumber(), state.meta.printedUpTo + 1);
const selectedBoxes = () => sortedBoxes().filter((b) => !opts.ids || opts.ids.has(b.id));
const selectedShelves = () => state.shelves.filter((s) => !opts.shelves || opts.shelves.has(s.id));
const selectedZones = () => state.zones.filter((z) => !opts.zones || opts.zones.has(z.id));
const newCount = () => Math.max(0, opts.sheets * FORMATS[opts.format].perPage - opts.skip);

// ---------------------------------------------------------------------------
// Label markup (sizes in mm, see css "Labels")

function numberLabel({ number, kicker, title = '', color = null }) {
  return html`
    <div class="lbl lbl-box ${number > 999 ? 'n4' : ''}" style="--cat:${color ? COLOR_HEX[color] : '#1d1d1f'}">
      <span class="lbl-stripe"></span>
      <span class="lbl-kicker">${kicker}</span>
      <span class="lbl-num">${pad(number)}</span>
      <span class="lbl-title">${title}</span>
      <span class="lbl-qr">${raw(qrSVG(boxCode(number)))}</span>
    </div>`;
}

function levelLabel(shelf, level) {
  const n = shelf.levels;
  const where = n === 1 ? 'einziger Boden' : level === 1 ? `oberster von ${n}` : level === n ? `unterster von ${n}` : `${level}. von ${n}, von oben`;
  return html`
    <div class="lbl lbl-level">
      <span class="lbl-kicker">Regal ${shelf.id} · Boden ${level}</span>
      <span class="lbl-num">${shelf.id}${level}</span>
      <span class="lbl-title">${where}</span>
      <span class="lbl-diagram">${Array.from({ length: n }, (_, i) => html`<i class="${i + 1 === level ? 'on' : ''}"></i>`)}</span>
      <span class="lbl-qr">${raw(qrSVG(levelCode(shelf.id, level)))}</span>
    </div>`;
}

function shelfSign(shelf) {
  return html`
    <div class="lbl lbl-sign">
      <span class="lbl-kicker">Regal</span>
      <span class="lbl-num">${shelf.id}</span>
      <span class="lbl-title">${shelf.note || plural(shelf.levels, 'Boden', 'Böden')}</span>
      <span class="lbl-qr">${raw(qrSVG(shelfCode(shelf.id)))}</span>
    </div>`;
}

function zoneLabel(zone) {
  return html`
    <div class="lbl lbl-zone">
      <span class="lbl-kicker">Stellplatz</span>
      <span class="lbl-num">${zone.id}</span>
      <span class="lbl-title">${zone.name}</span>
      <span class="lbl-qr">${raw(qrSVG(zoneCode(zone.id)))}</span>
    </div>`;
}

function collect() {
  if (opts.mode === 'places') {
    return [
      ...selectedShelves().flatMap((s) => [
        ...(opts.signs ? [shelfSign(s)] : []),
        ...Array.from({ length: s.levels }, (_, i) => levelLabel(s, i + 1)),
      ]),
      ...selectedZones().map(zoneLabel),
    ];
  }
  if (opts.source === 'new') {
    const from = fromNumber();
    return Array.from({ length: newCount() }, (_, i) => numberLabel({ number: from + i, kicker: 'Nummer' }));
  }
  return selectedBoxes().map((b) => {
    const cat = categoryById(b.category);
    return numberLabel({ number: b.number, kicker: cat?.name ?? kindOf(b).name, title: opts.titles ? b.title : '', color: cat?.color });
  });
}

function pages(labels) {
  const per = FORMATS[opts.format].perPage;
  const cells = [...Array.from({ length: opts.skip }, () => html`<div class="lbl lbl-blank"></div>`), ...labels];
  const out = [];
  for (let i = 0; i < cells.length; i += per) {
    out.push(html`<div class="a4 fmt-${opts.format} ${opts.cutLines ? 'cut' : ''}">${cells.slice(i, i + per)}</div>`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Options UI

const radioRow = ({ attr, value, current, title, sub, disabled = false, lead = '' }) => html`
  <button type="button" class="cell radio-row" ${raw(`${attr}="${value}"`)} aria-pressed="${String(current === value)}" ${disabled ? raw('disabled') : ''}>
    ${lead}
    <span class="cell-text"><span class="cell-title">${title}</span><span class="cell-sub">${sub}</span></span>
    ${current === value ? icon('check', 'check') : ''}
  </button>`;

const checkRow = ({ attr, id, checked, lead, title, sub }) => html`
  <label class="cell toggle-row">
    ${lead}
    <span class="cell-text"><span class="cell-title">${title}</span><span class="cell-sub">${sub}</span></span>
    <input type="checkbox" class="check" ${raw(`${attr}="${id}"`)} ${checked ? raw('checked') : ''} aria-label="${title}">
  </label>`;

function boxOptions() {
  const total = state.boxes.length;
  const from = fromNumber();
  const n = newCount();
  return html`
    <h3 class="section-head">Was drucken?</h3>
    <div class="list">
      ${radioRow({ attr: 'data-source', value: 'new', current: opts.source, title: 'Neue Nummern', sub: 'Vorab drucken, beim Einräumen aufkleben' })}
      ${radioRow({
        attr: 'data-source', value: 'existing', current: opts.source, title: 'Bereits erfasst',
        sub: total ? `${unitsLabel(state.boxes)} in der App` : 'Noch nichts erfasst', disabled: !total,
      })}
    </div>
    ${opts.source === 'new'
      ? html`
        <div class="list">
          <label class="cell field">
            <span class="field-label">Ab Nummer</span>
            <input name="from" inputmode="numeric" pattern="[0-9]*" value="${pad(from)}" aria-label="Erste Nummer">
          </label>
          <div class="cell"><span class="cell-title grow">Bögen</span>${stepper({ name: 'sheets', value: opts.sheets, min: 1, max: 10 })}</div>
        </div>
        <p class="section-foot">${n ? `Druckt ${pad(from)} bis ${pad(from + n - 1)}. Danach geht es automatisch bei ${pad(from + n)} weiter. Die Etiketten passen für Kisten und Einzelstücke.` : 'Keine freien Felder auf dem Bogen.'}</p>`
      : html`
        <div class="list">
          <button type="button" class="cell" data-action="choose-boxes">
            <span class="cell-title grow">Auswahl</span>
            <span class="cell-detail">${selectedBoxes().length} von ${total}</span>${icon('chevron', 'chev')}
          </button>
          ${toggleRow({ name: 'titles', label: 'Titel aufdrucken', sub: 'Besser aus, wenn sich der Inhalt ändern kann', checked: opts.titles })}
        </div>`}`;
}

function placeOptions() {
  return html`
    ${state.shelves.length
      ? html`
        <h3 class="section-head">Regale</h3>
        <div class="list">
          ${state.shelves.map((s) =>
            checkRow({
              attr: 'data-shelf', id: s.id, checked: !opts.shelves || opts.shelves.has(s.id),
              lead: html`<span class="shelf-letter sm">${s.id}</span>`,
              title: `Regal ${s.id}`, sub: `${s.note ? `${s.note} · ` : ''}${plural(s.levels, 'Boden', 'Böden')}`,
            }),
          )}
        </div>
        <div class="list">
          ${toggleRow({ name: 'signs', label: 'Regal-Schilder', sub: 'Zusätzlich ein großes Schild pro Regal', checked: opts.signs })}
        </div>`
      : ''}
    ${state.zones.length
      ? html`
        <h3 class="section-head">Stellplätze</h3>
        <div class="list">
          ${state.zones.map((z) =>
            checkRow({
              attr: 'data-zone', id: z.id, checked: !opts.zones || opts.zones.has(z.id),
              lead: html`<span class="zone-code sm">${z.id}</span>`,
              title: z.name || `Stellplatz ${z.id}`, sub: `Stellplatz ${z.id}`,
            }),
          )}
        </div>`
      : ''}
    <p class="section-foot">Boden-Etiketten mittig an die Vorderkante kleben (Boden 1 ist immer der oberste). Stellplatz-Etiketten an die Wand oder auf den Boden daneben.</p>`;
}

function chooseBoxes() {
  const picked = new Set(selectedBoxes().map((b) => b.id));
  const rows = () =>
    sortedBoxes().map(
      (b) => html`
        <button type="button" class="cell box-row" data-toggle="${b.id}" aria-pressed="${String(picked.has(b.id))}">
          ${badge(b)}
          <span class="cell-text"><span class="cell-title">${boxTitle(b)}</span></span>
          <span class="checkmark">${icon('check')}</span>
        </button>`,
    );
  openSheet({
    title: 'Auswahl',
    body: html`
      <div class="sheet-tools">
        <button type="button" class="pill-btn tinted" data-all>Alle</button>
        <button type="button" class="pill-btn tinted" data-none>Keine</button>
      </div>
      <div class="list" data-rows>${rows()}</div>`,
    onMount(el) {
      const list = el.querySelector('[data-rows]');
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-toggle]');
        if (t) {
          picked.has(t.dataset.toggle) ? picked.delete(t.dataset.toggle) : picked.add(t.dataset.toggle);
          t.setAttribute('aria-pressed', String(picked.has(t.dataset.toggle)));
        }
        if (e.target.closest('[data-all]')) state.boxes.forEach((b) => picked.add(b.id));
        if (e.target.closest('[data-none]')) picked.clear();
        if (e.target.closest('[data-all], [data-none]')) list.innerHTML = String(rows());
      });
    },
    done() {
      opts.ids = picked.size === state.boxes.length ? null : new Set(picked);
      refresh();
    },
  });
}

function print() {
  const labels = collect();
  if (!labels.length) return;
  const root = document.getElementById('print-root');
  root.innerHTML = String(html`${pages(labels)}`);
  const from = fromNumber();
  const printedNew = opts.mode === 'boxes' && opts.source === 'new' ? from + labels.length - 1 : 0;
  window.addEventListener(
    'afterprint',
    () => {
      root.innerHTML = '';
      if (printedNew) {
        opts.from = null;
        setMeta({ printedUpTo: Math.max(state.meta.printedUpTo, printedNew) });
      }
    },
    { once: true },
  );
  window.print();
}

export default {
  tab: 'labels',
  title: 'Etiketten',

  render() {
    const labels = collect();
    const sheets = pages(labels);
    const fmt = FORMATS[opts.format];
    return html`
      ${navBar({
        title: 'Etiketten',
        right: html`<button class="circle-btn glass" data-action="print" aria-label="Drucken">${icon('printer')}</button>`,
      })}
      <main class="page">
        ${largeTitle('Etiketten', 'Drucken, ausschneiden, aufkleben.')}
        <div class="seg" role="group" aria-label="Etikettenart">
          <button type="button" data-mode="boxes" aria-pressed="${String(opts.mode === 'boxes')}">Nummern</button>
          <button type="button" data-mode="places" aria-pressed="${String(opts.mode === 'places')}">Regale &amp; Plätze</button>
        </div>

        ${opts.mode === 'boxes' ? boxOptions() : placeOptions()}

        <h3 class="section-head">Format</h3>
        <div class="list">
          ${Object.entries(FORMATS).map(([key, f]) =>
            radioRow({ attr: 'data-format', value: key, current: opts.format, title: `${f.label} · ${f.size}`, sub: f.hint, lead: html`<span class="fmt-icon fmt-${key}"></span>` }),
          )}
        </div>

        <h3 class="section-head">Bogen</h3>
        <div class="list">
          ${toggleRow({ name: 'cutLines', label: 'Schnittlinien', sub: 'Für normales Papier – bei Etikettenbögen aus', checked: opts.cutLines })}
          <div class="cell">
            <span class="cell-text grow"><span class="cell-title">Felder überspringen</span><span class="cell-sub">Angebrochenen Bogen weiter nutzen</span></span>
            ${stepper({ name: 'skip', value: opts.skip, min: 0, max: fmt.perPage - 1 })}
          </div>
        </div>

        <h3 class="section-head">Vorschau · ${plural(labels.length, 'Etikett', 'Etiketten')} auf ${plural(sheets.length, 'Seite', 'Seiten')}</h3>
        <div class="preview" data-preview>
          ${sheets.length ? sheets.map((s) => html`<div class="preview-page">${s}</div>`) : html`<div class="card muted-cell">Nichts ausgewählt</div>`}
        </div>

        <button type="button" class="btn" data-action="print" ${labels.length ? '' : raw('disabled')}>${icon('printer')} Drucken</button>
        <p class="section-foot center">Im Druckdialog „Tatsächliche Größe“ bzw. 100 % wählen.</p>
      </main>`;
  },

  mount(root) {
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-mode], [data-source], [data-format], [data-step], [data-action]');
      if (!t || t.disabled) return;
      if (t.dataset.mode) opts.mode = t.dataset.mode;
      else if (t.dataset.source) opts.source = t.dataset.source;
      else if (t.dataset.format) {
        opts.format = t.dataset.format;
        opts.skip = Math.min(opts.skip, FORMATS[opts.format].perPage - 1);
      } else if (t.dataset.step) {
        const s = t.closest('[data-stepper]');
        const v = opts[s.dataset.stepper] + Number(t.dataset.step);
        opts[s.dataset.stepper] = Math.max(Number(s.dataset.min), Math.min(Number(s.dataset.max), v));
      } else if (t.dataset.action === 'print') return print();
      else if (t.dataset.action === 'choose-boxes') return chooseBoxes();
      else return;
      refresh();
    });

    // Toggling one shelf or zone: a full selection is stored as null ("all").
    const toggle = (current, all, id, on) => {
      const set = new Set(current().map((x) => x.id));
      on ? set.add(id) : set.delete(id);
      return set.size === all.length ? null : set;
    };

    root.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'from') {
        const n = parseInt(t.value, 10);
        opts.from = Number.isInteger(n) && n > 0 ? Math.min(n, 9999) : null;
      } else if (t.dataset.shelf) opts.shelves = toggle(selectedShelves, state.shelves, t.dataset.shelf, t.checked);
      else if (t.dataset.zone) opts.zones = toggle(selectedZones, state.zones, t.dataset.zone, t.checked);
      else if (t.name in opts) opts[t.name] = t.checked;
      else return;
      refresh();
    });

    // Scale the real-size A4 preview to the available width.
    const preview = root.querySelector('[data-preview]');
    const fit = () => {
      for (const wrap of preview.querySelectorAll('.preview-page')) {
        const page = wrap.firstElementChild;
        const scale = wrap.clientWidth / page.offsetWidth;
        page.style.transform = `scale(${scale})`;
        wrap.style.height = `${page.offsetHeight * scale}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(preview);
    return () => ro.disconnect();
  },
};

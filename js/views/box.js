// Detail page of a numbered entry – a box or a large loose item – plus the
// sheets that create, edit and move entries.

import { html, icon, openSheet, confirmDialog, alertDialog, toast } from '../ui.js';
import { navBar, badge, photoImg, hydratePhotos, locationGrid, emptyState, shelfDiagram, catAttrs, placeCode } from '../components.js';
import {
  state, boxByNumber, boxById, categoryById, shelfById, zoneById, createBox, updateBox, moveBox, deleteBox,
  nextNumber, savePhotos, deletePhotos, isValidLocation, search, sortedBoxes, locLong, snapshotBox, restoreBox,
} from '../store.js';
import {
  pad, boxTitle, boxHeading, unitName, kindOf, locShort, parseLocKey, sameLoc, splitLines, dateLabel, relTime, sinceLabel,
  unitsLabel,
} from '../format.js';
import { processImage } from '../photos.js';
import { navigate, back, currentPath, refresh } from '../router.js';
import { presetLabels } from './labels.js';

let deletedNumber = null;
let editing = false; // contents being edited on the page: hold re-renders meanwhile

function locationCard(box) {
  const loc = box.location;
  const shelf = loc?.shelf ? shelfById(loc.shelf) : null;
  const zone = loc?.zone ? zoneById(loc.zone) : null;
  const since = loc?.away && box.awaySince ? `${sinceLabel(box.awaySince)} · am ${dateLabel(box.awaySince)}` : '';
  return html`
    <section class="card loc-card">
      <div class="loc-main">
        ${placeCode(loc)}
        <span class="loc-text">
          <small>${zone ? 'Stellplatz' : 'Platz'}</small>
          <strong>${locLong(loc)}</strong>
          ${shelf?.note ? html`<span>${shelf.note}</span>` : ''}
          ${since ? html`<span>${since}</span>` : ''}
        </span>
        ${shelf ? shelfDiagram(shelf.levels, loc.level) : ''}
      </div>
      <div class="card-actions">
        <button data-action="move">${icon('move')} Umlagern</button>
        ${shelf
          ? html`<a href="#/regal/${loc.shelf}/${loc.level}">${icon('shelves')} Boden ansehen</a>`
          : zone
            ? html`<a href="#/platz/${zone.id}">${icon('zone')} Stellplatz ansehen</a>`
            : html`<button data-action="move">${icon('pin')} Platz wählen</button>`}
      </div>
    </section>`;
}

export const boxView = {
  title: ({ number }) => `Nr. ${pad(number)}`,
  get static() {
    return editing;
  },

  render({ number }) {
    const box = boxByNumber(Number(number));
    if (!box) return missing(Number(number));
    const cat = categoryById(box.category);
    const isItem = box.kind === 'item';
    return html`
      ${navBar({
        title: boxHeading(box),
        back: '/',
        right: html`<button class="pill-btn glass" data-action="edit">Bearbeiten</button>`,
      })}
      <main class="page">
        <section class="hero">
          ${badge(box, 'xl')}
          <h1 data-title-anchor>${boxHeading(box)}</h1>
          <p class="hero-sub">
            ${isItem ? `${kindOf(box).name} · ` : ''}
            ${cat ? html`<span class="dot" ${catAttrs(cat.color)}></span>${cat.name}` : 'ohne Kategorie'}
          </p>
        </section>

        ${locationCard(box)}

        <h3 class="section-head">Fotos</h3>
        <div class="photo-strip">
          ${box.photos.map(
            (id, i) => html`<button class="photo" data-action="view-photo" data-i="${i}" aria-label="Foto ${i + 1} öffnen">${photoImg(id)}</button>`,
          )}
          <label class="photo-add ${box.photos.length ? '' : 'wide'}">
            ${icon('camera')}<span>${box.photos.length ? 'Foto' : isItem ? 'Foto aufnehmen' : 'Foto vom Inhalt aufnehmen'}</span>
            <input type="file" accept="image/*" multiple hidden data-input="photo">
          </label>
        </div>

        ${isItem
          ? ''
          : html`
            <h3 class="section-head">Inhalt${box.items.length ? ` · ${box.items.length}` : ''}</h3>
            <div class="list item-list" data-items>${box.items.map(itemField)}${itemField()}</div>`}

        ${box.notes ? html`<h3 class="section-head">Notizen</h3><div class="card note-card">${box.notes}</div>` : ''}

        <div class="list actions">
          <button class="cell" data-action="print">
            <span class="icon-tile" ${catAttrs('blue')}>${icon('printer')}</span>
            <span class="cell-title">Etikett drucken</span>${icon('chevron', 'chev')}
          </button>
          <button class="cell destructive" data-action="delete">
            <span class="icon-tile" ${catAttrs('red')}>${icon('trash')}</span>
            <span class="cell-title">${kindOf(box).name} löschen</span>
          </button>
        </div>
        <p class="meta-foot">Angelegt am ${dateLabel(box.createdAt)} · geändert ${relTime(box.updatedAt)}</p>
      </main>`;
  },

  mount(root, { number }) {
    const box = boxByNumber(Number(number));
    root.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-action]');
      if (!t) return;
      switch (t.dataset.action) {
        case 'create':
          openBoxEditor({ preset: { number: Number(number), kind: t.dataset.kind } });
          break;
        case 'edit':
          openBoxEditor({ box });
          break;
        case 'move':
          openMoveSheet(box);
          break;
        case 'view-photo':
          openPhotoViewer(box, Number(t.dataset.i));
          break;
        case 'print':
          presetLabels({ mode: 'boxes', source: 'existing', ids: [box.id] });
          navigate('/etiketten');
          break;
        case 'delete':
          if (await confirmDialog({
            title: `${unitName(box)} löschen?`,
            message: 'Inhalt und Fotos werden entfernt. Das Etikett kannst du für etwas Neues wiederverwenden.',
            confirm: 'Löschen',
            destructive: true,
          })) {
            const snapshot = await snapshotBox(box.id);
            deletedNumber = box.number;
            deleteBox(box.id);
            back('/');
            toast(`${unitName(box)} gelöscht`, 'trash', {
              label: 'Widerrufen',
              run: async () => {
                try {
                  const restored = await restoreBox(snapshot);
                  deletedNumber = null;
                  navigate(`/kiste/${restored.number}`);
                } catch (err) {
                  alertDialog({ title: 'Nicht wiederhergestellt', message: err.message });
                }
              },
            });
          }
          break;
      }
    });

    // Contents are edited right on the page and saved as you type. While a
    // field has focus the page doesn't re-render, so the keyboard stays.
    const list = root.querySelector('[data-items]');
    let timer = 0;
    const save = () => {
      clearTimeout(timer);
      const items = itemValues(list);
      if (JSON.stringify(items) !== JSON.stringify(box.items)) updateBox(box.id, { items });
    };
    const flush = () => {
      const held = editing;
      editing = true;
      save();
      editing = held;
    };
    if (list) {
      bindItemFields(list, () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          flush();
          if (!editing) refresh(); // e.g. removed with ✕ without typing
        }, 600);
      });
      list.addEventListener('focusin', () => (editing = true));
      list.addEventListener('focusout', (e) => {
        if (list.contains(e.relatedTarget)) return;
        flush();
        editing = false;
        // Catch up (item count, changes from other devices) once the tap that
        // ended editing has done its work.
        setTimeout(() => list.isConnected && !list.contains(document.activeElement) && refresh(), 400);
      });
    }
    const onHide = () => document.hidden && list && flush();
    document.addEventListener('visibilitychange', onHide);

    root.querySelector('[data-input="photo"]')?.addEventListener('change', async (e) => {
      const files = [...e.target.files];
      if (!files.length) return;
      try {
        const ids = await savePhotos(box.id, await Promise.all(files.map(processImage)));
        updateBox(box.id, { photos: [...box.photos, ...ids] });
        toast(files.length > 1 ? `${files.length} Fotos hinzugefügt` : 'Foto hinzugefügt', 'photo');
      } catch (err) {
        alertDialog({ title: 'Foto nicht gespeichert', message: err.message });
      }
    });

    return () => {
      document.removeEventListener('visibilitychange', onHide);
      if (list) flush();
      editing = false;
    };
  },
};

function missing(number) {
  if (number === deletedNumber) return navBar({ back: '/' });
  return html`
    ${navBar({ back: '/' })}
    <main class="page">
      ${emptyState({
        iconName: 'box',
        title: `Nummer ${pad(number)} ist noch frei`,
        text: 'Klebt das Etikett schon auf einer Kiste oder einem großen Einzelstück? Dann erfasse es jetzt – die Nummer wird übernommen.',
        action: html`
          <button class="btn" data-action="create" data-kind="box">${icon('box')} Als Kiste erfassen</button>
          <button class="btn secondary" data-action="create" data-kind="item">${icon('item')} Als Einzelstück erfassen</button>`,
      })}
    </main>`;
}

// ---------------------------------------------------------------------------
// Editor

const TEXTS = {
  box: { create: 'Neue Kiste', edit: 'Kiste bearbeiten' },
  item: { create: 'Neues Einzelstück', edit: 'Einzelstück bearbeiten' },
};

const photoStrip = (draft) => html`
  ${draft.keepPhotos.map(
    (id) => html`<span class="photo">${photoImg(id)}<button type="button" class="photo-remove" data-remove-photo="${id}" aria-label="Foto entfernen">${icon('xmark')}</button></span>`,
  )}
  ${draft.newPhotos.map(
    (p, i) => html`<span class="photo"><img src="${p.url}" alt=""><button type="button" class="photo-remove" data-remove-new="${i}" aria-label="Foto entfernen">${icon('xmark')}</button></span>`,
  )}
  <label class="photo-add">${icon('camera')}<span>Foto</span><input type="file" accept="image/*" multiple hidden></label>`;

// Contents in the editor: one field per entry and always an empty, highlighted
// row at the end. Typing there makes it an entry and adds the next empty row.
const itemField = (value = '') => html`
  <div class="cell item-field ${value ? '' : 'blank'}">
    <span class="item-dot" aria-hidden="true"></span>
    <input name="item" value="${value}" placeholder="Neuer Gegenstand" autocomplete="off" enterkeyhint="next" aria-label="Gegenstand">
    <button type="button" class="icon-btn" data-remove-item tabindex="-1" aria-label="Gegenstand entfernen">${icon('xmark')}</button>
  </div>`;

// onChange: called after every change to the entries (for saving as you type).
function bindItemFields(list, onChange = () => {}) {
  const fields = () => [...list.querySelectorAll('.item-field')];
  const inputOf = (row) => row.querySelector('input');
  const blankRow = () => fields().at(-1);
  const appendBlank = () => {
    list.insertAdjacentHTML('beforeend', String(itemField()));
    return blankRow();
  };
  const focusEnd = (row) => {
    const input = inputOf(row);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  };

  list.addEventListener('input', (e) => {
    const row = e.target.closest('.item-field');
    const filled = !!e.target.value.trim();
    if (row === blankRow() && filled) {
      row.classList.remove('blank');
      appendBlank();
    }
    onChange();
  });

  // An entry that was emptied disappears once you leave it.
  list.addEventListener('focusout', (e) => {
    const row = e.target.closest('.item-field');
    if (row && e.target.matches('input') && row !== blankRow() && !e.target.value.trim()) {
      row.remove();
      onChange();
    }
  });

  list.addEventListener('keydown', (e) => {
    const row = e.target.closest('.item-field');
    if (!row) return;
    const rows = fields();
    const i = rows.indexOf(row);
    if (e.key === 'Enter') {
      e.preventDefault();
      if (row === blankRow()) e.target.blur();
      else focusEnd(rows[i + 1]);
    }
    if (e.key === 'Backspace' && !e.target.value && i > 0) {
      e.preventDefault();
      focusEnd(rows[i - 1]); // the emptied row goes on focusout
    }
  });

  list.addEventListener('paste', (e) => {
    const lines = splitLines(e.clipboardData?.getData('text'));
    if (lines.length < 2) return;
    e.preventDefault();
    let row = e.target.closest('.item-field');
    const [first, ...rest] = lines;
    inputOf(row).value = `${inputOf(row).value}${first}`;
    row.classList.remove('blank');
    for (const line of rest) {
      row.insertAdjacentHTML('afterend', String(itemField(line)));
      row = row.nextElementSibling;
    }
    if (row === blankRow()) appendBlank();
    focusEnd(blankRow());
    onChange();
  });

  list.addEventListener('click', (e) => {
    const remove = e.target.closest('[data-remove-item]');
    if (!remove) return;
    const row = remove.closest('.item-field');
    // Leave the row first; an emptied row may already go on its own.
    if (row.contains(document.activeElement)) document.activeElement.blur();
    if (row.isConnected) row.remove();
    onChange();
  });
}

const itemValues = (list) => [...list.querySelectorAll('.item-field input')].map((input) => input.value.trim()).filter(Boolean);

export function openBoxEditor({ box = null, preset = {}, onSaved = null } = {}) {
  const isNew = !box;
  const oldNumber = box?.number;
  const draft = {
    kind: box?.kind ?? (preset.kind === 'item' ? 'item' : 'box'),
    category: box ? box.category : preset.category ?? null,
    location: box ? box.location : preset.location ?? null,
    keepPhotos: [...(box?.photos ?? [])],
    newPhotos: [],
  };
  const number = box?.number ?? preset.number ?? nextNumber();
  const t = TEXTS[draft.kind];

  const body = html`
    <form class="form" data-form="box" autocomplete="off" onsubmit="return false">
      <div class="seg" role="group" aria-label="Art">
        <button type="button" data-kind="box" aria-pressed="${String(draft.kind === 'box')}">${icon('box')} Kiste</button>
        <button type="button" data-kind="item" aria-pressed="${String(draft.kind === 'item')}">${icon('item')} Einzelstück</button>
      </div>
      <p class="section-foot">Einzelstück: etwas Großes ohne Kiste, z. B. Weihnachtsbaum, Koffer oder Kinderwagen.</p>

      <div class="list spaced-sm">
        <label class="cell field">
          <span class="field-label">Nummer</span>
          <input name="number" inputmode="numeric" pattern="[0-9]*" value="${pad(number)}" enterkeyhint="next">
        </label>
        <label class="cell field" data-only="item" ${draft.kind === 'item' ? '' : 'hidden'}>
          <span class="field-label">Titel</span>
          <input name="title" value="${box?.title ?? ''}" placeholder="z. B. Weihnachtsbaum, Koffer" enterkeyhint="done">
        </label>
      </div>
      <p class="section-foot">Die Nummer steht auf dem Etikett und bleibt für immer gleich.</p>

      <h3 class="section-head">Kategorie</h3>
      <div class="chips">
        ${state.categories.map(
          (c) => html`<button type="button" class="chip" data-cat="${c.id}" ${catAttrs(c.color)} aria-pressed="${String(draft.category === c.id)}"><span class="dot"></span>${c.name}</button>`,
        )}
      </div>

      <h3 class="section-head">Platz</h3>
      <div class="card pad">${locationGrid(draft.location, { exclude: box })}</div>

      <h3 class="section-head">Fotos</h3>
      <div class="photo-strip" data-photos>${photoStrip(draft)}</div>

      <div data-only="box" ${draft.kind === 'box' ? '' : 'hidden'}>
        <h3 class="section-head">Inhalt</h3>
        <div class="list item-list" data-items>${(box?.items ?? []).map(itemField)}${itemField()}</div>
        <p class="section-foot">Ein Gegenstand pro Zeile – Enter springt in die nächste. Lieber fünf gute Stichworte als eine perfekte Liste: Die Suche findet auch Wortteile.</p>
      </div>

      <h3 class="section-head">Notizen</h3>
      <div class="list">
        <textarea name="notes" rows="2" placeholder="z. B. zerbrechlich, gehört Oma">${box?.notes ?? ''}</textarea>
      </div>
    </form>`;

  const sheet = openSheet({
    title: isNew ? t.create : t.edit,
    doneLabel: 'Sichern',
    body,
    onMount(el) {
      const strip = el.querySelector('[data-photos]');
      const heading = el.closest('.sheet').querySelector('.sheet-head h2');
      const redrawStrip = () => {
        strip.innerHTML = String(photoStrip(draft));
        hydratePhotos(strip);
      };
      hydratePhotos(strip);
      bindItemFields(el.querySelector('[data-items]'));

      // Boxes get contents, loose items a title. Switching only hides the
      // other field, so nothing typed is lost until saving.
      const applyKind = () => {
        el.querySelectorAll('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === draft.kind)));
        el.querySelectorAll('[data-only]').forEach((n) => (n.hidden = n.dataset.only !== draft.kind));
        heading.textContent = isNew ? TEXTS[draft.kind].create : TEXTS[draft.kind].edit;
      };

      el.addEventListener('click', (e) => {
        const kind = e.target.closest('[data-kind]');
        if (kind) {
          draft.kind = kind.dataset.kind;
          applyKind();
        }
        const chip = e.target.closest('[data-cat]');
        if (chip) {
          draft.category = draft.category === chip.dataset.cat ? null : chip.dataset.cat;
          el.querySelectorAll('[data-cat]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === draft.category)));
        }
        const cell = e.target.closest('[data-loc]');
        if (cell) {
          draft.location = parseLocKey(cell.dataset.loc);
          el.querySelectorAll('[data-loc]').forEach((c) => c.setAttribute('aria-pressed', String(c === cell)));
        }
        const keep = e.target.closest('[data-remove-photo]');
        if (keep) {
          draft.keepPhotos = draft.keepPhotos.filter((id) => id !== keep.dataset.removePhoto);
          redrawStrip();
        }
        const fresh = e.target.closest('[data-remove-new]');
        if (fresh) {
          const [p] = draft.newPhotos.splice(Number(fresh.dataset.removeNew), 1);
          URL.revokeObjectURL(p.url);
          redrawStrip();
        }
      });

      strip.addEventListener('change', async (e) => {
        const files = [...(e.target.files ?? [])];
        if (!files.length) return;
        try {
          for (const file of files) {
            const p = await processImage(file);
            draft.newPhotos.push({ ...p, url: URL.createObjectURL(p.thumb) });
          }
        } catch (err) {
          alertDialog({ title: 'Foto nicht übernommen', message: err.message });
        }
        redrawStrip();
      });
    },

    async done(el) {
      const form = el.querySelector('form');
      const isItem = draft.kind === 'item';
      const data = {
        kind: draft.kind,
        number: Number(form.number.value.trim()),
        title: isItem ? form.title.value : '',
        category: draft.category,
        location: isValidLocation(draft.location) ? draft.location : null,
        items: isItem ? [] : itemValues(el.querySelector('[data-items]')),
        notes: form.notes.value.trim(),
      };
      const saved = isNew ? createBox(data) : updateBox(box.id, data);

      const removed = (box?.photos ?? []).filter((id) => !draft.keepPhotos.includes(id));
      deletePhotos(removed);
      const added = draft.newPhotos.length ? await savePhotos(saved.id, draft.newPhotos) : [];
      if (removed.length || added.length) updateBox(saved.id, { photos: [...draft.keepPhotos, ...added] });

      toast(isNew ? `${unitName(saved)} angelegt` : 'Änderungen gesichert');
      if (onSaved) onSaved(saved);
      else if (isNew) navigate(`/kiste/${saved.number}`);
      else if (saved.number !== oldNumber && currentPath() === `/kiste/${oldNumber}`) {
        navigate(`/kiste/${saved.number}`, { replace: true });
      }
      return saved;
    },
  });
  sheet.closed.then(() => draft.newPhotos.forEach((p) => URL.revokeObjectURL(p.url)));
  return sheet;
}

export const newBox = (preset = {}) => openBoxEditor({ preset });

// ---------------------------------------------------------------------------
// Moving

// boxes: say how many were moved when there are several.
export function moveMessage(loc, boxes = []) {
  const who = boxes.length > 1 ? `${unitsLabel(boxes)} ` : '';
  if (!loc) return who ? `${who}ohne festen Platz` : 'Ohne festen Platz';
  if (loc.away) return who ? `${who}als entnommen markiert` : 'Als entnommen markiert';
  return who ? `${who}nach ${locShort(loc)} umgelagert` : `Nach ${locShort(loc)} umgelagert`;
}

// Moves entries (one or several scanned in a row) and offers to undo it all.
// Returns the entries that actually moved.
export function relocateAll(boxes, loc) {
  const moved = boxes
    .filter((b) => !sameLoc(b.location, loc))
    .map((b) => ({ box: b, prev: b.location, since: b.awaySince ?? null }));
  if (!moved.length) return [];
  for (const m of moved) moveBox(m.box.id, loc);
  const undo = () => moved.forEach((m) => updateBox(m.box.id, { location: m.prev, awaySince: m.since }));
  toast(moveMessage(loc, moved.map((m) => m.box)), 'checkCircle', { label: 'Widerrufen', run: undo });
  return moved.map((m) => m.box);
}

export const relocate = (box, loc) => relocateAll([box], loc).length > 0;

export function openMoveSheet(box) {
  return openSheet({
    title: 'Umlagern',
    body: html`
      <div class="move-head card">
        ${badge(box)}
        <span class="cell-text">
          <span class="cell-title">${boxTitle(box)}</span>
          <span class="cell-sub">Jetzt: ${locLong(box.location)}</span>
        </span>
      </div>
      <p class="section-foot">Tippe auf den neuen Platz. Die Zahl zeigt, wie viel dort schon steht.</p>
      <div class="card pad">${locationGrid(box.location, { exclude: box })}</div>`,
    onMount(el, close) {
      el.addEventListener('click', (e) => {
        const cell = e.target.closest('[data-loc]');
        if (!cell) return;
        relocate(box, parseLocKey(cell.dataset.loc));
        close();
      });
    },
  });
}

export function openPickBoxSheet(loc) {
  const rows = (q) => {
    const boxes = (q ? search(q).map((r) => r.box) : sortedBoxes()).filter((b) => !sameLoc(b.location, loc));
    if (!boxes.length) return html`<div class="cell muted-cell">Nichts Passendes gefunden</div>`;
    return boxes.map(
      (b) => html`
        <button type="button" class="cell box-row" data-pick="${b.id}">
          ${badge(b)}
          <span class="cell-text"><span class="cell-title">${boxTitle(b)}</span><span class="cell-sub">${locShort(b.location)}</span></span>
        </button>`,
    );
  };
  return openSheet({
    title: `Nach ${locShort(loc)} stellen`,
    body: html`
      <label class="search">${icon('search')}<input type="search" placeholder="Kiste oder Einzelstück suchen" data-pick-q autocomplete="off"></label>
      <div class="list" data-pick-list>${rows('')}</div>`,
    onMount(el, close) {
      const list = el.querySelector('[data-pick-list]');
      el.querySelector('[data-pick-q]').addEventListener('input', (e) => {
        list.innerHTML = String(rows(e.target.value));
      });
      list.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pick]');
        if (!btn) return;
        relocate(boxById(btn.dataset.pick), loc);
        close();
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Full-screen photo viewer

export function openPhotoViewer(box, index = 0) {
  const layer = document.createElement('div');
  layer.className = 'viewer';
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-label', 'Fotos');
  layer.innerHTML = String(html`
    <div class="viewer-track">${box.photos.map((id) => html`<figure data-id="${id}">${photoImg(id, 'full')}</figure>`)}</div>
    <div class="viewer-bar">
      <button class="circle-btn glass" data-v="close" aria-label="Schließen">${icon('xmark')}</button>
      <span class="viewer-count"></span>
      <button class="circle-btn glass" data-v="delete" aria-label="Foto löschen">${icon('trash')}</button>
    </div>`);
  document.body.append(layer);
  document.documentElement.classList.add('modal-open');
  hydratePhotos(layer);

  const track = layer.querySelector('.viewer-track');
  const counter = layer.querySelector('.viewer-count');
  const current = () => Math.round(track.scrollLeft / track.clientWidth);
  const updateCount = () => (counter.textContent = `${current() + 1} von ${track.children.length}`);
  requestAnimationFrame(() => {
    track.scrollLeft = index * track.clientWidth;
    updateCount();
    layer.classList.add('open');
  });
  track.addEventListener('scroll', updateCount, { passive: true });

  const onKey = (e) => e.key === 'Escape' && close();
  const close = () => {
    document.removeEventListener('keydown', onKey);
    layer.classList.remove('open');
    document.documentElement.classList.remove('modal-open');
    setTimeout(() => layer.remove(), 250);
  };
  document.addEventListener('keydown', onKey);

  layer.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-v]')?.dataset.v;
    if (action === 'close') close();
    if (action === 'delete') {
      if (!(await confirmDialog({ title: 'Foto löschen?', confirm: 'Löschen', destructive: true }))) return;
      const fig = track.children[current()];
      const id = fig.dataset.id;
      deletePhotos([id]);
      updateBox(box.id, { photos: box.photos.filter((p) => p !== id) });
      fig.remove();
      if (!track.children.length) close();
      else updateCount();
    }
  });
}

// Box detail page plus the sheets that create, edit and move boxes.

import { html, icon, openSheet, confirmDialog, alertDialog, toast } from '../ui.js';
import { navBar, badge, photoImg, hydratePhotos, locationGrid, emptyState, shelfDiagram, catAttrs } from '../components.js';
import {
  state, boxByNumber, boxById, categoryById, shelfById, createBox, updateBox, moveBox, deleteBox,
  nextNumber, savePhotos, deletePhotos, isValidLocation, search, sortedBoxes,
} from '../store.js';
import { pad, boxTitle, locLong, locShort, parseLocKey, sameLoc, splitItems, dateLabel, relTime } from '../format.js';
import { processImage } from '../photos.js';
import { navigate, back, currentPath } from '../router.js';
import { presetLabels } from './labels.js';

let refocusQuickAdd = false;
let deletedNumber = null;

export const boxView = {
  title: ({ number }) => `Kiste ${pad(number)}`,

  render({ number }) {
    const box = boxByNumber(Number(number));
    if (!box) return missing(Number(number));
    const cat = categoryById(box.category);
    const loc = box.location;
    const shelf = loc && !loc.away ? shelfById(loc.shelf) : null;
    return html`
      ${navBar({
        title: boxTitle(box),
        back: '/',
        right: html`<button class="pill-btn glass" data-action="edit">Bearbeiten</button>`,
      })}
      <main class="page">
        <section class="hero">
          ${badge(box, 'xl')}
          <h1 data-title-anchor>${boxTitle(box)}</h1>
          <p class="hero-sub">
            ${cat ? html`<span class="dot" ${catAttrs(cat.color)}></span>${cat.name}` : 'Ohne Kategorie'}
          </p>
        </section>

        <section class="card loc-card">
          <div class="loc-main">
            <span class="loc-code ${shelf ? '' : 'muted'}">${shelf ? `${loc.shelf}${loc.level}` : icon(loc ? 'house' : 'tray')}</span>
            <span class="loc-text">
              <small>Platz</small>
              <strong>${locLong(loc)}</strong>
              ${shelf?.note ? html`<span>${shelf.note}</span>` : ''}
            </span>
            ${shelf ? shelfDiagram(shelf.levels, loc.level) : ''}
          </div>
          <div class="card-actions">
            <button data-action="move">${icon('move')} Umlagern</button>
            ${shelf
              ? html`<a href="#/regal/${loc.shelf}/${loc.level}">${icon('shelves')} Boden ansehen</a>`
              : html`<button data-action="move">${icon('pin')} Platz wählen</button>`}
          </div>
        </section>

        <h3 class="section-head">Fotos</h3>
        <div class="photo-strip">
          ${box.photos.map(
            (id, i) => html`<button class="photo" data-action="view-photo" data-i="${i}" aria-label="Foto ${i + 1} öffnen">${photoImg(id)}</button>`,
          )}
          <label class="photo-add ${box.photos.length ? '' : 'wide'}">
            ${icon('camera')}<span>${box.photos.length ? 'Foto' : 'Foto vom Inhalt aufnehmen'}</span>
            <input type="file" accept="image/*" multiple hidden data-input="photo">
          </label>
        </div>

        <h3 class="section-head">Inhalt${box.items.length ? ` · ${box.items.length}` : ''}</h3>
        <div class="list">
          ${box.items.map(
            (item, i) => html`
              <div class="cell item-row">
                <span class="cell-title">${item}</span>
                <button class="icon-btn" data-action="remove-item" data-i="${i}" aria-label="${item} entfernen">${icon('xmark')}</button>
              </div>`,
          )}
          <form class="cell add-row" data-form="add-item">
            ${icon('plus', 'add-icon')}
            <input name="item" placeholder="Gegenstand hinzufügen" autocomplete="off" enterkeyhint="done" aria-label="Gegenstand hinzufügen">
          </form>
        </div>

        ${box.notes ? html`<h3 class="section-head">Notizen</h3><div class="card note-card">${box.notes}</div>` : ''}

        <div class="list actions">
          <button class="cell" data-action="print">
            <span class="icon-tile" ${catAttrs('blue')}>${icon('printer')}</span>
            <span class="cell-title">Etikett drucken</span>${icon('chevron', 'chev')}
          </button>
          <button class="cell destructive" data-action="delete">
            <span class="icon-tile" ${catAttrs('red')}>${icon('trash')}</span>
            <span class="cell-title">Kiste löschen</span>
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
          openBoxEditor({ preset: { number: Number(number) } });
          break;
        case 'edit':
          openBoxEditor({ box });
          break;
        case 'move':
          openMoveSheet(box);
          break;
        case 'remove-item':
          updateBox(box.id, { items: box.items.filter((_, i) => i !== Number(t.dataset.i)) });
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
            title: `Kiste ${pad(box.number)} löschen?`,
            message: 'Inhalt und Fotos werden entfernt. Das Etikett kannst du für eine neue Kiste wiederverwenden.',
            confirm: 'Löschen',
            destructive: true,
          })) {
            deletedNumber = box.number;
            deleteBox(box.id);
            back('/');
            toast(`Kiste ${pad(box.number)} gelöscht`, 'trash');
          }
          break;
      }
    });

    const form = root.querySelector('[data-form="add-item"]');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const items = splitItems(form.item.value);
      if (!items.length) return;
      refocusQuickAdd = true;
      updateBox(box.id, { items: [...box.items, ...items] });
    });
    if (refocusQuickAdd) {
      refocusQuickAdd = false;
      const input = root.querySelector('[data-form="add-item"] input');
      input?.focus({ preventScroll: true });
    }

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
  },
};

function missing(number) {
  if (number === deletedNumber) return navBar({ back: '/' });
  return html`
    ${navBar({ back: '/' })}
    <main class="page">
      ${emptyState({
        iconName: 'box',
        title: `Kiste ${pad(number)} ist noch nicht angelegt`,
        text: 'Klebt das Etikett schon auf einer Kiste? Dann erfasse sie jetzt – die Nummer wird übernommen.',
        action: html`<button class="btn" data-action="create">${icon('plus')} Kiste ${pad(number)} anlegen</button>`,
      })}
    </main>`;
}

// ---------------------------------------------------------------------------
// Editor

const photoStrip = (draft) => html`
  ${draft.keepPhotos.map(
    (id) => html`<span class="photo">${photoImg(id)}<button type="button" class="photo-remove" data-remove-photo="${id}" aria-label="Foto entfernen">${icon('xmark')}</button></span>`,
  )}
  ${draft.newPhotos.map(
    (p, i) => html`<span class="photo"><img src="${p.url}" alt=""><button type="button" class="photo-remove" data-remove-new="${i}" aria-label="Foto entfernen">${icon('xmark')}</button></span>`,
  )}
  <label class="photo-add">${icon('camera')}<span>Foto</span><input type="file" accept="image/*" multiple hidden></label>`;

export function openBoxEditor({ box = null, preset = {}, onSaved = null } = {}) {
  const isNew = !box;
  const oldNumber = box?.number;
  const draft = {
    category: box ? box.category : preset.category ?? null,
    location: box ? box.location : preset.location ?? null,
    keepPhotos: [...(box?.photos ?? [])],
    newPhotos: [],
  };
  const number = box?.number ?? preset.number ?? nextNumber();

  const body = html`
    <form class="form" data-form="box" autocomplete="off" onsubmit="return false">
      <div class="list">
        <label class="cell field">
          <span class="field-label">Nummer</span>
          <input name="number" inputmode="numeric" pattern="[0-9]*" value="${pad(number)}" enterkeyhint="next">
        </label>
        <label class="cell field">
          <span class="field-label">Titel</span>
          <input name="title" value="${box?.title ?? ''}" placeholder="z. B. Weihnachtsdeko" enterkeyhint="next">
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

      <h3 class="section-head">Inhalt</h3>
      <div class="list">
        <textarea name="items" rows="5" placeholder="Ein Gegenstand pro Zeile, z. B.&#10;Lichterkette&#10;Christbaumkugeln">${(box?.items ?? []).join('\n')}</textarea>
      </div>
      <p class="section-foot">Lieber fünf gute Stichworte als eine perfekte Liste – die Suche findet auch Wortteile.</p>

      <h3 class="section-head">Notizen</h3>
      <div class="list">
        <textarea name="notes" rows="2" placeholder="z. B. zerbrechlich, gehört Oma">${box?.notes ?? ''}</textarea>
      </div>
    </form>`;

  const sheet = openSheet({
    title: isNew ? 'Neue Kiste' : 'Kiste bearbeiten',
    doneLabel: 'Sichern',
    body,
    onMount(el) {
      const strip = el.querySelector('[data-photos]');
      const redrawStrip = () => {
        strip.innerHTML = String(photoStrip(draft));
        hydratePhotos(strip);
      };
      hydratePhotos(strip);

      el.addEventListener('click', (e) => {
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
      const data = {
        number: Number(form.number.value.trim()),
        title: form.title.value,
        category: draft.category,
        location: isValidLocation(draft.location) ? draft.location : null,
        items: splitItems(form.items.value),
        notes: form.notes.value.trim(),
      };
      const saved = isNew ? createBox(data) : updateBox(box.id, data);

      const removed = (box?.photos ?? []).filter((id) => !draft.keepPhotos.includes(id));
      deletePhotos(removed);
      const added = draft.newPhotos.length ? await savePhotos(saved.id, draft.newPhotos) : [];
      if (removed.length || added.length) updateBox(saved.id, { photos: [...draft.keepPhotos, ...added] });

      toast(isNew ? `Kiste ${pad(saved.number)} angelegt` : 'Änderungen gesichert');
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

export function moveMessage(box, loc) {
  const name = `Kiste ${pad(box.number)}`;
  if (!loc) return `${name} hat keinen festen Platz`;
  if (loc.away) return `${name} als entnommen markiert`;
  return `${name} steht jetzt in ${loc.shelf}${loc.level}`;
}

export function relocate(box, loc) {
  const prev = box.location;
  if (sameLoc(prev, loc)) return false;
  moveBox(box.id, loc);
  toast(moveMessage(box, loc), 'checkCircle', { label: 'Widerrufen', run: () => moveBox(box.id, prev) });
  return true;
}

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
      <p class="section-foot">Tippe auf den neuen Platz. Die Zahl zeigt, wie viele Kisten dort schon stehen.</p>
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
    if (!boxes.length) return html`<div class="cell muted-cell">Keine passenden Kisten</div>`;
    return boxes.map(
      (b) => html`
        <button type="button" class="cell box-row" data-pick="${b.id}">
          ${badge(b)}
          <span class="cell-text"><span class="cell-title">${boxTitle(b)}</span><span class="cell-sub">${locShort(b.location)}</span></span>
        </button>`,
    );
  };
  return openSheet({
    title: `Nach ${loc.shelf}${loc.level} stellen`,
    body: html`
      <label class="search">${icon('search')}<input type="search" placeholder="Kiste suchen" data-pick-q autocomplete="off"></label>
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

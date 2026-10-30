// Minimal UI toolkit: auto-escaping HTML templates, icons, bottom sheets,
// iOS-style alerts and a status toast.

export class Raw {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}
export const raw = (s) => new Raw(String(s));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

function toHTML(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(toHTML).join('');
  return esc(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += toHTML(values[i]) + strings[i + 1];
  return new Raw(out);
}

// ---------------------------------------------------------------------------
// Icons: 24px grid, drawn with strokes in the spirit of SF Symbols.

const ICONS = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  shelves: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M4 9h16M4 15h16"/>',
  scan: '<path d="M3.5 8V6a2.5 2.5 0 0 1 2.5-2.5h2M16 3.5h2A2.5 2.5 0 0 1 20.5 6v2M20.5 16v2a2.5 2.5 0 0 1-2.5 2.5h-2M8 20.5H6A2.5 2.5 0 0 1 3.5 18v-2"/><path d="M8 12h8"/>',
  tag: '<path d="M3.5 5v6.2a2 2 0 0 0 .6 1.4l7.8 7.8a2 2 0 0 0 2.8 0l5.7-5.7a2 2 0 0 0 0-2.8l-7.8-7.8a2 2 0 0 0-1.4-.6H5a1.5 1.5 0 0 0-1.5 1.5Z"/><circle cx="8.5" cy="8.5" r="1.4"/>',
  more: '<circle cx="12" cy="12" r="9"/><circle cx="7.8" cy="12" r=".6" fill="currentColor"/><circle cx="12" cy="12" r=".6" fill="currentColor"/><circle cx="16.2" cy="12" r=".6" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  chevron: '<path d="m9.5 6 6 6-6 6"/>',
  chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
  xmark: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8L16.2 9.5"/>',
  box: '<path d="M20.5 7.5 12 3 3.5 7.5v9L12 21l8.5-4.5v-9Z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9M7.8 5.2l8.5 4.6"/>',
  item: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2M8 7.5v12M16 7.5v12"/>',
  zone: '<path d="M3 16.5 12 12l9 4.5L12 21l-9-4.5Z"/><path d="M12 15.5V3.5"/><path d="M12 4h6l-1.6 2.2L18 8.5h-6"/>',
  homescreen: '<rect x="6" y="2.5" width="12" height="19" rx="2.8"/><path d="M12 8.5v6M9 11.5h6"/><path d="M10.5 18.5h3"/>',
  tray: '<path d="M3.5 13.5h4.8l1.4 2.5h4.6l1.4-2.5h4.8"/><path d="M6.4 4.5h11.2l2.9 9v5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18.5v-5l2.9-9Z"/>',
  house: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
  pin: '<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  camera: '<path d="M4.5 7.5h2.8l1.7-2.5h6l1.7 2.5h2.8a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5V9a1.5 1.5 0 0 1 1.5-1.5Z"/><circle cx="12" cy="13.3" r="3.6"/>',
  photo: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m21 15.5-4.8-4.5L6.5 19.5"/>',
  trash: '<path d="M4 6.5h16M9.5 3.5h5M6 6.5l1 12.6a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 6.5"/><path d="M10 10.5v6M14 10.5v6"/>',
  move: '<path d="M7.5 4v15.5M3.5 8l4-4 4 4M16.5 20V4.5M12.5 16l4 4 4-4"/>',
  pencil: '<path d="M4 20h4.2L19 9.2a2.1 2.1 0 0 0 0-3L17.8 5a2.1 2.1 0 0 0-3 0L4 15.8V20Z"/><path d="m13.5 6.5 4 4"/>',
  printer: '<path d="M7 8.5V3.5h10v5"/><rect x="3" y="8.5" width="18" height="8.5" rx="2"/><path d="M7 14h10v6.5H7z"/>',
  share: '<path d="M12 3.5v11M8 7.2l4-3.7 4 3.7"/><path d="M8.5 10.5H7A1.5 1.5 0 0 0 5.5 12v7A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5"/>',
  download: '<path d="M12 3.5v11M8 10.8l4 3.7 4-3.7"/><path d="M8.5 9H7A1.5 1.5 0 0 0 5.5 10.5v8.5A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-8.5A1.5 1.5 0 0 0 17 9h-1.5"/>',
  book: '<path d="M12 6.5c-1.7-1.6-4.3-2.3-8-2v13.5c3.7-.3 6.3.4 8 2 1.7-1.6 4.3-2.3 8-2V4.5c-3.7-.3-6.3.4-8 2Z"/><path d="M12 6.5V20"/>',
  sparkles: '<path d="M10 3.5 11.6 8 16 9.6l-4.4 1.6L10 15.6l-1.6-4.4L4 9.6 8.4 8 10 3.5Z"/><path d="m17.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/>',
  circles: '<circle cx="7.5" cy="7.5" r="3"/><circle cx="16.5" cy="7.5" r="3"/><circle cx="7.5" cy="16.5" r="3"/><circle cx="16.5" cy="16.5" r="3"/>',
  number: '<path d="M5 9h15M4 15h15M10.5 4 8.5 20M15.5 4l-2 16"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r=".9" fill="currentColor"/><circle cx="4.8" cy="12" r=".9" fill="currentColor"/><circle cx="4.8" cy="17.5" r=".9" fill="currentColor"/>',
  note: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/>',
  warning: '<path d="M10.3 4.3 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  arrowUturn: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  scissors: '<circle cx="6.5" cy="6.5" r="2.5"/><circle cx="6.5" cy="17.5" r="2.5"/><path d="M8.6 8 20 18M8.6 16 20 6"/>',
  weight: '<path d="M6.5 8.5h11l2 11.5h-15l2-11.5Z"/><circle cx="12" cy="5.5" r="2.2"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeSlash: '<path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-2.6 3.4M6.4 7.4C3.9 9.1 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M4 4l16 16"/>',
  person: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.6-4.2 3.4-6.5 7.5-6.5s6.9 2.3 7.5 6.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/><circle cx="12" cy="15.5" r=".6" fill="currentColor"/>',
  leaf: '<path d="M5 19c0-8 5-13.5 15-14.5-.5 10-6 15-14 15"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.5 7-6.5 7-2.6 0-4-1.3-5.4-3.4L3.6 14a1.6 1.6 0 0 1 2.6-1.8L8 14.5"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.5-3.6 2.8-5.5 6-5.5s5.5 1.9 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.6.2 4.1 2 4.5 4.9"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4.5h-4.5"/>',
};

export const icon = (name, cls = '') =>
  raw(`<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ''}</svg>`);

// ---------------------------------------------------------------------------
// Bottom sheet

const layers = [];

function lockScroll(on) {
  document.documentElement.classList.toggle('modal-open', on);
}

export function openSheet({ title, body, done = null, doneLabel = 'Fertig', onMount, className = '' }) {
  const layer = document.createElement('div');
  layer.className = 'sheet-layer';
  layer.innerHTML = String(html`
    <div class="sheet-backdrop" data-sheet-close></div>
    <section class="sheet ${className}" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="sheet-grabber" aria-hidden="true"></div>
      <header class="sheet-head">
        <button type="button" class="circle-btn glass" data-sheet-close aria-label="Schließen">${icon('xmark')}</button>
        <h2>${title}</h2>
        ${done
          ? html`<button type="button" class="circle-btn tint" data-sheet-done aria-label="${doneLabel}">${icon('check')}</button>`
          : html`<span class="circle-spacer"></span>`}
      </header>
      <div class="sheet-body">${body}</div>
    </section>`);
  document.body.append(layer);
  layers.push(layer);
  lockScroll(true);

  const el = layer.querySelector('.sheet-body');
  const sheet = layer.querySelector('.sheet');
  let resolveClosed;
  const closed = new Promise((r) => (resolveClosed = r));
  let isClosed = false;

  function close(result) {
    if (isClosed) return;
    isClosed = true;
    layer.classList.remove('open');
    sheet.style.transform = '';
    layers.splice(layers.indexOf(layer), 1);
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      layer.remove();
      if (!layers.length) lockScroll(false);
      resolveClosed(result);
    }, 320);
  }

  const onKey = (e) => {
    if (e.key === 'Escape' && layers.at(-1) === layer && !document.querySelector('.alert-layer')) close();
  };
  document.addEventListener('keydown', onKey);

  layer.addEventListener('click', async (e) => {
    if (e.target.closest('[data-sheet-close]')) return close();
    const doneBtn = e.target.closest('[data-sheet-done]');
    if (!doneBtn || doneBtn.disabled) return;
    doneBtn.disabled = true;
    try {
      const result = await done(el);
      if (result !== false) close(result ?? true);
    } catch (err) {
      alertDialog({ title: 'Das hat nicht geklappt', message: err.message });
    } finally {
      doneBtn.disabled = false;
    }
  });

  // Drag the header down to dismiss, like a native sheet.
  const head = layer.querySelector('.sheet-head');
  let startY = null;
  head.addEventListener('touchstart', (e) => {
    if (e.target.closest('button')) return;
    startY = e.touches[0].clientY;
    sheet.style.transition = 'none';
  }, { passive: true });
  head.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    const dy = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  head.addEventListener('touchend', (e) => {
    if (startY == null) return;
    const dy = e.changedTouches[0].clientY - startY;
    startY = null;
    sheet.style.transition = '';
    if (dy > 110) close();
    else sheet.style.transform = '';
  });

  requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('open')));
  onMount?.(el, close);
  return { el, close, closed };
}

// ---------------------------------------------------------------------------
// Alerts

export function dialog({ title, message = '', buttons, input = null }) {
  return new Promise((resolve) => {
    const layer = document.createElement('div');
    layer.className = 'alert-layer';
    layer.innerHTML = String(html`
      <form class="alert" role="alertdialog" aria-modal="true" aria-label="${title}">
        <h3>${title}</h3>
        ${message ? html`<p>${message}</p>` : ''}
        ${input
          ? html`<input class="alert-input" name="value" value="${input.value ?? ''}" placeholder="${input.placeholder ?? ''}"
              inputmode="${input.inputmode ?? 'text'}" autocomplete="off" enterkeyhint="done">`
          : ''}
        <div class="alert-actions ${buttons.length > 2 ? 'stacked' : ''}">
          ${buttons.map(
            (b, i) => html`<button type="${b.style === 'primary' || b.style === 'destructive' ? 'submit' : 'button'}"
              class="alert-btn ${b.style ?? ''}" data-i="${i}">${b.label}</button>`,
          )}
        </div>
      </form>`);
    document.body.append(layer);
    requestAnimationFrame(() => layer.classList.add('open'));
    const form = layer.querySelector('form');
    const field = layer.querySelector('.alert-input');
    if (field) setTimeout(() => field.focus(), 60);

    const finish = (button) => {
      layer.classList.remove('open');
      setTimeout(() => layer.remove(), 200);
      resolve({ value: button?.value, input: field?.value ?? null });
    };
    form.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-i]');
      if (btn && btn.type === 'button') finish(buttons[btn.dataset.i]);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = e.submitter?.dataset.i != null ? buttons[e.submitter.dataset.i] : buttons.find((b) => b.style === 'primary' || b.style === 'destructive');
      finish(btn);
    });
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') finish(buttons.find((b) => b.style === 'cancel'));
    });
  });
}

export const alertDialog = ({ title, message }) =>
  dialog({ title, message, buttons: [{ label: 'OK', value: true, style: 'primary' }] });

export async function confirmDialog({ title, message, confirm = 'OK', cancel = 'Abbrechen', destructive = false }) {
  const { value } = await dialog({
    title,
    message,
    buttons: [
      { label: cancel, value: false, style: 'cancel' },
      { label: confirm, value: true, style: destructive ? 'destructive' : 'primary' },
    ],
  });
  return value === true;
}

export async function promptDialog({ title, message, placeholder, value = '', inputmode = 'text', confirm = 'OK' }) {
  const res = await dialog({
    title,
    message,
    input: { placeholder, value, inputmode },
    buttons: [
      { label: 'Abbrechen', value: false, style: 'cancel' },
      { label: confirm, value: true, style: 'primary' },
    ],
  });
  return res.value ? res.input.trim() : null;
}

// ---------------------------------------------------------------------------
// Toast

let toastTimer = 0;
export function toast(text, iconName = 'checkCircle', action = null) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast glass';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.innerHTML = String(html`${icon(iconName)}<span>${text}</span>${action ? html`<button type="button">${action.label}</button>` : ''}`);
  if (action) {
    el.querySelector('button').onclick = () => {
      el.classList.remove('show');
      action.run();
    };
  }
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? 4500 : 2200);
}

// ---------------------------------------------------------------------------
// Files

export async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

export function pickFile(accept, { multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept, multiple });
    input.addEventListener('change', () => resolve([...input.files]));
    input.click();
  });
}

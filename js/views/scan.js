// Camera scanner. Scanning a box label selects the box; scanning a shelf
// label right after moves the selected box there. Scanning an unknown box
// number offers to create it – the fast path for the big sorting day.

import { html, icon, promptDialog } from '../ui.js';
import { badge } from '../components.js';
import { boxByNumber, boxById, shelfById, boxesAt } from '../store.js';
import { pad, boxTitle, locLong, plural, sameLoc } from '../format.js';
import { parseCode } from '../qr.js';
import { navigate } from '../router.js';
import { openBoxEditor, relocate } from './box.js';

const SCAN_INTERVAL = 140; // ms between decode attempts

function cardFor(state) {
  const { kind, box, loc, number, shelf } = state;
  switch (kind) {
    case 'box':
      return html`
        <div class="scan-card-main">
          ${badge(box)}
          <span class="cell-text"><span class="cell-title">${boxTitle(box)}</span><span class="cell-sub">${locLong(box.location)}</span></span>
        </div>
        <p class="scan-tip">${icon('scan')} Jetzt einen Boden scannen, um die Kiste dort einzulagern.</p>
        <div class="scan-card-actions">
          <button class="pill-btn glass" data-scan="dismiss">Fertig</button>
          <button class="pill-btn tint" data-scan="open-box">Öffnen</button>
        </div>`;
    case 'moved':
      return html`
        <div class="scan-card-main">
          <span class="scan-check">${icon('check')}</span>
          <span class="cell-text"><span class="cell-title">Kiste ${pad(box.number)} eingelagert</span><span class="cell-sub">${locLong(loc)}</span></span>
        </div>
        <div class="scan-card-actions">
          <button class="pill-btn glass" data-scan="dismiss">Nächste Kiste</button>
          <button class="pill-btn tint" data-scan="open-box">Öffnen</button>
        </div>`;
    case 'already':
      return html`
        <div class="scan-card-main">
          <span class="scan-check">${icon('check')}</span>
          <span class="cell-text"><span class="cell-title">Steht schon hier</span><span class="cell-sub">Kiste ${pad(box.number)} · ${locLong(loc)}</span></span>
        </div>
        <div class="scan-card-actions"><button class="pill-btn glass" data-scan="dismiss">OK</button></div>`;
    case 'new':
      return html`
        <div class="scan-card-main">
          <span class="badge" data-c="gray" style="--cat: var(--c-gray)">${pad(number)}</span>
          <span class="cell-text"><span class="cell-title">Neue Kiste ${pad(number)}</span><span class="cell-sub">Noch nicht in der App erfasst</span></span>
        </div>
        <div class="scan-card-actions">
          <button class="pill-btn glass" data-scan="dismiss">Abbrechen</button>
          <button class="pill-btn tint" data-scan="create">Erfassen</button>
        </div>`;
    case 'level': {
      const n = boxesAt(loc.shelf, loc.level).length;
      return html`
        <div class="scan-card-main">
          <span class="loc-code small">${loc.shelf}${loc.level}</span>
          <span class="cell-text"><span class="cell-title">${locLong(loc)}</span><span class="cell-sub">${plural(n, 'Kiste', 'Kisten')}</span></span>
        </div>
        <p class="scan-tip">${icon('scan')} Erst die Kiste scannen, dann den Boden – so wird eingelagert.</p>
        <div class="scan-card-actions">
          <button class="pill-btn glass" data-scan="dismiss">Fertig</button>
          <button class="pill-btn tint" data-scan="open-level">Ansehen</button>
        </div>`;
    }
    case 'shelf':
      return html`
        <div class="scan-card-main">
          <span class="loc-code small">${shelf.id}</span>
          <span class="cell-text"><span class="cell-title">Regal ${shelf.id}</span><span class="cell-sub">${shelf.note || plural(shelf.levels, 'Boden', 'Böden')}</span></span>
        </div>
        <div class="scan-card-actions">
          <button class="pill-btn glass" data-scan="dismiss">Fertig</button>
          <button class="pill-btn tint" data-scan="open-shelf">Ansehen</button>
        </div>`;
    default:
      return html`
        <div class="scan-card-main">
          <span class="scan-check warn">${icon('warning')}</span>
          <span class="cell-text"><span class="cell-title">${state.title}</span><span class="cell-sub">${state.text}</span></span>
        </div>
        <div class="scan-card-actions"><button class="pill-btn glass" data-scan="dismiss">OK</button></div>`;
  }
}

export default {
  tab: 'scan',
  title: 'Scannen',
  static: true, // don't re-render (and restart the camera) on data changes
  className: 'view-scan',

  render() {
    return html`
      <div class="scan">
        <video playsinline muted autoplay></video>
        <div class="scan-shade" aria-hidden="true"><div class="scan-finder"><i></i><i></i><i></i><i></i></div></div>
        <header class="scan-head">
          <h1>Scannen</h1>
          <p data-hint>Halte die Kamera auf ein Kisten- oder Regaletikett.</p>
        </header>
        <div class="scan-bottom">
          <div class="scan-card" data-card hidden></div>
          <button class="pill-btn glass" data-scan="manual">${icon('number')} Nummer eingeben</button>
        </div>
      </div>`;
  },

  mount(root) {
    const video = root.querySelector('video');
    const cardEl = root.querySelector('[data-card]');
    const hint = root.querySelector('[data-hint]');
    const finder = root.querySelector('.scan-finder');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const worker = new Worker('js/scan-worker.js');

    let stream = null;
    let raf = 0;
    let busy = false;
    let stopped = false;
    let lastFrame = 0;
    let last = { text: '', at: 0 };
    let selected = null; // id of the box waiting for a shelf scan
    let card = null;
    let hitTimer = 0;

    const show = (state) => {
      card = state;
      cardEl.hidden = !state;
      if (state) cardEl.innerHTML = String(cardFor(state));
    };

    function handle(text) {
      const now = Date.now();
      if (text === last.text && now - last.at < 2500) return;
      last = { text, at: now };
      finder.classList.remove('hit');
      void finder.offsetWidth;
      finder.classList.add('hit');
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => finder.classList.remove('hit'), 700);
      navigator.vibrate?.(25);

      const code = parseCode(text);
      if (!code) return show({ kind: 'error', title: 'Unbekannter Code', text: 'Das ist kein Fundort-Etikett.' });

      if (code.type === 'box') {
        const box = boxByNumber(code.number);
        selected = box?.id ?? null;
        return show(box ? { kind: 'box', box } : { kind: 'new', number: code.number });
      }

      const shelf = shelfById(code.shelf);
      if (!shelf) return show({ kind: 'error', title: `Regal ${code.shelf} fehlt`, text: 'Lege es unter „Mehr → Regale“ an.' });
      if (code.type === 'shelf') return show({ kind: 'shelf', shelf });
      if (code.level > shelf.levels) {
        return show({ kind: 'error', title: `Boden ${code.shelf}${code.level} fehlt`, text: `Regal ${shelf.id} hat nur ${plural(shelf.levels, 'Boden', 'Böden')}.` });
      }

      const loc = { shelf: shelf.id, level: code.level };
      const box = selected && boxById(selected);
      if (!box) return show({ kind: 'level', loc });
      selected = null;
      if (sameLoc(box.location, loc)) return show({ kind: 'already', box, loc });
      relocate(box, loc);
      show({ kind: 'moved', box, loc });
    }

    worker.onmessage = ({ data }) => {
      busy = false;
      if (data && !stopped) handle(data);
    };

    function loop(t) {
      raf = requestAnimationFrame(loop);
      if (busy || !stream || t - lastFrame < SCAN_INTERVAL || video.readyState < 2) return;
      lastFrame = t;
      // Decode the centre of the frame, roughly what the viewfinder shows.
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const side = Math.min(vw, vh) * 0.85;
      const size = Math.min(560, Math.round(side));
      canvas.width = canvas.height = size;
      ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      busy = true;
      worker.postMessage({ width: size, height: size, buffer: data.buffer }, [data.buffer]);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        hint.textContent = 'Die Kamera ist nur verfügbar, wenn die App über HTTPS geöffnet wird. Du kannst die Nummer auch eingeben.';
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stopped) return s.getTracks().forEach((tr) => tr.stop());
        stream = s;
        video.srcObject = s;
        await video.play().catch(() => {});
        root.querySelector('.scan').classList.add('live');
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      } catch (err) {
        hint.textContent =
          err.name === 'NotAllowedError'
            ? 'Kein Kamerazugriff. Erlaube ihn in den Einstellungen deines Geräts – oder gib die Nummer ein.'
            : 'Die Kamera konnte nicht gestartet werden. Du kannst die Nummer auch eingeben.';
      }
    }

    function pause() {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
      stream = null;
      busy = false;
      root.querySelector('.scan').classList.remove('live');
    }

    root.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-scan]')?.dataset.scan;
      if (!action) return;
      if (action === 'dismiss') {
        selected = null;
        show(null);
      } else if (action === 'open-box') navigate(`/kiste/${card.box.number}`);
      else if (action === 'open-level') navigate(`/regal/${card.loc.shelf}/${card.loc.level}`);
      else if (action === 'open-shelf') navigate(`/regal/${card.shelf.id}`);
      else if (action === 'manual') {
        const value = await promptDialog({ title: 'Kistennummer', message: 'Die Nummer vom Etikett, z. B. 42.', inputmode: 'numeric', placeholder: '042', confirm: 'Suchen' });
        const n = parseInt(value ?? '', 10);
        if (n > 0) {
          last = { text: '', at: 0 };
          handle(String(n));
        }
      } else if (action === 'create') {
        // Pause the camera while the form (and maybe the photo camera) is open.
        pause();
        const sheet = openBoxEditor({
          preset: { number: card.number },
          onSaved: (box) => {
            const placed = box.location && !box.location.away;
            selected = placed ? null : box.id;
            show(placed ? { kind: 'moved', box, loc: box.location } : { kind: 'box', box });
          },
        });
        await sheet.closed;
        if (!stopped) start();
      }
    });

    const onVisibility = () => (document.hidden ? pause() : !stopped && !document.querySelector('.sheet-layer') && start());
    document.addEventListener('visibilitychange', onVisibility);
    start();

    return () => {
      stopped = true;
      pause();
      worker.terminate();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  },
};

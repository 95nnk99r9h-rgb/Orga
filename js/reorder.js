// Hold-and-drag reordering of the number chips within one row ([data-reorder]).
// Touch: hold a chip briefly to pick it up – moving earlier means scrolling.
// Mouse: press and move. A short tap still follows the link.

import { haptic } from './haptics.js';

const HOLD_MS = 350;
const TOUCH_SLOP = 8;
const MOUSE_SLOP = 4;

const chipsOf = (row) => [...row.querySelectorAll('.box-chip')];

export function enableReorder(root, onReorder) {
  let pending = null; // { chip, row, x, y, timer } – pressed, not yet lifted
  let drag = null; // { chip, row, startIds }
  let swallowClicksUntil = 0;
  let lastTouch = 0;

  const rowFor = (target) => {
    const chip = target.closest?.('.box-chip');
    const row = chip?.closest('[data-reorder]');
    return row && root.contains(row) && chipsOf(row).length > 1 ? { chip, row } : null;
  };

  function begin() {
    const { chip, row } = pending;
    clearTimeout(pending.timer);
    pending = null;
    drag = { chip, row, startIds: chipsOf(row).map((c) => c.dataset.id) };
    chip.classList.add('dragging');
    row.classList.add('reordering');
    haptic(); // the chip is free to move
  }

  // Put the dragged chip before or after the chip under the pointer and let
  // the others glide into their new places.
  function move(x, y) {
    const { chip, row } = drag;
    const chips = chipsOf(row);
    const target = document.elementFromPoint(x, y)?.closest('.box-chip');
    let ref;
    if (target && target !== chip && target.parentElement === row) {
      const r = target.getBoundingClientRect();
      ref = x < r.left + r.width / 2 ? target : target.nextElementSibling;
    } else {
      const last = chips.at(-1).getBoundingClientRect();
      if (chips.at(-1) === chip || y < last.top || x < last.right) return;
      ref = null; // past the last chip
    }
    if (ref === chip || ref === chip.nextElementSibling) return;

    const before = new Map(chips.map((c) => [c, c.getBoundingClientRect()]));
    row.insertBefore(chip, ref);
    for (const [c, r] of before) {
      if (c === chip) continue;
      const now = c.getBoundingClientRect();
      const dx = r.left - now.left;
      const dy = r.top - now.top;
      if (dx || dy) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 180, easing: 'ease-out' });
    }
  }

  function end() {
    if (pending) {
      clearTimeout(pending.timer);
      pending = null;
    }
    if (!drag) return;
    const { chip, row, startIds } = drag;
    drag = null;
    chip.classList.remove('dragging');
    row.classList.remove('reordering');
    swallowClicksUntil = Date.now() + 600; // the release must not open the box
    const ids = chipsOf(row).map((c) => c.dataset.id);
    if (ids.join() !== startIds.join()) {
      haptic(); // dropped at a new place
      onReorder(ids);
    }
  }

  // Touch
  root.addEventListener('touchstart', (e) => {
    lastTouch = Date.now();
    const hit = e.touches.length === 1 && rowFor(e.target);
    if (!hit) return;
    const t = e.touches[0];
    pending = { ...hit, x: t.clientX, y: t.clientY, timer: setTimeout(begin, HOLD_MS) };
    const { chip } = hit;
    const onMove = (ev) => {
      const p = ev.touches[0];
      if (drag) {
        ev.preventDefault(); // keep the page still while dragging
        move(p.clientX, p.clientY);
      } else if (pending && Math.hypot(p.clientX - pending.x, p.clientY - pending.y) > TOUCH_SLOP) {
        clearTimeout(pending.timer);
        pending = null;
      }
    };
    const onEnd = () => {
      chip.removeEventListener('touchmove', onMove);
      chip.removeEventListener('touchend', onEnd);
      chip.removeEventListener('touchcancel', onEnd);
      end();
    };
    chip.addEventListener('touchmove', onMove, { passive: false });
    chip.addEventListener('touchend', onEnd);
    chip.addEventListener('touchcancel', onEnd);
  }, { passive: true });

  // Mouse (ignoring the mouse events browsers emulate after a touch)
  root.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || Date.now() - lastTouch < 800) return;
    const hit = rowFor(e.target);
    if (!hit) return;
    pending = { ...hit, x: e.clientX, y: e.clientY, timer: 0 };
    const onMove = (ev) => {
      if (pending && Math.hypot(ev.clientX - pending.x, ev.clientY - pending.y) > MOUSE_SLOP) begin();
      if (drag) {
        ev.preventDefault();
        move(ev.clientX, ev.clientY);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      end();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  root.addEventListener('contextmenu', (e) => {
    if (pending || drag) e.preventDefault();
  });
  root.addEventListener('click', (e) => {
    if (Date.now() < swallowClicksUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

// App shell: routing, tab bar, navigation bar behaviour and boot.

import { init, state, subscribe } from './store.js';
import { html, raw, icon, toast } from './ui.js';
import { hydratePhotos } from './components.js';
import { setRenderer, navigate, switchTab, back, currentPath, depth } from './router.js';
import home from './views/home.js';
import { shelvesView, shelfView, levelView, zoneView } from './views/shelves.js';
import { boxView, newBox } from './views/box.js';
import scan from './views/scan.js';
import labels from './views/labels.js';
import { moreView, shelfSettingsView, categorySettingsView } from './views/settings.js';
import guide from './views/guide.js';
import welcome from './views/welcome.js';

const ROUTES = [
  ['/', home],
  ['/regale', shelvesView],
  ['/regal/:shelf', shelfView],
  ['/regal/:shelf/:level', levelView],
  ['/platz/:zone', zoneView],
  ['/kiste/:number', boxView],
  ['/scan', scan],
  ['/etiketten', labels],
  ['/mehr', moreView],
  ['/mehr/regale', shelfSettingsView],
  ['/mehr/kategorien', categorySettingsView],
  ['/system', guide],
  ['/willkommen', welcome],
].map(([pattern, view]) => {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}/?$`);
  return { re, keys, view };
});

const TABS = [
  { path: '/', id: 'home', label: 'Suchen', icon: 'search' },
  { path: '/regale', id: 'shelves', label: 'Lager', icon: 'shelves' },
  { path: '/scan', id: 'scan', label: 'Scannen', icon: 'scan' },
  { path: '/etiketten', id: 'labels', label: 'Etiketten', icon: 'tag' },
  { path: '/mehr', id: 'more', label: 'Mehr', icon: 'more' },
];

const viewEl = document.getElementById('view');
const tabbarEl = document.getElementById('tabbar');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let current = null;
let activeTab = 'home';

function match(path) {
  for (const r of ROUTES) {
    const m = r.re.exec(path);
    if (m) return { view: r.view, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

function renderTabbar(hidden) {
  tabbarEl.hidden = !!hidden;
  tabbarEl.innerHTML = String(html`
    <div class="tabbar-inner glass">
      ${TABS.map(
        (t) => html`
          <a href="#${t.path}" data-tab class="tab ${t.id === activeTab ? 'active' : ''}" ${t.id === activeTab ? raw('aria-current="page"') : ''}>
            ${icon(t.icon)}<span>${t.label}</span>
          </a>`,
      )}
    </div>`);
}

function updateNavBar() {
  const nav = viewEl.querySelector('[data-nav]');
  if (!nav) return;
  const anchor = viewEl.querySelector('[data-title-anchor]');
  const navBottom = nav.getBoundingClientRect().bottom;
  nav.classList.toggle('scrolled', window.scrollY > 2);
  nav.classList.toggle('show-title', !anchor || anchor.getBoundingClientRect().bottom < navBottom);
}

function render() {
  let path = currentPath();
  if (!state.meta.setupDone) path = '/willkommen';
  else if (path === '/willkommen') path = '/';
  const m = match(path) ?? match('/');
  const d = depth();
  const same = current?.path === path;
  const scrollY = window.scrollY;

  current?.cleanup?.();
  if (m.view.tab) activeTab = m.view.tab;

  // A fresh container per render, so view listeners vanish with it.
  const container = document.createElement('div');
  container.className = `view-inner ${m.view.className ?? ''}`;
  container.innerHTML = String(m.view.render(m.params));
  viewEl.replaceChildren(container);
  document.body.classList.toggle('dark-view', m.view.className === 'view-scan');

  const cleanup = m.view.mount?.(container, m.params);
  const prevDepth = current?.depth ?? d;
  current = { path, view: m.view, depth: d, cleanup };

  renderTabbar(m.view.hideTabbar);
  hydratePhotos(container);
  const title = typeof m.view.title === 'function' ? m.view.title(m.params) : m.view.title;
  document.title = title ? `${title} – Fundort` : 'Fundort';

  if (same) window.scrollTo(0, scrollY);
  else {
    window.scrollTo(0, 0);
    if (!reduceMotion.matches) {
      // Push/pop slides; tab switches only fade (a transform would turn the
      // fixed nav and scanner into children of the animated box).
      const dx = d > prevDepth ? 28 : d < prevDepth ? -28 : 0;
      const frames = dx
        ? [{ opacity: 0.4, transform: `translateX(${dx}px)` }, { opacity: 1, transform: 'none' }]
        : [{ opacity: 0 }, { opacity: 1 }];
      container.animate(frames, { duration: dx ? 300 : 180, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }
  updateNavBar();
}

setRenderer(render);

document.addEventListener('click', (e) => {
  const backBtn = e.target.closest('[data-action="back"]');
  if (backBtn) {
    e.preventDefault();
    return back(backBtn.dataset.fallback || '/');
  }
  if (e.target.closest('[data-action="new-box"]')) return newBox();

  const a = e.target.closest('a[href^="#/"]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  const path = a.getAttribute('href').slice(1);
  // Links inside a sheet close it first.
  a.closest('.sheet-layer')?.querySelector('[data-sheet-close]')?.click();
  if ('tab' in a.dataset) {
    if (path === currentPath()) window.scrollTo({ top: 0, behavior: 'smooth' });
    else switchTab(path);
  } else if (path !== currentPath()) navigate(path);
});

window.addEventListener('popstate', () => render());
window.addEventListener('scroll', () => requestAnimationFrame(updateNavBar), { passive: true });
window.addEventListener('fundort:error', () => toast('Speichern fehlgeschlagen', 'warning'));
document.addEventListener('touchstart', () => {}, { passive: true }); // enables :active on iOS

subscribe(() => {
  if (!current?.view.static) render();
});

async function boot() {
  try {
    await init();
  } catch (err) {
    console.error(err);
    viewEl.innerHTML = String(html`
      <main class="page">
        <div class="empty">
          <span class="empty-icon">${icon('warning')}</span>
          <h2>Speicher nicht verfügbar</h2>
          <p>Fundort braucht lokalen Speicher. Im privaten Modus mancher Browser ist er gesperrt.</p>
        </div>
      </main>`);
    return;
  }
  if (!history.state) history.replaceState({ depth: 0 }, '', location.href);
  render();
}

boot();

if ('serviceWorker' in navigator && !new URLSearchParams(location.search).has('nosw')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

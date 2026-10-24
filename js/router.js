// Hash routing helpers. main.js registers the renderer; views only navigate.
// history.state.depth counts in-app pushes so "back" knows whether there is
// an in-app page to return to (a QR code can open a deep link directly).

let renderer = () => {};
export const setRenderer = (fn) => {
  renderer = fn;
};

export const currentPath = () => location.hash.slice(1) || '/';
export const depth = () => history.state?.depth ?? 0;

export function navigate(path, { replace = false } = {}) {
  const d = replace ? depth() : depth() + 1;
  history[replace ? 'replaceState' : 'pushState']({ depth: d }, '', `#${path}`);
  renderer();
}

export function switchTab(path) {
  history.replaceState({ depth: 0 }, '', `#${path}`);
  renderer();
}

export function back(fallback = '/') {
  if (depth() > 0) history.back();
  else navigate(fallback, { replace: true });
}

export const refresh = () => renderer();

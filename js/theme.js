// Appearance: follow the system ("auto") or force light or dark. The choice
// is a per-device preference; index.html applies it before the first paint.

const KEY = 'fundort.theme';
const BAR = { light: '#f3ece0', dark: '#0f1918' };

export const THEMES = [
  ['auto', 'Automatisch'],
  ['light', 'Hell'],
  ['dark', 'Dunkel'],
];

export function getTheme() {
  try {
    return localStorage.getItem(KEY) || 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(theme = getTheme()) {
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
  // Status bar and browser chrome follow the chosen mode as well.
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const own = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = BAR[theme === 'auto' ? own : theme];
  }
}

export function setTheme(theme) {
  try {
    if (theme === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Storage blocked: the choice still applies until the app is closed.
  }
  applyTheme(theme);
}

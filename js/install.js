// "Add to Home Screen". Safari on iOS has no install prompt, so the app
// explains the taps itself; Chrome and Android get their native prompt.

import { html, icon, openSheet } from './ui.js';

const HINT_KEY = 'fundort.installHintDismissed';

export const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
// iPadOS reports itself as a Mac, so check for touch as well.
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
});

export const canInstall = () => !isStandalone() && (isIOS() || !!deferredPrompt);

function hintDismissed() {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissInstallHint() {
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    // Private mode: the hint simply shows again next time.
  }
}

export const showInstallHint = () => canInstall() && !hintDismissed();

export const installCard = () => html`
  <div class="card install-card">
    <img src="icons/icon-180.png" alt="" width="46" height="46">
    <span class="cell-text">
      <span class="cell-title">Fundort als App</span>
      <span class="cell-sub wrap">Im Vollbild und auch ohne Netz.</span>
    </span>
    <button class="pill-btn tint small" data-action="install">Laden</button>
    <button class="icon-btn" data-action="dismiss-install" aria-label="Hinweis ausblenden">${icon('xmark')}</button>
  </div>`;

const step = (n, title, sub) => html`
  <div class="cell step">
    <span class="step-num">${n}</span>
    <span class="cell-text"><span class="cell-title">${title}</span><span class="cell-sub wrap">${sub}</span></span>
  </div>`;

export async function install() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    return;
  }
  openSheet({
    title: 'Zum Home-Bildschirm',
    body: html`
      <div class="install-hero">
        <img src="icons/icon-180.png" alt="" width="84" height="84">
        <h3>Fundort installieren</h3>
        <p>Ein paar Taps in Safari – danach startet Fundort wie jede andere App, im Vollbild und auch ohne Netz im Keller.</p>
      </div>
      <div class="list">
        ${step(1, html`Auf ${icon('share', 'inline')} „Teilen“ tippen`, 'In der Safari-Leiste. Bei neueren iOS-Versionen zuerst auf „•••“ tippen.')}
        ${step(2, '„Zum Home-Bildschirm“ wählen', 'Falls nicht sichtbar: in der Liste nach unten scrollen.')}
        ${step(3, '„Hinzufügen“ tippen', 'Fundort erscheint mit eigenem Symbol auf dem Home-Bildschirm.')}
      </div>
      <p class="section-foot"><strong>Wichtig:</strong> Safari und die installierte App speichern ihre Daten getrennt. Am besten erst installieren und dann loslegen. Hast du hier schon etwas erfasst, nimm es per Backup mit: „Mehr → Backup erstellen“ und in der App „Backup wiederherstellen“.</p>`,
  });
}

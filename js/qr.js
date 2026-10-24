// QR codes for labels. Numbered labels link to #/kiste/<n>, level labels to
// #/regal/<A>/<level>, zone labels to #/platz/<S1>; the scanner only looks at
// that hash part, so printed labels keep working if the app moves.

import qrcode from '../vendor/qrcode.mjs';

export const appBase = () => location.origin + location.pathname.replace(/index\.html$/, '');
export const boxCode = (n) => `${appBase()}#/kiste/${n}`;
export const levelCode = (shelf, level) => `${appBase()}#/regal/${shelf}/${level}`;
export const shelfCode = (shelf) => `${appBase()}#/regal/${shelf}`;
export const zoneCode = (zone) => `${appBase()}#/platz/${zone}`;
export const householdLink = (code) => `${appBase()}#/haushalt/${code}`;

export function parseCode(text) {
  let m = /#\/kiste\/(\d{1,4})\b/.exec(text) ?? /^\s*(\d{1,4})\s*$/.exec(text);
  if (m) return { type: 'box', number: Number(m[1]) };
  m = /#\/regal\/([A-Z]{1,2})\/(\d{1,2})\b/i.exec(text);
  if (m) return { type: 'level', shelf: m[1].toUpperCase(), level: Number(m[2]) };
  m = /#\/regal\/([A-Z]{1,2})\/?$/i.exec(text);
  if (m) return { type: 'shelf', shelf: m[1].toUpperCase() };
  m = /#\/platz\/(S\d{1,3})\b/i.exec(text);
  if (m) return { type: 'zone', zone: m[1].toUpperCase() };
  m = /#\/haushalt\/([0-9A-Z]{12})\b/i.exec(text);
  if (m) return { type: 'household', code: m[1].toUpperCase() };
  return null;
}

export function qrSVG(text, { ecc = 'M', margin = 0 } = {}) {
  const qr = qrcode(0, ecc);
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const size = n + margin * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; ) {
      if (!qr.isDark(r, c)) {
        c++;
        continue;
      }
      let len = 1;
      while (c + len < n && qr.isDark(r, c + len)) len++;
      d += `M${c + margin} ${r + margin}h${len}v1h-${len}z`;
      c += len;
    }
  }
  return `<svg class="qr" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-hidden="true"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

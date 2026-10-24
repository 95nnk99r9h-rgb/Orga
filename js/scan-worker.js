// Decodes QR codes off the main thread so the camera preview stays smooth.
importScripts('../vendor/jsQR.js');

self.onmessage = ({ data }) => {
  const pixels = new Uint8ClampedArray(data.buffer);
  const code = self.jsQR(pixels, data.width, data.height, { inversionAttempts: 'dontInvert' });
  self.postMessage(code ? code.data : null);
};

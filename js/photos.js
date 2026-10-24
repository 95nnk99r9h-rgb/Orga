// Downscale camera photos before storing them: full size for the viewer,
// a small thumbnail for lists. Drawing an <img> respects EXIF orientation.

function toJPEG(img, max, quality) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Das Foto konnte nicht verarbeitet werden.'))), 'image/jpeg', quality),
  );
}

async function loadImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// A smaller copy, e.g. for uploading to the household.
export const shrink = async (blob, max, quality) => toJPEG(await loadImage(blob), max, quality);

export async function processImage(file) {
  const img = await loadImage(file);
  return { full: await toJPEG(img, 1600, 0.82), thumb: await toJPEG(img, 360, 0.72) };
}

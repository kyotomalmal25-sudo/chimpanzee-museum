import { UPLOAD } from './config.js';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

export function checkFile(file) {
  if (!ACCEPT.includes(file.type)) throw new Error('JPEG・PNG・WebP・GIF・AVIFの画像を選んでください。');
  if (!file.size || file.size > UPLOAD.maxInputBytes) throw new Error('画像は40MB以下にしてください。');
}

async function encode(bitmap, maxEdge, quality) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
  // Browsers without WebP encoding hand back PNG; fall back to JPEG instead.
  if (!blob || blob.type !== 'image/webp') blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('画像の変換に失敗しました。');
  return { blob, width: w, height: h, ext: blob.type === 'image/webp' ? 'webp' : 'jpg' };
}

// Returns a display-size image and a thumbnail, both resized in the browser.
// Animated GIFs keep their original file as the display image.
export async function processImage(file) {
  checkFile(file);
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('画像を読み込めませんでした。別の形式で試してください。'); }
  try {
    const thumb = await encode(bitmap, UPLOAD.thumbMaxEdge, UPLOAD.thumbQuality);
    const full = file.type === 'image/gif'
      ? { blob: file, width: bitmap.width, height: bitmap.height, ext: 'gif' }
      : await encode(bitmap, UPLOAD.fullMaxEdge, UPLOAD.fullQuality);
    return { full, thumb };
  } finally { bitmap.close?.(); }
}

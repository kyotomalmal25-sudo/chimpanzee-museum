export const AI_NAMES = ['GPT', 'Claude', 'Gemini', 'Qwen', 'Kimi', 'Other', 'Unknown'];
export const aiLabel = (ai) => ai === 'Unknown' ? '未分類' : ai === 'Other' ? 'その他' : ai;
export const filterWorks = (works, ai) => ai === 'ALL' ? works : works.filter(work => work.ai === ai);
export function imageUrl(work) {
  const url = new URL(work.file, location.href);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('画像URLが不正です。');
  return url.href;
}
export function validateFile(file) {
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  if (!extensions[file.type]) throw new Error('JPEG・PNG・WebP・GIFの画像を選んでください。');
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('画像は10MB以下にしてください。');
  return extensions[file.type];
}

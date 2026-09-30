import { SUPABASE } from './config.js';
import { processImage } from './image.js';

const lib = globalThis.supabase;
export const client = SUPABASE.url && SUPABASE.publishableKey && lib
  ? lib.createClient(SUPABASE.url, SUPABASE.publishableKey, {
    auth: { storageKey: 'chimpanzee-museum-auth', detectSessionInUrl: false },
  })
  : null;

const bucket = () => client.storage.from(SUPABASE.bucket);
const table = () => client.from(SUPABASE.table);

// New uploads: `artworks/<uuid>.full.<ext>` + `artworks/<uuid>.thumb.<ext>` (same ext).
// An animated GIF keeps its original as the full image: `artworks/<uuid>.full.<thumbExt>.gif`.
// Older rows (single original image) have no thumbnail and use the full file.
const FULL_RE = /\.full\.(?:(webp|jpg)\.)?([a-z0-9]+)$/i;
export const thumbPathOf = storagePath => {
  const m = storagePath && storagePath.match(FULL_RE);
  return m ? storagePath.replace(FULL_RE, `.thumb.${m[1] || m[2]}`) : null;
};
const resolve = file => new URL(file, /^[a-z]+:/i.test(file) ? undefined : (SUPABASE.legacyBase || location.origin + '/'));
export function thumbUrl(work) {
  if (work.thumb) return work.thumb;
  const path = thumbPathOf(work.storage_path);
  return path && client ? bucket().getPublicUrl(path).data.publicUrl : fullUrl(work);
}
export function fullUrl(work) {
  if (work.sample) return work.file;
  const url = resolve(work.file);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('画像URLが不正です。');
  return url.href;
}

export async function loadWorks() {
  const all = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await table().select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(start, start + 499);
    if (error) throw error;
    all.push(...data);
    if (data.length < 500) return all;
  }
}

export async function isAdmin(session) {
  if (!session) return false;
  const { data, error } = await client.from(SUPABASE.admins).select('user_id').eq('user_id', session.user.id).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function signIn(email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error('ログインできませんでした。メールアドレスとパスワードを確認してください。');
  return data.session;
}
export async function signOut() {
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw new Error('ログアウトに失敗しました。');
}

async function removePaths(paths) {
  const list = paths.filter(Boolean);
  if (!list.length) return null;
  try { const { error } = await bucket().remove(list); return error; }
  catch (error) { return error; }
}

async function uploadImage(file, onStep) {
  onStep?.('縮小しています');
  const { full, thumb } = await processImage(file);
  const id = crypto.randomUUID();
  const fullPath = full.ext === 'gif' ? `artworks/${id}.full.${thumb.ext}.gif` : `artworks/${id}.full.${full.ext}`;
  const thumbPath = `artworks/${id}.thumb.${thumb.ext}`;
  onStep?.('アップロード中');
  const opts = blob => ({ contentType: blob.type, cacheControl: '31536000', upsert: false });
  const a = await bucket().upload(fullPath, full.blob, opts(full.blob));
  if (a.error) throw a.error;
  const b = await bucket().upload(thumbPath, thumb.blob, opts(thumb.blob));
  if (b.error) { await removePaths([fullPath]); throw b.error; }
  return { fullPath, thumbPath, url: bucket().getPublicUrl(fullPath).data.publicUrl };
}

// original = null → insert. file = null → keep current image.
export async function saveWork(original, values, file, onStep) {
  if (!original && !file) throw new Error('画像を選んでください。');
  let uploaded = null;
  if (file) {
    uploaded = await uploadImage(file, onStep);
    values = { ...values, storage_path: uploaded.fullPath, file: uploaded.url };
  }
  onStep?.('保存中');
  let safeToCleanup = false;
  try {
    const query = original
      ? table().update(values).eq('id', original.id).eq('updated_at', original.updated_at)
      : table().insert(values);
    const { data, error, status } = await query.select().maybeSingle();
    if (error) { safeToCleanup = status >= 400 && status < 500; throw error; }
    if (!data) { safeToCleanup = true; throw new Error('別の画面で作品が変更されました。再読み込みしてください。'); }
    const cleanupError = uploaded && original?.storage_path
      ? await removePaths([original.storage_path, thumbPathOf(original.storage_path)])
      : null;
    return { work: data, cleanupError };
  } catch (error) {
    if (uploaded && safeToCleanup) await removePaths([uploaded.fullPath, uploaded.thumbPath]);
    if (uploaded && !safeToCleanup) throw new Error('保存結果を確認できませんでした。再読み込みして確認してください。');
    throw error;
  }
}

export async function deleteWork(work) {
  const { data, error } = await table().delete().eq('id', work.id).eq('updated_at', work.updated_at).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('別の画面で作品が変更されました。再読み込みしてください。');
  return work.storage_path ? removePaths([work.storage_path, thumbPathOf(work.storage_path)]) : null;
}

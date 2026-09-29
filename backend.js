import { config } from './config.js';
import { validateFile } from './model.js';

export const client = config.url && config.publishableKey ? globalThis.supabase.createClient(config.url, config.publishableKey, {
  auth: { storageKey: 'chimpanzee-museum-auth', detectSessionInUrl: false }
}) : null;
export const bucket = () => client.storage.from('museum-images');
export async function loadWorks() {
  const all = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await client.from('museum_works').select('*')
      .order('sort_order').order('created_at', { ascending: false }).order('id').range(start, start + 499);
    if (error) throw error;
    all.push(...data);
    if (data.length < 500) return all;
  }
}
export async function isAdmin(session) {
  if (!session) return false;
  const { data, error } = await client.from('museum_admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
export async function saveWork(original, values, file) {
  let uploaded = null;
  let safeToCleanup = false;
  if (file) {
    const extension = validateFile(file);
    uploaded = `artworks/${crypto.randomUUID()}.${extension}`;
    const { error } = await bucket().upload(uploaded, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    values = { ...values, storage_path: uploaded, file: bucket().getPublicUrl(uploaded).data.publicUrl };
  }
  if (!original && !uploaded) throw new Error('画像を選んでください。');
  try {
    const query = original
      ? client.from('museum_works').update(values).eq('id', original.id).eq('updated_at', original.updated_at)
      : client.from('museum_works').insert(values);
    const { data, error, status } = await query.select().maybeSingle();
    if (error) {
      safeToCleanup = status >= 400 && status < 500;
      throw error;
    }
    if (!data) {
      safeToCleanup = true;
      throw new Error('別の画面で作品が変更されました。一覧を再読み込みしてください。');
    }
    const cleanupError = uploaded && original?.storage_path ? await removeImage(original.storage_path) : null;
    return { work: data, cleanupError };
  } catch (error) {
    if (uploaded && safeToCleanup) {
      const cleanupError = await removeImage(uploaded);
      if (cleanupError) throw new Error(`${error.message} 未使用の画像の削除にも失敗しました。管理者に確認してください。`);
    }
    if (uploaded && !safeToCleanup) throw new Error('保存結果を確認できませんでした。一覧を再読み込みして確認してください。画像ファイルは保持しています。');
    throw error;
  }
}
async function removeImage(path) {
  try { const { error } = await bucket().remove([path]); return error; }
  catch (error) { return error; }
}
export async function deleteWork(work) {
  const { data, error } = await client.from('museum_works').delete().eq('id', work.id)
    .eq('updated_at', work.updated_at).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('別の画面で作品が変更されました。一覧を再読み込みしてください。');
  return work.storage_path ? await removeImage(work.storage_path) : null;
}

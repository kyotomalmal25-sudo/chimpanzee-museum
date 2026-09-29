import { client, loadWorks, isAdmin, saveWork, deleteWork } from './backend.js';
import { AI_NAMES, aiLabel, filterWorks, imageUrl, validateFile } from './model.js';

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
let works = [], page = 0, selectedAI = 'ALL', admin = false, editing = null, busy = false, lastFocus;
let loadGeneration = 0, authGeneration = 0;
function notify(message = '', error = false, id = 'notice') {
  $(id).textContent = message; $(id).dataset.error = String(error);
}
function render() {
  const filtered = filterWorks(works, selectedAI);
  const pages = Math.max(1, Math.ceil(filtered.length / 9));
  page = Math.max(0, Math.min(page, pages - 1));
  $('filters').innerHTML = ['ALL', ...AI_NAMES].map(ai => `<button class="filter" type="button" data-ai="${ai}" aria-pressed="${ai === selectedAI}">${ai === 'ALL' ? 'ALL' : aiLabel(ai)}</button>`).join('');
  $('gallery').innerHTML = filtered.slice(page * 9, page * 9 + 9).map(work => `<article class="card" data-id="${escapeHtml(work.id)}"><button class="image-button" type="button" data-action="view" aria-label="${escapeHtml(work.title)}を拡大"><img src="${escapeHtml(imageUrl(work))}" alt="${escapeHtml(work.alt || work.title)}" loading="lazy"></button><div class="card-meta"><div class="filename" title="${escapeHtml(work.title)}">${escapeHtml(work.title)}</div><span class="ai-credit">${escapeHtml(aiLabel(work.ai))}</span></div>${admin ? '<div class="card-actions"><button type="button" class="admin-link" data-action="edit">編集</button><button type="button" class="admin-link" data-action="delete">削除</button></div>' : ''}</article>`).join('') || '<div class="empty"><p><strong>NO EXHIBITS YET</strong>このAIの作品はまだありません</p></div>';
  $('countLabel').textContent = `${filtered.length} ${filtered.length === 1 ? 'IMAGE' : 'IMAGES'} / ${selectedAI === 'ALL' ? 'PUBLIC ARCHIVE' : aiLabel(selectedAI)}`;
  $('pageLabel').textContent = `${page + 1} / ${pages}`;
  $('prevButton').disabled = page === 0; $('nextButton').disabled = page >= pages - 1;
  $('newButton').hidden = !admin; $('logoutButton').hidden = !admin;
  $('adminButton').hidden = admin;
  document.querySelectorAll('.card-actions button, #newButton, #logoutButton').forEach(button => button.disabled = busy);
}
async function reload() {
  const generation = ++loadGeneration;
  const result = client ? await loadWorks() : await fetch('manifest.json', { cache: 'no-store' }).then(async response => {
    if (!response.ok) throw new Error('作品一覧を読み込めません。');
    const data = await response.json();
    return (data.images || data).map(work => ({ ...work, id: work.file, title: work.name, ai: work.ai || 'Unknown' }));
  });
  if (generation !== loadGeneration) return;
  works = result; render();
}
function setBusy(value) {
  busy = value;
  document.querySelectorAll('#editDialog button, #editDialog input, #editDialog select, #editDialog textarea, .card-actions button, #newButton, #logoutButton').forEach(element => element.disabled = value);
}
function openEditor(work = null) {
  editing = work; $('editForm').reset();
  $('editHeading').textContent = work ? '作品を編集' : '作品を投稿';
  $('titleInput').value = work?.title || '';
  $('altInput').value = work?.alt || '';
  $('aiInput').value = work?.ai || (selectedAI === 'ALL' ? 'Unknown' : selectedAI);
  $('fileInput').required = !work;
  $('fileHint').textContent = work ? '画像を選ぶと差し替えます。未選択なら現在の画像を維持します。' : 'JPEG・PNG・WebP・GIF / 10MB以下';
  notify('', false, 'editNotice'); $('editDialog').showModal();
}
async function updateAuth(session) {
  const generation = ++authGeneration;
  admin = false; render();
  try {
    const allowed = client ? await isAdmin(session) : false;
    if (generation !== authGeneration) return;
    admin = allowed; render();
    if (!allowed && session) notify('このアカウントには管理権限がありません。', true, 'loginNotice');
    if (!session && $('editDialog').open && !busy) $('editDialog').close();
  } catch { if (generation === authGeneration) notify('管理権限を確認できませんでした。再度ログインしてください。', true); }
}
$('filters').addEventListener('click', event => {
  const ai = event.target.closest('[data-ai]')?.dataset.ai;
  if (ai) { selectedAI = ai; page = 0; render(); }
});
$('prevButton').onclick = () => { page--; render(); };
$('nextButton').onclick = () => { page++; render(); };
function closeLightbox() { $('lightbox').hidden = true; $('lightboxImage').removeAttribute('src'); lastFocus?.focus(); }
$('closeButton').onclick = closeLightbox;
$('lightbox').onclick = event => { if (event.target === $('lightbox')) closeLightbox(); };
document.addEventListener('keydown', event => {
  if ($('lightbox').hidden) return;
  if (event.key === 'Escape') closeLightbox();
  if (event.key === 'Tab') { event.preventDefault(); $('closeButton').focus(); }
});
$('gallery').addEventListener('click', async event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  const id = event.target.closest('.card')?.dataset.id;
  const work = works.find(item => item.id === id);
  if (!work) return;
  if (action === 'view') {
    lastFocus = event.target.closest('button');
    $('lightboxImage').src = imageUrl(work); $('lightboxImage').alt = work.alt || work.title;
    $('lightboxCaption').textContent = `${work.title} / ${aiLabel(work.ai)}`;
    $('lightbox').hidden = false; $('closeButton').focus(); return;
  }
  if (!admin || busy) return;
  if (action === 'edit') openEditor(work);
  if (action === 'delete' && confirm(`「${work.title}」を公開アーカイブから削除しますか？`)) {
    setBusy(true);
    try {
      const cleanupError = await deleteWork(work);
      works = works.filter(item => item.id !== work.id); render();
      notify(cleanupError ? '作品は削除しましたが、画像ファイルの削除に失敗しました。' : '作品を削除しました。', Boolean(cleanupError));
    } catch (error) { notify(error.message || '削除に失敗しました。', true); }
    finally { setBusy(false); }
  }
});
$('newButton').onclick = () => { if (admin && !busy) openEditor(); };
$('editCancel').onclick = () => { if (!busy) $('editDialog').close(); };
$('editDialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
$('editForm').addEventListener('submit', async event => {
  event.preventDefault(); if (!admin || busy) return;
  const values = { title: $('titleInput').value.trim(), alt: $('altInput').value.trim(), ai: $('aiInput').value };
  const file = $('fileInput').files[0];
  try {
    if (!values.title) throw new Error('作品名を入力してください。');
    if (file) validateFile(file);
    setBusy(true); notify('保存しています…', false, 'editNotice');
    const { work, cleanupError } = await saveWork(editing, values, file);
    if (editing) works = works.map(item => item.id === work.id ? work : item);
    else { works.unshift(work); selectedAI = 'ALL'; page = 0; }
    $('editDialog').close(); render();
    notify(cleanupError ? '作品は保存しましたが、旧画像の削除に失敗しました。' : '作品を保存しました。', Boolean(cleanupError));
  } catch (error) { notify(error.message || '保存に失敗しました。', true, 'editNotice'); }
  finally { setBusy(false); }
});
$('adminButton').onclick = () => {
  if (!client) { notify('管理機能の保存先が未設定です。', true); return; }
  notify('', false, 'loginNotice'); $('loginDialog').showModal();
};
$('loginCancel').onclick = () => $('loginDialog').close();
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault(); $('loginSubmit').disabled = true;
  try {
    const { data, error } = await client.auth.signInWithPassword({ email: $('emailInput').value.trim(), password: $('passwordInput').value });
    $('passwordInput').value = '';
    if (error) throw new Error('ログインできませんでした。メールアドレスとパスワードを確認してください。');
    await updateAuth(data.session);
    if (admin) { $('loginDialog').close(); notify('管理モードです。'); }
  } catch (error) { notify(error.message, true, 'loginNotice'); }
  finally { $('loginSubmit').disabled = false; }
});
$('logoutButton').onclick = async () => {
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) { notify('ログアウトに失敗しました。', true); return; }
  await updateAuth(null); notify('ログアウトしました。');
};
$('retryButton').onclick = () => start();
async function start() {
  notify(''); $('retryButton').hidden = true;
  try { await reload(); }
  catch { $('gallery').innerHTML = '<div class="empty"><p><strong>ARCHIVE UNAVAILABLE</strong>作品一覧を読み込めませんでした</p></div>'; notify('接続を確認して再読み込みしてください。', true); $('retryButton').hidden = false; }
}
$('aiInput').innerHTML = AI_NAMES.map(ai => `<option value="${ai}">${aiLabel(ai)}</option>`).join('');
render(); start();
if (client) {
  client.auth.getSession().then(({ data, error }) => { if (!error) updateAuth(data.session); });
  // Avoid awaiting Supabase API calls inside the auth callback's lock.
  client.auth.onAuthStateChange((_event, session) => { setTimeout(() => updateAuth(session), 0); });
}

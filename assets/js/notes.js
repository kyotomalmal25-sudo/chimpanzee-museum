// Notes board: one-line notes, newest first. Anyone can read; only the admin can post or delete.
// Each note carries a whole-note style: bold, colour, size — nothing else.
import * as api from './backend.js';
import { COLORS } from './draw.js';
import { esc, store } from './util.js';

export const NOTE_MAX = 140;
export const SIZES = [
  { key: 's', label: 'S' },
  { key: 'm', label: 'M' },
  { key: 'l', label: 'L' },
  { key: 'xl', label: 'XL' },
];
const STYLE_KEY = 'cm-notes-style';
const DEMO = [
  { body: 'ここは、ひとことだけ書き残しておく場所。', bold: false, color: '#2B2622', size: 'm' },
  { body: '今日の空、低い太陽みたいだった。', bold: false, color: '#E0703C', size: 'l' },
  { body: 'らくがき帳にレイヤーが増えた。', bold: true, color: '#1F9A78', size: 'm' },
  { body: 'BANANAS NEED NO REASON.', bold: true, color: '#E9B949', size: 'xl' },
  { body: 'メモは管理者だけが書けて、誰でも読める。', bold: false, color: '#6C6057', size: 's' },
].map((n, i) => ({ ...n, id: `demo-${i}`, created_at: new Date(Date.now() - (i + 1) * 36e5 * 7).toISOString(), demo: true }));

const ICONS = {
  bold: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4h5a3 3 0 010 6H6zM6 10h6a3 3 0 010 6H6z" stroke-width="2"/></svg>',
  send: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 6l4 4-4 4"/></svg>',
  del: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>',
};

const when = iso => {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
};
const validColor = c => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#2B2622');
const validSize = s => (SIZES.some(x => x.key === s) ? s : 'm');

const noteRow = (n, admin) => `
  <li class="nt-note" data-note="${esc(n.id)}">
    <p class="nt-body size-${validSize(n.size)}${n.bold ? ' is-bold' : ''}" style="--nt-color:${validColor(n.color)}">${esc(n.body)}</p>
    <div class="nt-meta">
      <time class="mono" datetime="${esc(n.created_at)}">${when(n.created_at)}</time>
      ${admin && !n.demo ? `<button type="button" class="nt-del" data-act="note-del" title="このメモを消す" aria-label="このメモを消す">${ICONS.del}</button>` : ''}
    </div>
  </li>`;

export const notesView = ({ admin }) => `
  <div class="notes-app" id="notesApp">
    ${admin ? `
    <form class="nt-compose" id="ntForm" autocomplete="off">
      <div class="sk-bar nt-bar" role="toolbar" aria-label="書式">
        <div class="sk-group" role="group" aria-label="太さ">
          <button type="button" class="sk-tool" data-bold="false" aria-pressed="true" title="通常"><span class="nt-aa">Aa</span><span>通常</span></button>
          <button type="button" class="sk-tool" data-bold="true" aria-pressed="false" title="太字（Ctrl+B）">${ICONS.bold}<span>太字</span></button>
        </div>
        <div class="sk-group sk-colors" role="radiogroup" aria-label="色">
          ${COLORS.map((c, i) => `<button type="button" class="sk-color" data-color="${c}" role="radio" aria-checked="${i === 0}" aria-label="色 ${c}" style="--c:${c}"></button>`).join('')}
          <label class="sk-color sk-custom" title="好きな色"><input type="color" id="ntCustom" value="#3D3530" aria-label="好きな色を選ぶ"></label>
        </div>
        <div class="sk-group nt-sizes" role="radiogroup" aria-label="大きさ">
          ${SIZES.map(s => `<button type="button" class="sk-tool nt-size" data-nsize="${s.key}" role="radio" aria-checked="${s.key === 'm'}">${s.label}</button>`).join('')}
        </div>
      </div>
      <div class="nt-line">
        <input id="ntInput" class="nt-input size-m" maxlength="${NOTE_MAX}" placeholder="ひとこと書く…" aria-label="メモ">
        <span class="mono nt-count" id="ntCount">0/${NOTE_MAX}</span>
        <button class="btn" type="submit" id="ntSend" disabled>${ICONS.send}<span>書く</span></button>
      </div>
    </form>` : ''}
    <ol class="nt-list" id="ntList" aria-live="polite"><li class="nt-empty mono">LOADING…</li></ol>
  </div>`;

export function mountNotes(root, { admin, demo, onToast }) {
  const list = root.querySelector('#ntList');
  let notes = [];
  let style = { bold: false, color: COLORS[0], size: 'm' };
  try { style = { ...style, ...JSON.parse(store.get(STYLE_KEY, '{}')) }; } catch { /* default */ }

  const draw = () => {
    list.innerHTML = notes.length
      ? notes.map(n => noteRow(n, admin)).join('')
      : `<li class="nt-empty"><p class="mono">NO NOTES YET</p><p>${admin ? '上の欄から、最初のひとことを書いてみてください。' : 'まだメモはありません。'}</p></li>`;
  };
  const fail = err => {
    const missing = /relation|does not exist|schema cache|404|PGRST205/i.test(`${err?.message} ${err?.code}`);
    list.innerHTML = `<li class="nt-empty"><p class="mono">${missing ? 'BOARD NOT SET UP' : 'UNAVAILABLE'}</p><p>${missing
      ? (admin ? 'メモを保存する表がまだありません。Supabaseで準備用のSQLを実行してください。' : 'ひとこと帳は準備中です。')
      : 'メモを読み込めませんでした。時間をおいて再読み込みしてください。'}</p></li>`;
  };
  (async () => {
    if (demo) { notes = DEMO; draw(); return; }
    try { notes = await api.loadNotes(); draw(); } catch (err) { console.error(err); fail(err); }
  })();

  if (!admin) return { destroy() {} };

  // ─ composer ─
  const form = root.querySelector('#ntForm'), input = root.querySelector('#ntInput');
  const send = root.querySelector('#ntSend'), count = root.querySelector('#ntCount');
  const apply = () => {
    root.querySelectorAll('[data-bold]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.bold === 'true') === style.bold)));
    root.querySelectorAll('.sk-color[data-color]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.color.toLowerCase() === style.color.toLowerCase())));
    const custom = root.querySelector('.sk-custom');
    custom.setAttribute('aria-checked', String(!COLORS.some(c => c.toLowerCase() === style.color.toLowerCase())));
    custom.style.setProperty('--c', style.color);
    root.querySelectorAll('[data-nsize]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.nsize === style.size)));
    input.className = `nt-input size-${style.size}${style.bold ? ' is-bold' : ''}`;
    input.style.setProperty('--nt-color', style.color);
    store.set(STYLE_KEY, JSON.stringify(style));
  };
  const sync = () => {
    const len = [...input.value].length;
    count.textContent = `${len}/${NOTE_MAX}`;
    send.disabled = !input.value.trim() || demo;
  };
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-bold]'); if (b) { style.bold = b.dataset.bold === 'true'; apply(); input.focus(); return; }
    const c = e.target.closest('.sk-color[data-color]'); if (c) { style.color = c.dataset.color; apply(); input.focus(); return; }
    const s = e.target.closest('[data-nsize]'); if (s) { style.size = s.dataset.nsize; apply(); input.focus(); return; }
    const del = e.target.closest('[data-act="note-del"]');
    if (del) {
      const id = del.closest('[data-note]').dataset.note;
      const n = notes.find(x => String(x.id) === id); if (!n) return;
      if (!confirm(`「${n.body.slice(0, 30)}」を消しますか？`)) return;
      del.disabled = true;
      try { await api.deleteNote(n); notes = notes.filter(x => x !== n); draw(); onToast?.('メモを消しました。'); }
      catch (err) { del.disabled = false; onToast?.(err.message || '消せませんでした。', true); }
    }
  });
  root.querySelector('#ntCustom').addEventListener('input', e => { style.color = e.target.value; apply(); });
  input.addEventListener('input', sync);
  input.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); style.bold = !style.bold; apply(); }
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body || send.disabled) return;
    send.disabled = true; input.disabled = true;
    try {
      const note = await api.addNote({ body, bold: style.bold, color: validColor(style.color), size: style.size });
      notes = [note, ...notes]; draw();
      input.value = '';
    } catch (err) { console.error(err); onToast?.(err.message || '書き込めませんでした。', true); }
    finally { input.disabled = false; sync(); input.focus(); }
  });
  apply(); sync();
  return { destroy() {} };
}

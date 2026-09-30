import { SITE, AIS, DEFAULT_AI, aiByKey, aiBySlug, aiLabel } from './config.js';
import * as api from './backend.js';
import { SAMPLES } from './samples.js';
import { checkFile } from './image.js';
import { esc, pad3, fmtDate, store, titleFromFilename } from './util.js';
import { drawView, mountDraw } from './draw.js';
import { notesView, mountNotes } from './notes.js';

const $ = id => document.getElementById(id);
const main = $('main');

// ─── state ──────────────────────────────────────────────────────────────
const demo = (() => {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('demo')) sessionStorage.setItem('cm-demo', q.get('demo') === '0' ? '' : '1');
    return !api.client || Boolean(sessionStorage.getItem('cm-demo'));
  } catch { return !api.client; }
})();

const state = {
  status: 'loading', // loading | ready | error
  works: [],
  sample: false,
  admin: false,
  busy: false,
  size: store.get('cm-size', 'large'),
  selecting: false,
  selected: new Set(),
};
let numbers = new Map(); // id → chronological number (oldest = 1)
let route = { name: 'home' };
let firstRender = true;

const shown = () => (state.sample ? SAMPLES : state.works);
const byId = id => shown().find(w => String(w.id) === String(id));
const counts = () => {
  const c = new Map();
  for (const w of shown()) c.set(aiByKey(w.ai).key, (c.get(aiByKey(w.ai).key) || 0) + 1);
  return c;
};
function renumber() {
  const list = [...shown()].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
  numbers = new Map(list.map((w, i) => [String(w.id), i + 1]));
}
const noOf = w => pad3(numbers.get(String(w.id)) || 0);
const thumb = w => esc(api.thumbUrl(w));
const full = w => esc(w.sample ? w.file : api.fullUrl(w));
const titleOf = w => (w.title && w.title.trim()) || `WORK ${noOf(w)}`;

// ─── routing ────────────────────────────────────────────────────────────
function parse(pathname, search) {
  const p = pathname.replace(/\/+$/, '') || '/';
  const q = new URLSearchParams(search);
  let m;
  if (p === '/') return { name: 'home' };
  if (p === '/collection') return { name: 'collection', ai: null };
  if ((m = p.match(/^\/collection\/([a-z]+)$/)) && aiBySlug(m[1])) return { name: 'collection', ai: aiBySlug(m[1]) };
  if ((m = p.match(/^\/work\/([^/]+)$/))) return { name: 'work', id: decodeURIComponent(m[1]), ctx: aiBySlug(q.get('in') || '') };
  if (p === '/about') return { name: 'about' };
  if (p === '/draw') return { name: 'draw' };
  if (p === '/notes') return { name: 'notes' };
  if (p === '/admin') return { name: 'admin' };
  return { name: 'notfound' };
}
export function go(href, { replace = false, keepScroll = false } = {}) {
  const url = new URL(href, location.href);
  if (url.origin !== location.origin) { location.href = href; return; }
  history[replace ? 'replaceState' : 'pushState']({}, '', url.pathname + url.search);
  navigate(keepScroll);
}
function navigate(keepScroll = false) {
  const next = parse(location.pathname, location.search);
  if (next.name !== 'collection') { state.selecting = false; state.selected.clear(); }
  if (next.name === 'home' && route.name !== 'home') heroPickId = null;
  route = next;
  closeDrawer();
  render();
  if (!firstRender) {
    if (!keepScroll) window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
  firstRender = false;
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || /\.\w+$/.test(url.pathname)) return;
  e.preventDefault();
  go(url.pathname + url.search, { keepScroll: a.hasAttribute('data-keep-scroll') });
});
window.addEventListener('popstate', () => navigate(true));

// ─── chrome: nav / sidebar / drawer ─────────────────────────────────────
const ICON = {
  home: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 9 10 3.5 16.5 9v7.5h-4.5v-5h-4v5H3.5z"/></svg>',
  grid: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M10 3v14M3 10h14"/></svg>',
  about: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M10 9v5M10 6.2v.1"/></svg>',
  shuffle: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h3.2c1.6 0 2.6.8 3.5 2.2l.6 1c.9 1.4 1.9 2.2 3.5 2.2H17M14.5 9l2.5 2.4-2.5 2.4M3 13.6h3.2c1.2 0 2-.4 2.7-1.2M14.5 3.6 17 6l-2.5 2.4M11.3 7c.6-.6 1.3-1 2.5-1H17"/></svg>',
  note: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4.5h12v8.5H9l-3.5 3v-3H4z"/><path d="M7 8h6M7 10.5h4"/></svg>',
  pencil: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16l1-4 8.5-8.5a2.1 2.1 0 013 3L8 15l-4 1z"/><path d="M12 5l3 3"/></svg>',
  plus: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>',
  check: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="m6.5 10 2.5 2.5 4.5-5"/></svg>',
  out: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4H4.5v12H8M12 6.5 15.5 10 12 13.5M15.5 10H8"/></svg>',
  left: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg>',
  right: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5"/></svg>',
  back: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10H4.5M9 5 4 10l5 5"/></svg>',
  arrow: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11.5M11 5l5 5-5 5"/></svg>',
};

// Glossy, oil-paint sphere for an AI category. Each AI's sphere is drawn once as a
// self-contained SVG and reused as an <img>, so dozens of cards stay cheap to render.
const orbCache = new Map();
function orbSrc(a) {
  if (orbCache.has(a.key)) return orbCache.get(a.key);
  const dabs = a.paint.dabs.map(([c, x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="80" height="80">
    <defs>
      <clipPath id="c"><circle cx="20" cy="20" r="19"/></clipPath>
      <filter id="p" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="soft"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.05 0.14" numOctaves="3" seed="7" result="noise"/>
        <feDisplacementMap in="soft" in2="noise" scale="10" xChannelSelector="R" yChannelSelector="G" result="smear"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" result="grain"/>
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .18 0" result="ga"/>
        <feComposite in="ga" in2="smear" operator="in" result="gi"/>
        <feBlend in="smear" in2="gi" mode="multiply"/>
      </filter>
      <radialGradient id="s" cx="38%" cy="34%" r="70%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".38"/></radialGradient>
      <radialGradient id="g" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="#fff" stop-opacity=".85"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>
    <g clip-path="url(#c)">
      <g filter="url(#p)"><rect x="-4" y="-4" width="48" height="48" fill="${a.paint.base}"/>${dabs}</g>
      <circle cx="20" cy="20" r="19" fill="url(#s)"/>
      <ellipse cx="14" cy="11.5" rx="8.5" ry="5.5" fill="url(#g)" transform="rotate(-28 14 11.5)"/>
      <circle cx="12" cy="10" r="1.7" fill="#fff" opacity=".9"/>
    </g>
    <circle cx="20" cy="20" r="18.6" fill="none" stroke="rgba(38,39,31,.18)" stroke-width=".8"/>
  </svg>`;
  const src = 'data:image/svg+xml,' + encodeURIComponent(svg.replace(/\s{2,}/g, ' '));
  orbCache.set(a.key, src);
  return src;
}
const aiOrb = (a, cls = '') => `<img class="ai-orb${cls ? ' ' + cls : ''}" src="${orbSrc(a)}" alt="" aria-hidden="true">`;
const aiTile = a => aiOrb(a);

function renderNav() {
  const c = counts();
  const total = shown().length;
  const here = (name, ai) => route.name === name && (ai === undefined || (route.ai?.key || null) === ai);
  const inWorkCtx = route.name === 'work';
  const item = (href, icon, label, count, active, mono = false) => `
    <a class="nav-item${active ? ' is-active' : ''}" href="${href}" ${active ? 'aria-current="page"' : ''} title="${esc(label)}">
      <span class="nav-ico${mono ? ' is-ai' : ''}">${icon}</span><span class="nav-label">${esc(label)}</span>${count === null ? '' : `<span class="nav-count">${String(count).padStart(2, '0')}</span>`}
    </a>`;
  const ais = AIS.filter(a => a.menu || c.get(a.key));
  $('nav').innerHTML = `
    ${item('/', ICON.home, 'ホーム', null, here('home'))}
    <p class="nav-heading">The Collection</p>
    ${item('/collection', ICON.grid, 'すべての作品', total, here('collection', null) || (inWorkCtx && !route.ctx))}
    ${ais.map(a => item(`/collection/${a.slug}`, aiTile(a), a.label, c.get(a.key) || 0, here('collection', a.key) || (inWorkCtx && route.ctx?.key === a.key), true)).join('')}
    <p class="nav-heading">Museum</p>
    ${item('/draw', ICON.pencil, 'らくがき帳', null, here('draw'))}
    ${item('/notes', ICON.note, 'ひとこと帳', null, here('notes'))}
    ${item('/about', ICON.about, 'この美術館について', null, here('about'))}`;

  const tools = $('adminTools');
  tools.hidden = !state.admin;
  tools.innerHTML = state.admin ? `
    <p class="nav-heading">Admin</p>
    <button class="nav-item as-btn" type="button" data-act="upload" title="作品を投稿"><span class="nav-ico">${ICON.plus}</span><span class="nav-label">作品を投稿</span></button>
    <button class="nav-item as-btn" type="button" data-act="select" title="選択して削除" ${state.sample || !state.works.length ? 'disabled' : ''}><span class="nav-ico">${ICON.check}</span><span class="nav-label">選択して削除</span></button>
    <button class="nav-item as-btn" type="button" data-act="logout" title="ログアウト"><span class="nav-ico">${ICON.out}</span><span class="nav-label">ログアウト</span></button>` : '';
}
$('adminTools').addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act || state.busy) return;
  if (act === 'upload') openUpload();
  if (act === 'select') { state.selecting = true; state.selected.clear(); if (route.name !== 'collection') go('/collection'); else render(); }
  if (act === 'logout') logout();
});

const shell = $('shell');
const setRail = on => {
  shell.dataset.rail = on ? 'true' : 'false';
  $('railToggle').setAttribute('aria-pressed', String(on));
  $('railToggle').setAttribute('aria-label', on ? 'メニューを広げる' : 'メニューをたたむ');
  store.set('cm-rail', on ? '1' : '0');
};
setRail(store.get('cm-rail', '0') === '1');
$('railToggle').onclick = () => setRail(shell.dataset.rail !== 'true');

function openDrawer() {
  shell.dataset.drawer = 'open'; $('scrim').hidden = false;
  $('drawerOpen').setAttribute('aria-expanded', 'true');
  $('side').querySelector('.nav-item')?.focus();
}
function closeDrawer() {
  if (shell.dataset.drawer !== 'open') return;
  shell.dataset.drawer = ''; $('scrim').hidden = true;
  $('drawerOpen').setAttribute('aria-expanded', 'false');
}
$('drawerOpen').onclick = openDrawer;
$('drawerClose').onclick = () => { closeDrawer(); $('drawerOpen').focus(); };
$('scrim').onclick = closeDrawer;

// ─── views ──────────────────────────────────────────────────────────────
const crumbs = (...parts) => `
  <div class="crumbs">
    <p class="mono">${parts.map(esc).join('<span class="sep">/</span>')}</p>
    <p class="mono crumbs-site">${esc(SITE.name.toUpperCase())}<span class="dot" aria-hidden="true"></span></p>
  </div>`;
const footer = () => `<footer class="foot"><p class="mono">${esc(SITE.footer)}</p><p class="mono">${esc(SITE.name.toUpperCase())} © ${new Date().getFullYear()}</p></footer>`;

function sampleNote() {
  if (!state.sample) return '';
  return `<div class="sample-note"><span class="mono">SAMPLE</span><p>${demo ? 'デモ表示中です。見本の画像を並べています。' : 'まだ作品がありません。いま表示しているのは見本の画像です。'}</p>${state.admin ? `<button class="btn small" type="button" data-act-main="upload">最初の作品を投稿</button>` : ''}</div>`;
}

function card(w, ctx) {
  const href = `/work/${encodeURIComponent(w.id)}${ctx ? `?in=${ctx.slug}` : ''}`;
  const sel = state.selecting;
  const picked = state.selected.has(String(w.id));
  const inner = `
    <span class="mat"><img src="${thumb(w)}" data-full="${full(w)}" alt="${esc(w.alt || titleOf(w))}" loading="lazy" decoding="async"></span>
    <span class="card-meta"><span class="mono num">${noOf(w)}</span><span class="card-title">${esc(titleOf(w))}</span><span class="mono card-ai">${esc(aiLabel(w.ai))}</span></span>`;
  return sel
    ? `<li class="card${picked ? ' is-picked' : ''}"><button type="button" class="card-link" data-pick="${esc(w.id)}" aria-pressed="${picked}">${inner}<span class="pick" aria-hidden="true">${ICON.check}</span></button></li>`
    : `<li class="card"><a class="card-link" href="${href}">${inner}<span class="card-go mono" aria-hidden="true">VIEW ${ICON.arrow}</span></a></li>`;
}

// A loose pencil sketch of gallery arches, drawn behind page heads.
const SKETCH = cls => `<svg class="sketch ${cls}" viewBox="0 0 760 420" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true">
  <defs><filter id="pencil-${cls}"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="5"/></filter></defs>
  <g filter="url(#pencil-${cls})" stroke-width="1.3">
    <path d="M60 400V190c0-70 50-120 110-120s110 50 110 120v210"/><path d="M66 400V194c0-66 46-114 104-114s104 48 104 114v206" opacity=".55"/>
    <path d="M300 400V150c0-86 62-146 140-146s140 60 140 146v250"/><path d="M307 400V155c0-80 58-138 133-138s133 58 133 138v245" opacity=".55"/>
    <path d="M600 400V210c0-58 40-98 90-98"/><path d="M20 402h730" /><path d="M40 410h650" opacity=".5"/>
    <rect x="355" y="170" width="170" height="130" rx="2"/><rect x="368" y="183" width="144" height="104" opacity=".6"/>
    <rect x="115" y="215" width="110" height="82"/><path d="M640 250h70v60h-70z" opacity=".7"/>
    <path d="M378 330c20 6 104 6 124 0M120 318c20 5 80 5 100 0" opacity=".45"/>
    <path d="M325 60l-18 30M338 52l-22 38M556 60l18 30M543 52l22 38" opacity=".35"/>
  </g>
</svg>`;

// The home page shows one work picked at random. The pick stays put while you are on the
// page (re-renders keep it) and is drawn again each time you come back to the home page.
let heroPickId = null;
function pickHero(list, avoidId = null) {
  if (!list.length) return null;
  const pool = list.length > 1 ? list.filter(w => String(w.id) !== String(avoidId)) : list;
  return pool[Math.floor(Math.random() * pool.length)];
}

function viewHome() {
  const list = shown();
  let pick = list.find(w => String(w.id) === String(heroPickId));
  if (!pick) { pick = pickHero(list); heroPickId = pick?.id ?? null; }
  const recent = list.slice(0, 4);
  return `
    ${crumbs('PUBLIC ARCHIVE', 'WELCOME')}
    <section class="hero">
      ${SKETCH('hero-sketch')}
      <div class="hero-copy">
        <p class="mono eyebrow"><span class="dot" aria-hidden="true"></span>A PUBLIC MUSEUM OF AI &amp; CURIOSITY</p>
        <h1 class="display">Chimpanzee<br><em>Museum.</em></h1>
        <p class="lede">理由はいらない。<br>ただ、好きなものを。</p>
        <div class="hero-actions">
          <a class="link-arrow" href="/collection">コレクションを見る ${ICON.arrow}</a>
          <p class="mono hero-count">${list.length} WORKS / PUBLIC ARCHIVE</p>
        </div>
      </div>
      ${pick ? `
      <div class="hero-piece">
        <a class="hero-link" href="/work/${encodeURIComponent(pick.id)}" aria-label="${esc(titleOf(pick))} を見る">
          <span class="mat tall"><img src="${full(pick)}" alt="${esc(pick.alt || titleOf(pick))}" fetchpriority="high" decoding="async"></span>
        </a>
        <div class="piece-cap">
          <a class="piece-meta" href="/work/${encodeURIComponent(pick.id)}"><span class="mono">PICKED AT RANDOM · WORK ${noOf(pick)}</span><span class="piece-title">${esc(titleOf(pick))}</span></a>
          ${list.length > 1 ? `<button class="shuffle" type="button" data-act-main="shuffle" title="ほかの作品を選ぶ">${ICON.shuffle}<span>ほかの作品</span></button>` : ''}
        </div>
      </div>` : `<div class="hero-piece empty"><span class="mat tall"><span class="mono">NO WORKS YET</span></span></div>`}
    </section>
    ${sampleNote()}
    ${recent.length ? `
    <section class="recent" aria-labelledby="recentTitle">
      <div class="section-head"><h2 class="h2" id="recentTitle">Recently added<span class="dot" aria-hidden="true"></span></h2><a class="link-arrow small" href="/collection">すべて見る ${ICON.arrow}</a></div>
      <ul class="grid compact">${recent.map(w => card(w)).join('')}</ul>
    </section>` : ''}
    ${footer()}`;
}

function viewCollection() {
  const ai = route.ai;
  const list = ai ? shown().filter(w => aiByKey(w.ai).key === ai.key) : shown();
  const sel = state.selecting && state.admin && !state.sample;
  if (!sel) state.selecting = false;
  return `
    ${crumbs('PUBLIC ARCHIVE', 'COLLECTION', ...(ai ? [ai.label.toUpperCase()] : []))}
    <section class="page-head">
      ${SKETCH('head-sketch')}
      <p class="mono eyebrow">${ai ? 'CREATED WITH' : 'ART, WITHOUT A REASON.'}</p>
      <h1 class="display md">${ai ? esc(ai.label) : 'The Collection'}<span class="accent">.</span></h1>
      <p class="lede">${ai ? `${esc(ai.label)} と生まれた作品。` : 'AIと生まれた、少し不思議なコレクション。'}</p>
    </section>
    ${sampleNote()}
    <div class="toolbar">
      ${sel ? `
        <p class="sel-count"><span class="dot" aria-hidden="true"></span><span id="selCount">${state.selected.size}</span> 件を選択中</p>
        <div class="tool-btns">
          <button class="btn ghost small" type="button" data-sel="all">すべて選択</button>
          <button class="btn ghost small" type="button" data-sel="cancel">キャンセル</button>
          <label class="sel-ai"><span class="sr">変更先の制作AI</span><select id="selAi">${aiOptions(DEFAULT_AI)}</select></label>
          <button class="btn small" type="button" data-sel="setai" ${state.selected.size ? '' : 'disabled'}>制作AIを変更</button>
          <button class="btn danger small" type="button" data-sel="delete" ${state.selected.size ? '' : 'disabled'}>削除する</button>
        </div>` : `
        <p class="count">${ai ? aiOrb(ai, 'md') : '<span class="dot" aria-hidden="true"></span>'}${ai ? esc(ai.label) : 'すべての作品'} <span class="mono">/ ${list.length} WORKS</span></p>
        <div class="seg" role="group" aria-label="表示サイズ">
          <button type="button" data-size="large" aria-pressed="${state.size === 'large'}" title="大きく表示"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="6" height="14" rx="1"/><rect x="11" y="3" width="6" height="14" rx="1"/></svg><span class="sr">大きく表示</span></button>
          <button type="button" data-size="compact" aria-pressed="${state.size === 'compact'}" title="小さく表示"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/></svg><span class="sr">小さく表示</span></button>
        </div>`}
    </div>
    ${list.length
      ? `<ul class="grid ${state.size}">${list.map(w => card(w, ai)).join('')}</ul>`
      : `<div class="empty"><p class="mono">NO EXHIBITS YET</p><p>この棚にはまだ作品がありません。</p><a class="link-arrow small" href="/collection">すべての作品へ ${ICON.arrow}</a></div>`}
    ${footer()}`;
}

function workContext() {
  const ctx = route.ctx;
  const list = ctx ? shown().filter(w => aiByKey(w.ai).key === ctx.key) : shown();
  const i = list.findIndex(w => String(w.id) === String(route.id));
  return { ctx, list, i };
}
const workHref = (w, ctx) => `/work/${encodeURIComponent(w.id)}${ctx ? `?in=${ctx.slug}` : ''}`;

function viewWork() {
  const { ctx, list, i } = workContext();
  const w = list[i];
  if (!w) return viewNotFound('この作品は見つかりませんでした。削除されたか、URLが違うかもしれません。');
  const prev = list[i - 1], next = list[i + 1];
  const back = ctx ? `/collection/${ctx.slug}` : '/collection';
  const date = w.sample ? '' : fmtDate(w.created_at);
  return `
    ${crumbs('PUBLIC ARCHIVE', 'VIEWING ROOM')}
    <div class="room-bar">
      <a class="link-back" href="${back}">${ICON.back}<span>${ctx ? esc(ctx.label) : 'コレクション'}に戻る</span></a>
      <p class="mono room-pos">${ctx ? esc(ctx.label.toUpperCase()) : 'COLLECTION'} · ${i + 1} / ${list.length}</p>
      <div class="room-arrows">
        ${prev ? `<a class="icon-btn boxed" href="${workHref(prev, ctx)}" aria-label="前の作品" data-keep-scroll>${ICON.left}</a>` : `<span class="icon-btn boxed is-off" aria-hidden="true">${ICON.left}</span>`}
        ${next ? `<a class="icon-btn boxed" href="${workHref(next, ctx)}" aria-label="次の作品" data-keep-scroll>${ICON.right}</a>` : `<span class="icon-btn boxed is-off" aria-hidden="true">${ICON.right}</span>`}
      </div>
    </div>
    <figure class="stage" id="stage">
      <img src="${full(w)}" alt="${esc(w.alt || titleOf(w))}" decoding="async" fetchpriority="high">
    </figure>
    <section class="plate">
      <div>
        <p class="mono label">WORK ${noOf(w)}</p>
        <h1 class="plate-title">${esc(titleOf(w))}</h1>
        ${w.alt ? `<p class="plate-text">${esc(w.alt)}</p>` : ''}
      </div>
      <dl class="plate-meta">
        <div><dt class="mono label">CREATED WITH</dt><dd>${esc(aiLabel(w.ai))}</dd></div>
        ${date ? `<div><dt class="mono label">ADDED</dt><dd class="mono">${date}</dd></div>` : ''}
        ${state.admin && !w.sample ? `<div><dt class="mono label">ADMIN</dt><dd><button class="btn ghost small" type="button" data-act-main="edit">編集・削除</button></dd></div>` : ''}
      </dl>
    </section>
    <nav class="strip" aria-label="作品一覧">
      <ol>${list.map((x, k) => `<li><a href="${workHref(x, ctx)}" data-keep-scroll ${k === i ? 'aria-current="true"' : ''} aria-label="${esc(titleOf(x))}"><img src="${thumb(x)}" data-full="${full(x)}" alt="" loading="lazy" decoding="async"></a></li>`).join('')}</ol>
    </nav>
    <p class="mono keys"><kbd>←</kbd><kbd>→</kbd> 作品を移動　<kbd>ESC</kbd> 一覧に戻る</p>
    ${footer()}`;
}

function viewAbout() {
  const c = counts();
  return `
    ${crumbs('PUBLIC ARCHIVE', 'ABOUT')}
    <section class="page-head">
      ${SKETCH('head-sketch')}
      <p class="mono eyebrow">ABOUT THIS MUSEUM</p>
      <h1 class="display md">No reason<span class="accent">.</span></h1>
    </section>
    <section class="prose">
      <p>ここは、AIと一緒に生まれた画像を、自分の好きな順番で置いておくための小さな美術館です。</p>
      <p>名前にチンパンジーとついているのに、チンパンジーはほとんど出てきません。バナナに理由がいらないのと同じで、名前にも理由はいりません。</p>
      <p>作品は、それぞれの制作AIの棚に分けて並べています。気になったものを開いて、左右の矢印キーで順番に眺めてください。</p>
    </section>
    <dl class="stats">
      <div><dt class="mono label">WORKS</dt><dd class="display sm">${shown().length}</dd></div>
      <div><dt class="mono label">SHELVES</dt><dd class="display sm">${[...c.keys()].length}</dd></div>
      <div><dt class="mono label">ADMISSION</dt><dd class="display sm">Free</dd></div>
    </dl>
    ${footer()}`;
}

function viewNotes() {
  return `
    ${crumbs('PUBLIC ARCHIVE', 'NOTES')}
    <section class="page-head compact-head">
      <p class="mono eyebrow">ONE LINE AT A TIME.</p>
      <h1 class="display md">Notes<span class="accent">.</span></h1>
      <p class="lede">ひとことだけ、書き残しておく場所。${state.admin ? '' : '<br>書き込みは管理者だけです。'}</p>
    </section>
    ${notesView({ admin: state.admin })}
    ${footer()}`;
}

function viewDraw() {
  return `
    ${crumbs('PUBLIC ARCHIVE', 'SKETCHBOOK')}
    <section class="page-head compact-head">
      <p class="mono eyebrow">DRAW SOMETHING, FOR NO REASON.</p>
      <h1 class="display md">Sketchbook<span class="accent">.</span></h1>
      <p class="lede">ブラウザの上で、そのまま描けるらくがき帳。${state.admin ? '描いたものは、そのまま作品として公開できます。' : ''}</p>
    </section>
    ${drawView({ admin: state.admin })}
    ${footer()}`;
}

function viewNotFound(msg = 'お探しのページは見つかりませんでした。') {
  return `
    ${crumbs('PUBLIC ARCHIVE', 'LOST')}
    <section class="page-head">
      <p class="mono eyebrow">404 — NOT ON DISPLAY</p>
      <h1 class="display md">Lost in the<br><em>archive.</em></h1>
      <p class="lede">${esc(msg)}</p>
      <p><a class="link-arrow" href="/collection">コレクションへ ${ICON.arrow}</a></p>
    </section>
    ${footer()}`;
}

function viewLoading() {
  return `${crumbs('PUBLIC ARCHIVE', 'LOADING')}<div class="loading" aria-busy="true"><span class="dot pulse" aria-hidden="true"></span><p class="mono">OPENING THE ARCHIVE…</p></div>`;
}
function viewError() {
  return `
    ${crumbs('PUBLIC ARCHIVE', 'UNAVAILABLE')}
    <section class="page-head">
      <p class="mono eyebrow">ARCHIVE UNAVAILABLE</p>
      <h1 class="display md">Closed<br><em>for a moment.</em></h1>
      <p class="lede">作品一覧を読み込めませんでした。通信状況を確認して、もう一度お試しください。</p>
      <p><button class="btn" type="button" data-act-main="retry">再読み込み</button></p>
    </section>`;
}

const TITLES = { home: 'Home', collection: 'Collection', about: 'About', draw: 'Sketchbook', notes: 'Notes', notfound: 'Not found', admin: 'Admin' };

let drawHandle = null;
function render() {
  drawHandle?.destroy(); drawHandle = null;
  renderNav();
  let html;
  if (state.status === 'loading') html = viewLoading();
  else if (state.status === 'error' && !state.sample) html = viewError();
  else if (route.name === 'home' || route.name === 'admin') html = viewHome();
  else if (route.name === 'collection') html = viewCollection();
  else if (route.name === 'work') html = viewWork();
  else if (route.name === 'about') html = viewAbout();
  else if (route.name === 'draw') html = viewDraw();
  else if (route.name === 'notes') html = viewNotes();
  else html = viewNotFound();
  main.innerHTML = html;
  main.dataset.view = route.name;

  let t = TITLES[route.name] || '';
  if (route.name === 'collection' && route.ai) t = route.ai.label;
  if (route.name === 'work') { const w = byId(route.id); t = w ? titleOf(w) : 'Not found'; if (w) preloadNeighbours(); }
  document.title = `${t} — ${SITE.name}`;

  if (route.name === 'work') {
    const cur = main.querySelector('.strip [aria-current]'); const ol = main.querySelector('.strip ol');
    if (cur && ol) ol.scrollLeft = cur.parentElement.offsetLeft - ol.clientWidth / 2 + cur.offsetWidth / 2;
  }
  if (route.name === 'notes' && state.status !== 'loading') {
    drawHandle = mountNotes(main.querySelector('#notesApp'), { admin: state.admin, demo, onToast: toast });
  }
  if (route.name === 'draw' && state.status !== 'loading') {
    drawHandle = mountDraw(main.querySelector('#sketchApp'), {
      onToast: toast,
      onPublish: (file, title) => { openUpload(); $('bulkAi').value = 'Other'; addFiles([file], { title }); pendingSketch = true; },
    });
  }
  if (route.name === 'admin' && state.status !== 'loading') handleAdminRoute();
}

function preloadNeighbours() {
  const { list, i } = workContext();
  for (const w of [list[i - 1], list[i + 1]]) if (w) { const im = new Image(); im.decoding = 'async'; im.src = w.sample ? w.file : api.fullUrl(w); }
}

// ─── main-area interactions ─────────────────────────────────────────────
main.addEventListener('click', e => {
  const size = e.target.closest('[data-size]')?.dataset.size;
  if (size) { state.size = size; store.set('cm-size', size); render(); return; }
  const act = e.target.closest('[data-act-main]')?.dataset.actMain;
  if (act === 'retry') { load(); return; }
  if (act === 'shuffle') { heroPickId = pickHero(shown(), heroPickId)?.id ?? null; render(); return; }
  if (act === 'upload') { openUpload(); return; }
  if (act === 'edit') { const w = byId(route.id); if (w) openEdit(w); return; }
  const pick = e.target.closest('[data-pick]')?.dataset.pick;
  if (pick) {
    state.selected.has(pick) ? state.selected.delete(pick) : state.selected.add(pick);
    const li = e.target.closest('.card');
    li.classList.toggle('is-picked', state.selected.has(pick));
    li.querySelector('[data-pick]').setAttribute('aria-pressed', String(state.selected.has(pick)));
    $('selCount').textContent = state.selected.size;
    main.querySelectorAll('[data-sel="delete"], [data-sel="setai"]').forEach(b => { b.disabled = !state.selected.size; });
    return;
  }
  const sel = e.target.closest('[data-sel]')?.dataset.sel;
  if (sel === 'cancel') { state.selecting = false; state.selected.clear(); render(); }
  if (sel === 'all') {
    const list = route.ai ? state.works.filter(w => aiByKey(w.ai).key === route.ai.key) : state.works;
    list.forEach(w => state.selected.add(String(w.id))); render();
  }
  if (sel === 'delete') bulkDelete();
  if (sel === 'setai') bulkSetAi($('selAi').value);
});

document.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  if (e.key === 'Escape' && shell.dataset.drawer === 'open') { closeDrawer(); $('drawerOpen').focus(); return; }
  if (route.name !== 'work' || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const { ctx, list, i } = workContext();
  if (e.key === 'ArrowLeft' && list[i - 1]) { e.preventDefault(); go(workHref(list[i - 1], ctx), { keepScroll: true }); }
  if (e.key === 'ArrowRight' && list[i + 1]) { e.preventDefault(); go(workHref(list[i + 1], ctx), { keepScroll: true }); }
  if (e.key === 'Escape') { e.preventDefault(); go(ctx ? `/collection/${ctx.slug}` : '/collection'); }
});

let touch = null;
main.addEventListener('touchstart', e => { if (route.name === 'work' && e.target.closest('#stage')) touch = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
main.addEventListener('touchend', e => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch[0], dy = e.changedTouches[0].clientY - touch[1];
  touch = null;
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  const { ctx, list, i } = workContext();
  const t = dx < 0 ? list[i + 1] : list[i - 1];
  if (t) go(workHref(t, ctx), { keepScroll: true });
});

// ─── toast ──────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, error = false) {
  const t = $('toast');
  t.textContent = msg; t.dataset.error = String(error); t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, error ? 7000 : 3500);
}

// ─── data ───────────────────────────────────────────────────────────────
async function load() {
  state.status = 'loading'; render();
  if (demo) { state.works = []; state.sample = true; state.status = 'ready'; renumber(); render(); return; }
  try {
    state.works = await api.loadWorks();
    state.sample = state.works.length === 0;
    state.status = 'ready';
  } catch (err) {
    console.error(err);
    state.status = 'error'; state.sample = false;
  }
  renumber();
  render();
}
async function refresh() {
  try { state.works = await api.loadWorks(); state.sample = state.works.length === 0; renumber(); } catch (err) { console.error(err); }
  render();
}

// ─── auth ───────────────────────────────────────────────────────────────
let authGen = 0;
async function updateAuth(session) {
  const gen = ++authGen;
  let allowed = false;
  try { allowed = api.client && !demo ? await api.isAdmin(session) : false; }
  catch { if (session) toast('管理権限を確認できませんでした。再度ログインしてください。', true); }
  if (gen !== authGen) return allowed;
  const changed = state.admin !== allowed;
  state.admin = allowed;
  if (!allowed) state.selecting = false;
  if (changed && state.status !== 'loading') render();
  return allowed;
}

function handleAdminRoute() {
  if (state.admin) { go('/collection', { replace: true }); toast('管理モードです。'); return; }
  if (demo || !api.client) { toast('デモ表示中は管理機能を使えません。', true); go('/', { replace: true }); return; }
  if (!$('loginDialog').open) { $('loginMsg').textContent = ''; $('loginDialog').showModal(); }
}
$('loginDialog').addEventListener('close', () => { if (route.name === 'admin' && !state.admin) go('/', { replace: true }); });
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('loginSubmit'); btn.disabled = true; $('loginMsg').textContent = '確認しています…'; $('loginMsg').dataset.error = 'false';
  try {
    const session = await api.signIn($('loginEmail').value.trim(), $('loginPassword').value);
    $('loginPassword').value = '';
    if (!(await updateAuth(session))) throw new Error('このアカウントには管理権限がありません。');
    $('loginDialog').close();
    go('/collection', { replace: true });
    toast('ログインしました。管理モードです。');
  } catch (err) { $('loginMsg').textContent = err.message; $('loginMsg').dataset.error = 'true'; }
  finally { btn.disabled = false; }
});
async function logout() {
  try { await api.signOut(); await updateAuth(null); render(); toast('ログアウトしました。'); }
  catch (err) { toast(err.message, true); }
}

// ─── dialogs: shared ────────────────────────────────────────────────────
document.querySelectorAll('dialog').forEach(d => {
  d.addEventListener('click', e => { if (e.target.closest('[data-close]') && !state.busy) d.close(); });
  d.addEventListener('cancel', e => { if (state.busy) e.preventDefault(); });
});
const aiOptions = sel => AIS.filter(a => a.menu || a.key === 'Other' || a.key === 'Unknown' || a.key === sel)
  .map(a => `<option value="${a.key}"${a.key === sel ? ' selected' : ''}>${esc(a.label)}</option>`).join('');

// ─── upload (multi) ─────────────────────────────────────────────────────
let queue = []; // {key, file, url, title, ai, alt, status, error}
let pendingSketch = false;
let qKey = 0;
function openUpload() {
  if (!state.admin) return;
  pendingSketch = false;
  queue.forEach(q => URL.revokeObjectURL(q.url)); queue = [];
  $('bulkAi').innerHTML = aiOptions(route.ai?.key || DEFAULT_AI);
  $('uploadMsg').textContent = '';
  drawQueue();
  $('uploadDialog').showModal();
}
function addFiles(files, overrides = {}) {
  const bad = [];
  for (const f of files) {
    try { checkFile(f); } catch (err) { bad.push(`${f.name}: ${err.message}`); continue; }
    queue.push({ key: ++qKey, file: f, url: URL.createObjectURL(f), title: overrides.title || titleFromFilename(f.name), ai: $('bulkAi').value, alt: '', status: '', error: false });
  }
  $('uploadMsg').textContent = bad.join(' / '); $('uploadMsg').dataset.error = String(bad.length > 0);
  drawQueue();
}
function drawQueue() {
  $('bulkRow').hidden = queue.length < 1;
  $('bulkCount').textContent = `${queue.length} 件`;
  $('uploadSubmit').disabled = !queue.length || state.busy;
  $('uploadSubmit').textContent = queue.length > 1 ? `${queue.length} 件を公開する` : '公開する';
  $('queue').innerHTML = queue.map(q => `
    <li class="q-item${q.error ? ' is-error' : ''}" data-key="${q.key}">
      <img src="${q.url}" alt="">
      <div class="q-fields">
        <label class="field compact"><span class="sr">作品名</span><input data-f="title" value="${esc(q.title)}" maxlength="120" required placeholder="作品名"></label>
        <div class="q-row">
          <label class="field compact"><span class="sr">制作AI</span><select data-f="ai">${aiOptions(q.ai)}</select></label>
          <label class="field compact grow"><span class="sr">説明</span><input data-f="alt" value="${esc(q.alt)}" maxlength="500" placeholder="説明（任意）"></label>
        </div>
        ${q.status ? `<p class="q-status mono" role="status">${esc(q.status)}</p>` : ''}
      </div>
      <button class="icon-btn" type="button" data-remove aria-label="${esc(q.title)} を取り除く"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg></button>
    </li>`).join('');
}
$('uploadInput').addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });
const drop = $('drop');
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('is-over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('is-over'); }));
drop.addEventListener('drop', e => addFiles([...e.dataTransfer.files]));
$('bulkAi').addEventListener('change', e => { queue.forEach(q => { q.ai = e.target.value; }); drawQueue(); });
$('queue').addEventListener('input', e => {
  const li = e.target.closest('[data-key]'); const f = e.target.dataset.f;
  const q = queue.find(x => x.key === Number(li?.dataset.key));
  if (q && f) q[f] = e.target.value;
});
$('queue').addEventListener('click', e => {
  if (!e.target.closest('[data-remove]') || state.busy) return;
  const key = Number(e.target.closest('[data-key]').dataset.key);
  const q = queue.find(x => x.key === key); if (q) URL.revokeObjectURL(q.url);
  queue = queue.filter(x => x.key !== key); drawQueue();
});
function setBusy(on, dialog) {
  state.busy = on;
  dialog?.querySelectorAll('input, select, textarea, button').forEach(el => { el.disabled = on; });
  if (!on && dialog === $('uploadDialog')) drawQueue();
}
$('uploadForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!state.admin || state.busy || !queue.length) return;
  if (queue.some(q => !q.title.trim())) { $('uploadMsg').textContent = '作品名が空のものがあります。'; $('uploadMsg').dataset.error = 'true'; return; }
  const dlg = $('uploadDialog');
  setBusy(true, dlg);
  const base = Math.min(0, ...state.works.map(w => Number(w.sort_order)).filter(Number.isFinite));
  const total = queue.length;
  let ok = 0;
  for (let i = 0; i < queue.length; i++) {
    const q = queue[i];
    const step = s => { q.status = `${i + 1}/${total} ${s}…`; drawQueueStatus(q); };
    try {
      await api.saveWork(null, { title: q.title.trim(), ai: q.ai, alt: q.alt.trim(), sort_order: base - total + i }, q.file, step);
      q.done = true; ok++;
    } catch (err) { q.error = true; q.status = `失敗: ${err.message || '保存できませんでした'}`; drawQueueStatus(q); }
  }
  queue.filter(q => q.done).forEach(q => URL.revokeObjectURL(q.url));
  queue = queue.filter(q => !q.done);
  setBusy(false, dlg);
  await refresh();
  if (!queue.length) {
    dlg.close(); toast(`${ok} 件を公開しました。`);
    if (pendingSketch) { drawHandle?.clearDraftAfterPublish(); pendingSketch = false; }
    if (route.name !== 'collection') go('/collection');
  }
  else { drawQueue(); $('uploadMsg').textContent = `${ok} 件を公開しました。残りの ${queue.length} 件は失敗しました。内容を確認してもう一度お試しください。`; $('uploadMsg').dataset.error = 'true'; }
});
function drawQueueStatus(q) {
  const li = $('queue').querySelector(`[data-key="${q.key}"]`); if (!li) return;
  li.classList.toggle('is-error', q.error);
  let p = li.querySelector('.q-status');
  if (!p) { p = document.createElement('p'); p.className = 'q-status mono'; p.setAttribute('role', 'status'); li.querySelector('.q-fields').append(p); }
  p.textContent = q.status;
}

// ─── edit / delete ──────────────────────────────────────────────────────
let editing = null;
function openEdit(w) {
  if (!state.admin || w.sample) return;
  editing = w;
  $('editForm').reset();
  $('editEyebrow').textContent = `EDIT · WORK ${noOf(w)}`;
  $('editPreview').dataset.full = api.fullUrl(w);
  $('editPreview').src = api.thumbUrl(w);
  $('editName').value = w.title || '';
  $('editAi').innerHTML = aiOptions(aiByKey(w.ai).key);
  $('editAlt').value = w.alt || '';
  $('editMsg').textContent = '';
  $('editDialog').showModal();
}
$('editFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  try { checkFile(f); $('editPreview').src = URL.createObjectURL(f); $('editMsg').textContent = ''; }
  catch (err) { e.target.value = ''; $('editMsg').textContent = err.message; $('editMsg').dataset.error = 'true'; }
});
$('editForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!editing || state.busy) return;
  const values = { title: $('editName').value.trim(), ai: $('editAi').value, alt: $('editAlt').value.trim() };
  if (!values.title) return;
  const dlg = $('editDialog');
  setBusy(true, dlg);
  try {
    const { cleanupError } = await api.saveWork(editing, values, $('editFile').files[0] || null, s => { $('editMsg').textContent = `${s}…`; $('editMsg').dataset.error = 'false'; });
    setBusy(false, dlg); dlg.close();
    await refresh();
    toast(cleanupError ? '保存しました（古い画像の削除には失敗しました）。' : '保存しました。', Boolean(cleanupError));
  } catch (err) { setBusy(false, dlg); $('editMsg').textContent = err.message || '保存に失敗しました。'; $('editMsg').dataset.error = 'true'; }
});
$('editDelete').addEventListener('click', async () => {
  if (!editing || state.busy) return;
  if (!confirm(`「${titleOf(editing)}」を削除しますか？ 元に戻せません。`)) return;
  const dlg = $('editDialog');
  setBusy(true, dlg);
  try {
    const { ctx, list, i } = workContext();
    const nextW = list[i + 1] || list[i - 1];
    const cleanupError = await api.deleteWork(editing);
    setBusy(false, dlg); dlg.close();
    await refresh();
    toast(cleanupError ? '削除しました（画像ファイルの削除には失敗しました）。' : '削除しました。', Boolean(cleanupError));
    go(nextW && byId(nextW.id) ? workHref(nextW, ctx) : '/collection', { replace: true });
  } catch (err) { setBusy(false, dlg); $('editMsg').textContent = err.message || '削除に失敗しました。'; $('editMsg').dataset.error = 'true'; }
});

async function bulkDelete() {
  const targets = state.works.filter(w => state.selected.has(String(w.id)));
  if (!targets.length || state.busy) return;
  if (!confirm(`${targets.length} 件の作品を削除しますか？ 元に戻せません。`)) return;
  state.busy = true;
  main.querySelectorAll('[data-sel], [data-pick]').forEach(b => { b.disabled = true; });
  let ok = 0, fail = 0;
  for (const w of targets) {
    try { await api.deleteWork(w); ok++; state.selected.delete(String(w.id)); }
    catch (err) { console.error(err); fail++; }
    const c = $('selCount'); if (c) c.textContent = `${ok}/${targets.length} 削除済み ·`;
  }
  state.busy = false;
  if (!fail) state.selecting = false;
  await refresh();
  toast(fail ? `${ok} 件を削除、${fail} 件は失敗しました。` : `${ok} 件を削除しました。`, fail > 0);
}

async function bulkSetAi(ai) {
  const targets = state.works.filter(w => state.selected.has(String(w.id)) && w.ai !== ai);
  if (state.busy) return;
  if (!targets.length) { toast(`選んだ作品はすでに ${aiLabel(ai)} です。`); return; }
  if (!confirm(`${targets.length} 件の制作AIを「${aiLabel(ai)}」に変更しますか？`)) return;
  state.busy = true;
  main.querySelectorAll('[data-sel], [data-pick], #selAi').forEach(b => { b.disabled = true; });
  let ok = 0, fail = 0, lastError = '';
  for (const w of targets) {
    try { await api.saveWork(w, { ai }, null); ok++; }
    catch (err) { console.error(err); fail++; lastError = err.message || ''; }
    const c = $('selCount'); if (c) c.textContent = `${ok}/${targets.length} 変更済み ·`;
  }
  state.busy = false;
  if (!fail) { state.selecting = false; state.selected.clear(); }
  await refresh();
  toast(fail ? `${ok} 件を変更、${fail} 件は失敗しました。${lastError}` : `${ok} 件を ${aiLabel(ai)} に変更しました。`, fail > 0);
}

// A missing thumbnail (older uploads) falls back to the display image.
document.addEventListener('error', e => {
  const img = e.target;
  if (img?.tagName === 'IMG' && img.dataset.full && img.getAttribute('src') !== img.dataset.full) img.src = img.dataset.full;
}, true);

// Fade the top edge only once the page has scrolled.
const onScroll = () => document.documentElement.classList.toggle('is-scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ─── boot ───────────────────────────────────────────────────────────────
navigate();
load();
if (api.client && !demo) {
  api.client.auth.getSession().then(({ data, error }) => { if (!error && data.session) updateAuth(data.session); });
  // Supabase recommends not awaiting API calls inside this callback.
  api.client.auth.onAuthStateChange((_evt, session) => { setTimeout(() => updateAuth(session), 0); });
}

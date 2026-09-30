// Sketchbook: a small doodle tool drawn on <canvas>.
// Strokes are kept as data (not bitmaps), so undo/redo is cheap and the draft can be saved.
import { store } from './util.js';

const W = 1600, H = 1200;           // fixed drawing surface (4:3), scaled to fit on screen
const PAPER = '#FBF8F0';
const DRAFT_KEY = 'cm-sketch-draft';
export const COLORS = [
  '#2B2622', '#6C6057', '#B9AE9C', '#FFFFFF',
  '#C8453A', '#E0703C', '#E9B949', '#8FAE4A',
  '#1F9A78', '#2F9BE0', '#5B6CF0', '#8E55E8',
];
const TOOLS = {
  pen:    { label: 'ペン', min: .35, max: 1.25, alpha: 1 },
  marker: { label: 'マーカー', min: 1, max: 1, alpha: .35 },
  eraser: { label: '消しゴム', min: 1, max: 1, alpha: 1 },
};

export const drawView = ({ admin }) => `
  <div class="sketch-app" id="sketchApp">
    <div class="sk-bar" role="toolbar" aria-label="描画ツール">
      <div class="sk-group" role="radiogroup" aria-label="道具">
        ${Object.entries(TOOLS).map(([k, t]) => `<button type="button" class="sk-tool" data-tool="${k}" role="radio" aria-checked="${k === 'pen'}" title="${t.label}（${k === 'pen' ? 'B' : k === 'marker' ? 'M' : 'E'}）">${ICONS[k]}<span>${t.label}</span></button>`).join('')}
      </div>
      <div class="sk-group sk-colors" role="radiogroup" aria-label="色">
        ${COLORS.map((c, i) => `<button type="button" class="sk-color" data-color="${c}" role="radio" aria-checked="${i === 0}" aria-label="色 ${c}" style="--c:${c}"></button>`).join('')}
        <label class="sk-color sk-custom" title="好きな色"><input type="color" id="skCustom" value="#3D3530" aria-label="好きな色を選ぶ"></label>
      </div>
      <label class="sk-size" title="太さ（[ と ] でも変更）"><span class="sk-dot" id="skDot"></span><input type="range" id="skSize" min="2" max="80" value="10" aria-label="太さ"><span class="mono" id="skSizeLabel">10</span></label>
      <div class="sk-group">
        <button type="button" class="sk-icon" data-act="undo" title="元に戻す（Ctrl+Z）" aria-label="元に戻す">${ICONS.undo}</button>
        <button type="button" class="sk-icon" data-act="redo" title="やり直す（Ctrl+Shift+Z）" aria-label="やり直す">${ICONS.redo}</button>
        <button type="button" class="sk-icon" data-act="clear" title="全部消す（元に戻せます）" aria-label="全部消す">${ICONS.clear}</button>
      </div>
      <div class="sk-group sk-out">
        <button type="button" class="btn ghost small" data-act="save">${ICONS.save}<span>PNGで保存</span></button>
        ${admin ? `<button type="button" class="btn small" data-act="publish">${ICONS.publish}<span>作品として公開</span></button>` : ''}
      </div>
    </div>
    <div class="sk-paper">
      <canvas id="skBase" width="${W}" height="${H}" aria-label="らくがき帳のキャンバス"></canvas>
      <canvas id="skLive" width="${W}" height="${H}" aria-hidden="true"></canvas>
    </div>
    <p class="mono sk-hint">描きかけは自動で保存されます · <kbd>B</kbd> ペン <kbd>M</kbd> マーカー <kbd>E</kbd> 消しゴム <kbd>[</kbd><kbd>]</kbd> 太さ</p>
  </div>`;

const ICONS = {
  pen: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16l1-4 8.5-8.5a2.1 2.1 0 013 3L8 15l-4 1z"/><path d="M12 5l3 3"/></svg>',
  marker: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 14l-2 3h4l1-1.5"/><path d="M6 14l7.5-9.5a2 2 0 013 2.4L9 15.5 6 14z"/></svg>',
  eraser: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 16h8M3.5 12.5l7-7a2 2 0 012.8 0l1.7 1.7a2 2 0 010 2.8L9.5 16H7l-3.5-3.5z"/></svg>',
  undo: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5L3.5 8.5 7 12"/><path d="M4 8.5h7.5a4.5 4.5 0 010 9H9"/></svg>',
  redo: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M13 5l3.5 3.5L13 12"/><path d="M16 8.5H8.5a4.5 4.5 0 000 9H11"/></svg>',
  clear: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 6h11M8 6V4.5h4V6M6 6l.8 10h6.4L14 6"/></svg>',
  save: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3.5v9M6.5 9l3.5 3.5L13.5 9M4 15.5h12"/></svg>',
  publish: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V7M6.5 10L10 6.5 13.5 10M4 4h12"/></svg>',
};

// Draw one stroke onto a 2D context.
function paintStroke(ctx, s) {
  if (s.type === 'clear') { ctx.globalAlpha = 1; ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H); return; }
  const t = TOOLS[s.tool];
  const pts = s.points;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle = s.tool === 'eraser' ? PAPER : s.color;
  if (pts.length === 1) {
    const [x, y, p] = pts[0];
    ctx.beginPath(); ctx.arc(x, y, s.size * (t.min + (t.max - t.min) * p) / 2, 0, Math.PI * 2); ctx.fill();
  } else if (s.tool === 'pen') {
    // variable width: each segment gets its own width from pressure
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0, p0] = pts[i - 1], [x1, y1, p1] = pts[i];
      const mx0 = i > 1 ? (pts[i - 2][0] + x0) / 2 : x0, my0 = i > 1 ? (pts[i - 2][1] + y0) / 2 : y0;
      const mx1 = (x0 + x1) / 2, my1 = (y0 + y1) / 2;
      ctx.lineWidth = s.size * (t.min + (t.max - t.min) * ((p0 + p1) / 2));
      ctx.beginPath(); ctx.moveTo(mx0, my0); ctx.quadraticCurveTo(x0, y0, mx1, my1); ctx.stroke();
    }
    const [lx, ly] = pts[pts.length - 1], [px, py] = pts[pts.length - 2];
    ctx.beginPath(); ctx.moveTo((px + lx) / 2, (py + ly) / 2); ctx.lineTo(lx, ly); ctx.stroke();
  } else {
    ctx.lineWidth = s.size * (s.tool === 'marker' ? 1.6 : 1.4);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[pts.length - 1]; ctx.lineTo(last[0], last[1]); ctx.stroke();
  }
  ctx.restore();
}

// Marker strokes are drawn opaque on a scratch canvas, then laid down once at low alpha
// so overlapping parts of the same stroke do not darken.
let scratch;
function commitStroke(ctx, s) {
  if (s.tool !== 'marker') { paintStroke(ctx, s); return; }
  scratch ||= Object.assign(document.createElement('canvas'), { width: W, height: H });
  const sc = scratch.getContext('2d');
  sc.clearRect(0, 0, W, H); paintStroke(sc, s);
  ctx.save(); ctx.globalAlpha = TOOLS.marker.alpha; ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(scratch, 0, 0); ctx.restore();
}

export function mountDraw(root, { onPublish, onToast }) {
  const base = root.querySelector('#skBase'), live = root.querySelector('#skLive');
  const bctx = base.getContext('2d'), lctx = live.getContext('2d');
  let strokes = [], redo = [], cur = null;
  let tool = 'pen', color = COLORS[0], size = 10;

  try { const d = JSON.parse(store.get(DRAFT_KEY, 'null')); if (d?.strokes) strokes = d.strokes; } catch { /* no draft */ }

  const redraw = () => {
    bctx.globalAlpha = 1; bctx.fillStyle = PAPER; bctx.fillRect(0, 0, W, H);
    for (const s of strokes) commitStroke(bctx, s);
    syncButtons();
  };
  let saveTimer;
  const saveNow = () => {
    clearTimeout(saveTimer);
    const json = JSON.stringify({ strokes });
    if (json.length < 4_000_000) store.set(DRAFT_KEY, json);
  };
  const saveDraft = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); };
  const onHide = () => { if (document.visibilityState === 'hidden') saveNow(); };
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', onHide);
  const syncButtons = () => {
    root.querySelector('[data-act="undo"]').disabled = !strokes.length;
    root.querySelector('[data-act="redo"]').disabled = !redo.length;
    root.querySelector('[data-act="clear"]').disabled = !strokes.length || strokes[strokes.length - 1].type === 'clear';
  };
  const setTool = t => {
    tool = t;
    root.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.tool === t)));
    root.querySelector('.sk-paper').dataset.tool = t;
    updateDot();
  };
  const setColor = c => {
    color = c;
    root.querySelectorAll('.sk-color[data-color]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.color.toLowerCase() === c.toLowerCase())));
    root.querySelector('.sk-custom').setAttribute('aria-checked', String(!COLORS.some(x => x.toLowerCase() === c.toLowerCase())));
    root.querySelector('.sk-custom').style.setProperty('--c', c);
    if (tool === 'eraser') setTool('pen');
    updateDot();
  };
  const setSize = v => {
    size = Math.max(2, Math.min(80, Math.round(v)));
    root.querySelector('#skSize').value = size;
    root.querySelector('#skSizeLabel').textContent = size;
    updateDot();
  };
  const updateDot = () => {
    const d = root.querySelector('#skDot');
    const px = Math.max(3, Math.min(22, size * (base.clientWidth / W) * 1.2));
    d.style.width = d.style.height = `${px}px`;
    d.style.background = tool === 'eraser' ? PAPER : color;
    d.style.opacity = tool === 'marker' ? .45 : 1;
  };
  const undo = () => { if (!strokes.length) return; redo.push(strokes.pop()); redraw(); saveDraft(); };
  const redoFn = () => { if (!redo.length) return; strokes.push(redo.pop()); redraw(); saveDraft(); };
  const clear = () => { if (!strokes.length) return; strokes.push({ type: 'clear' }); redo = []; redraw(); saveDraft(); };

  // pointer drawing
  const toCanvas = e => {
    const r = base.getBoundingClientRect();
    const pressure = e.pointerType === 'pen' ? (e.pressure || .5) : .55;
    return [Math.round((e.clientX - r.left) * (W / r.width) * 10) / 10, Math.round((e.clientY - r.top) * (H / r.height) * 10) / 10, Math.round(pressure * 100) / 100];
  };
  let raf = 0;
  const drawLive = () => {
    raf = 0;
    lctx.clearRect(0, 0, W, H);
    if (!cur) return;
    lctx.save(); if (cur.tool === 'marker') lctx.globalAlpha = TOOLS.marker.alpha;
    paintStroke(lctx, cur); lctx.restore();
  };
  live.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    live.setPointerCapture(e.pointerId);
    cur = { type: 'stroke', tool, color, size, points: [toCanvas(e)] };
    raf ||= requestAnimationFrame(drawLive);
  });
  live.addEventListener('pointermove', e => {
    if (!cur) return;
    const evs = e.getCoalescedEvents?.() || [e];
    for (const ev of evs) {
      const p = toCanvas(ev), q = cur.points[cur.points.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 1.5) cur.points.push(p);
    }
    raf ||= requestAnimationFrame(drawLive);
  });
  const end = () => {
    if (!cur) return;
    strokes.push(cur); redo = [];
    commitStroke(bctx, cur);
    cur = null; lctx.clearRect(0, 0, W, H);
    syncButtons(); saveDraft();
  };
  live.addEventListener('pointerup', end);
  live.addEventListener('pointercancel', end);
  live.addEventListener('lostpointercapture', end);

  const exportBlob = () => new Promise(res => base.toBlob(res, 'image/png'));
  const stamp = () => { const d = new Date(); const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`; };

  root.addEventListener('click', async e => {
    const t = e.target.closest('[data-tool]')?.dataset.tool;
    if (t) { setTool(t); return; }
    const c = e.target.closest('.sk-color[data-color]')?.dataset.color;
    if (c) { setColor(c); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'undo') undo();
    if (act === 'redo') redoFn();
    if (act === 'clear') { clear(); onToast?.('全部消しました。元に戻すで復活できます。'); }
    if (act === 'save') {
      const blob = await exportBlob();
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `sketch-${stamp()}.png` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    if (act === 'publish') {
      if (!strokes.some(s => s.type === 'stroke')) { onToast?.('まだ何も描かれていません。', true); return; }
      const blob = await exportBlob();
      const d = new Date(), z = n => String(n).padStart(2, '0');
      const title = `らくがき ${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
      onPublish?.(new File([blob], `sketch-${stamp()}.png`, { type: 'image/png' }), title);
    }
  });
  root.querySelector('#skSize').addEventListener('input', e => setSize(Number(e.target.value)));
  root.querySelector('#skCustom').addEventListener('input', e => setColor(e.target.value));

  const onKey = e => {
    const typing = e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || (e.target.tagName === 'INPUT' && !['range', 'color', 'button'].includes(e.target.type));
    if (typing || document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redoFn() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redoFn(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'b') setTool('pen');
    if (k === 'm') setTool('marker');
    if (k === 'e') setTool('eraser');
    if (k === '[') setSize(size - (size > 20 ? 4 : 2));
    if (k === ']') setSize(size + (size >= 20 ? 4 : 2));
  };
  document.addEventListener('keydown', onKey);
  const onResize = () => updateDot();
  window.addEventListener('resize', onResize);

  setTool('pen'); setColor(COLORS[0]); setSize(10); redraw();

  return {
    destroy() {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pagehide', saveNow);
      document.removeEventListener('visibilitychange', onHide);
      saveNow();
    },
    clearDraftAfterPublish() { strokes = []; redo = []; redraw(); store.set(DRAFT_KEY, JSON.stringify({ strokes })); },
  };
}

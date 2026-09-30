// Sketchbook: a small layered doodle tool drawn on <canvas>.
// Each layer keeps its operations as data (strokes, fills, clears), so undo/redo is cheap
// and the draft can be saved and restored. Fills are stored as small cropped bitmaps.
import { store } from './util.js';

const W = 1600, H = 1200;           // fixed drawing surface (4:3), scaled to fit on screen
const PAPER = '#FBF8F0';
const DRAFT_KEY = 'cm-sketch-draft';
const MAX_LAYERS = 8;
const FILL_TOLERANCE = 48;          // max per-channel difference that still counts as "the same colour"
export const COLORS = [
  '#2B2622', '#6C6057', '#B9AE9C', '#FFFFFF',
  '#C8453A', '#E0703C', '#E9B949', '#8FAE4A',
  '#1F9A78', '#2F9BE0', '#5B6CF0', '#8E55E8',
];
const TOOLS = {
  pen:    { label: 'ペン', key: 'B', min: .35, max: 1.25 },
  marker: { label: 'マーカー', key: 'M', min: 1, max: 1, alpha: .35 },
  fill:   { label: '塗りつぶし', key: 'G' },
  eraser: { label: '消しゴム', key: 'E', min: 1, max: 1 },
};

const ICONS = {
  pen: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16l1-4 8.5-8.5a2.1 2.1 0 013 3L8 15l-4 1z"/><path d="M12 5l3 3"/></svg>',
  marker: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 14l-2 3h4l1-1.5"/><path d="M6 14l7.5-9.5a2 2 0 013 2.4L9 15.5 6 14z"/></svg>',
  fill: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.5 3.5l6.5 6.5-5.5 5.5a1.4 1.4 0 01-2 0L3 11a1.4 1.4 0 010-2l5.5-5.5z"/><path d="M3.5 10h11"/><path d="M16.5 12.5s1.5 1.8 1.5 2.8a1.5 1.5 0 01-3 0c0-1 1.5-2.8 1.5-2.8z"/></svg>',
  eraser: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 16h8M3.5 12.5l7-7a2 2 0 012.8 0l1.7 1.7a2 2 0 010 2.8L9.5 16H7l-3.5-3.5z"/></svg>',
  undo: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5L3.5 8.5 7 12"/><path d="M4 8.5h7.5a4.5 4.5 0 010 9H9"/></svg>',
  redo: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M13 5l3.5 3.5L13 12"/><path d="M16 8.5H8.5a4.5 4.5 0 000 9H11"/></svg>',
  clear: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 6h11M8 6V4.5h4V6M6 6l.8 10h6.4L14 6"/></svg>',
  save: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3.5v9M6.5 9l3.5 3.5L13.5 9M4 15.5h12"/></svg>',
  publish: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V7M6.5 10L10 6.5 13.5 10M4 4h12"/></svg>',
  plus: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>',
  up: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15V5M6 9l4-4 4 4"/></svg>',
  down: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5v10M6 11l4 4 4-4"/></svg>',
  eye: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5z"/><circle cx="10" cy="10" r="2.2"/></svg>',
  eyeOff: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 3l14 14M8.2 5.3A7.8 7.8 0 0110 5c4.7 0 7.5 5 7.5 5a13 13 0 01-2.3 2.8M12 14.6a6.6 6.6 0 01-2 .4c-4.7 0-7.5-5-7.5-5a12.7 12.7 0 013-3.4"/></svg>',
  layers: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3l7 4-7 4-7-4 7-4z"/><path d="M3 10.5l7 4 7-4M3 14l7 4 7-4" opacity=".7"/></svg>',
};

export const drawView = ({ admin }) => `
  <div class="sketch-app" id="sketchApp">
    <div class="sk-bar" role="toolbar" aria-label="描画ツール">
      <div class="sk-group" role="radiogroup" aria-label="道具">
        ${Object.entries(TOOLS).map(([k, t]) => `<button type="button" class="sk-tool" data-tool="${k}" role="radio" aria-checked="${k === 'pen'}" title="${t.label}（${t.key}）">${ICONS[k]}<span>${t.label}</span></button>`).join('')}
      </div>
      <div class="sk-group sk-colors" role="radiogroup" aria-label="色">
        ${COLORS.map((c, i) => `<button type="button" class="sk-color" data-color="${c}" role="radio" aria-checked="${i === 0}" aria-label="色 ${c}" style="--c:${c}"></button>`).join('')}
        <label class="sk-color sk-custom" title="好きな色"><input type="color" id="skCustom" value="#3D3530" aria-label="好きな色を選ぶ"></label>
      </div>
      <label class="sk-size" title="太さ（[ と ] でも変更）"><span class="sk-dot" id="skDot"></span><input type="range" id="skSize" min="2" max="80" value="10" aria-label="太さ"><span class="mono" id="skSizeLabel">10</span></label>
      <div class="sk-group">
        <button type="button" class="sk-icon" data-act="undo" title="元に戻す（Ctrl+Z）" aria-label="元に戻す">${ICONS.undo}</button>
        <button type="button" class="sk-icon" data-act="redo" title="やり直す（Ctrl+Shift+Z）" aria-label="やり直す">${ICONS.redo}</button>
        <button type="button" class="sk-icon" data-act="clear" title="このレイヤーを全部消す（元に戻せます）" aria-label="このレイヤーを全部消す">${ICONS.clear}</button>
      </div>
      <div class="sk-group sk-out">
        <button type="button" class="btn ghost small" data-act="save">${ICONS.save}<span>PNGで保存</span></button>
        ${admin ? `<button type="button" class="btn small" data-act="publish">${ICONS.publish}<span>作品として公開</span></button>` : ''}
      </div>
    </div>
    <div class="sk-work">
      <div class="sk-paper" id="skPaper">
        <div class="sk-stack" id="skStack"></div>
        <div class="sk-input" id="skLive" aria-label="らくがき帳のキャンバス" role="img"></div>
      </div>
      <aside class="sk-layers" aria-label="レイヤー">
        <div class="sk-layers-head">
          <p class="mono">${ICONS.layers}LAYERS</p>
          <div class="sk-group">
            <button type="button" class="sk-icon sm" data-act="layer-add" title="レイヤーを追加" aria-label="レイヤーを追加">${ICONS.plus}</button>
            <button type="button" class="sk-icon sm" data-act="layer-up" title="上へ" aria-label="選んでいるレイヤーを上へ">${ICONS.up}</button>
            <button type="button" class="sk-icon sm" data-act="layer-down" title="下へ" aria-label="選んでいるレイヤーを下へ">${ICONS.down}</button>
            <button type="button" class="sk-icon sm" data-act="layer-del" title="レイヤーを削除" aria-label="選んでいるレイヤーを削除">${ICONS.clear}</button>
          </div>
        </div>
        <ol class="sk-layer-list" id="skLayerList"></ol>
      </aside>
    </div>
    <p class="mono sk-hint">描きかけは自動で保存されます · <kbd>B</kbd> ペン <kbd>M</kbd> マーカー <kbd>G</kbd> 塗りつぶし <kbd>E</kbd> 消しゴム <kbd>[</kbd><kbd>]</kbd> 太さ</p>
  </div>`;

// ─── painting primitives ───────────────────────────────────────────────
function paintStroke(ctx, s) {
  const t = TOOLS[s.tool];
  const pts = s.points;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle = s.tool === 'eraser' ? '#000' : s.color;
  if (pts.length === 1) {
    const [x, y, p] = pts[0];
    ctx.beginPath(); ctx.arc(x, y, s.size * (t.min + (t.max - t.min) * p) / 2 * (s.tool === 'pen' ? 1 : 1.4), 0, Math.PI * 2); ctx.fill();
  } else if (s.tool === 'pen') {
    // variable width: each segment gets its own width from pressure
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0, p0] = pts[i - 1], [x1, y1, p1] = pts[i];
      const mx0 = i > 1 ? (pts[i - 2][0] + x0) / 2 : x0, my0 = i > 1 ? (pts[i - 2][1] + y0) / 2 : y0;
      ctx.lineWidth = s.size * (t.min + (t.max - t.min) * ((p0 + p1) / 2));
      ctx.beginPath(); ctx.moveTo(mx0, my0); ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2); ctx.stroke();
    }
    const [lx, ly] = pts[pts.length - 1], [px, py] = pts[pts.length - 2];
    ctx.beginPath(); ctx.moveTo((px + lx) / 2, (py + ly) / 2); ctx.lineTo(lx, ly); ctx.stroke();
  } else {
    ctx.lineWidth = s.size * (s.tool === 'marker' ? 1.6 : 1.4);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    const last = pts[pts.length - 1]; ctx.lineTo(last[0], last[1]); ctx.stroke();
  }
  ctx.restore();
}

let scratch;
const scratchCtx = () => {
  scratch ||= Object.assign(document.createElement('canvas'), { width: W, height: H });
  const c = scratch.getContext('2d'); c.clearRect(0, 0, W, H); return c;
};
// Apply one operation to a layer's context.
function applyOp(ctx, op) {
  if (op.type === 'clear') { ctx.clearRect(0, 0, W, H); return; }
  if (op.type === 'fill') { if (op.canvas) ctx.drawImage(op.canvas, op.x, op.y); return; }
  if (op.tool === 'eraser') {
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; paintStroke(ctx, op); ctx.restore(); return;
  }
  if (op.tool === 'marker') {
    // drawn opaque on a scratch canvas, laid down once at low alpha so the stroke doesn't darken itself
    const sc = scratchCtx(); paintStroke(sc, op);
    ctx.save(); ctx.globalAlpha = TOOLS.marker.alpha; ctx.drawImage(scratch, 0, 0); ctx.restore(); return;
  }
  paintStroke(ctx, op);
}

// Flood fill: sample the visible picture, fill the matching region with `hex`.
// Returns a cropped canvas + position, or null if there is nothing to fill.
function floodFill(composite, sx, sy, hex) {
  const { data } = composite;
  const i0 = (sy * W + sx) * 4;
  const r0 = data[i0], g0 = data[i0 + 1], b0 = data[i0 + 2], a0 = data[i0 + 3];
  const [fr, fg, fb] = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16));
  if (a0 === 255 && Math.abs(r0 - fr) < 3 && Math.abs(g0 - fg) < 3 && Math.abs(b0 - fb) < 3) return null;
  const same = i => {
    const a = data[i + 3];
    if (a0 < 8) return a < 8 + FILL_TOLERANCE;                  // filling empty paper: stop at anything drawn
    return Math.abs(data[i] - r0) <= FILL_TOLERANCE && Math.abs(data[i + 1] - g0) <= FILL_TOLERANCE
      && Math.abs(data[i + 2] - b0) <= FILL_TOLERANCE && Math.abs(a - a0) <= FILL_TOLERANCE;
  };
  const mask = new Uint8Array(W * H);
  const stack = [sx, sy];
  let minX = sx, maxX = sx, minY = sy, maxY = sy;
  while (stack.length) {
    const y = stack.pop(), x0 = stack.pop();
    let x = x0;
    while (x >= 0 && !mask[y * W + x] && same((y * W + x) * 4)) x--;
    x++;
    let upOpen = false, downOpen = false;
    while (x < W && !mask[y * W + x] && same((y * W + x) * 4)) {
      mask[y * W + x] = 1;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (y > 0) { const m = !mask[(y - 1) * W + x] && same(((y - 1) * W + x) * 4); if (m && !upOpen) { stack.push(x, y - 1); upOpen = true; } else if (!m) upOpen = false; }
      if (y < H - 1) { const m = !mask[(y + 1) * W + x] && same(((y + 1) * W + x) * 4); if (m && !downOpen) { stack.push(x, y + 1); downOpen = true; } else if (!m) downOpen = false; }
      x++;
    }
  }
  // grow the region by 1px so it tucks under anti-aliased line edges
  minX = Math.max(0, minX - 1); minY = Math.max(0, minY - 1); maxX = Math.min(W - 1, maxX + 1); maxY = Math.min(H - 1, maxY + 1);
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const cx = c.getContext('2d');
  const out = cx.createImageData(w, h);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const m = mask[y * W + x] || (x > 0 && mask[y * W + x - 1]) || (x < W - 1 && mask[y * W + x + 1])
        || (y > 0 && mask[(y - 1) * W + x]) || (y < H - 1 && mask[(y + 1) * W + x]);
      if (!m) continue;
      const o = ((y - minY) * w + (x - minX)) * 4;
      out.data[o] = fr; out.data[o + 1] = fg; out.data[o + 2] = fb; out.data[o + 3] = 255;
    }
  }
  cx.putImageData(out, 0, 0);
  return { canvas: c, x: minX, y: minY };
}

// ─── the tool ───────────────────────────────────────────────────────────
export function mountDraw(root, { onPublish, onToast }) {
  const stackEl = root.querySelector('#skStack'), input = root.querySelector('#skLive');
  const listEl = root.querySelector('#skLayerList');
  let layers = [], active = null, seq = 0;
  let history = [], redoStack = [];              // history: layer ids in the order ops were added
  let cur = null, snapshot = null;
  let tool = 'pen', color = COLORS[0], size = 10;

  const makeLayer = (name, opts = {}) => {
    const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H, className: 'sk-layer' });
    return { id: opts.id || `L${++seq}`, name, visible: opts.visible ?? true, ops: opts.ops || [], canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }) };
  };
  const layerById = id => layers.find(l => l.id === id);
  const activeLayer = () => layerById(active);
  const redrawLayer = l => { l.ctx.clearRect(0, 0, W, H); for (const op of l.ops) applyOp(l.ctx, op); };
  const mountCanvases = () => {
    stackEl.replaceChildren(...layers.map(l => { l.canvas.hidden = !l.visible; return l.canvas; }));
  };

  // ─ draft ─
  const serialize = () => JSON.stringify({
    v: 2, active, seq,
    layers: layers.map(l => ({ id: l.id, name: l.name, visible: l.visible, ops: l.ops.map(op => op.type === 'fill' ? { type: 'fill', x: op.x, y: op.y, src: op.src || (op.src = op.canvas.toDataURL('image/png')) } : op) })),
    history,
  });
  let saveTimer;
  const saveNow = () => { clearTimeout(saveTimer); try { const j = serialize(); if (j.length < 4_500_000) store.set(DRAFT_KEY, j); } catch { /* storage full */ } };
  const saveDraft = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); };
  const onHide = () => { if (document.visibilityState === 'hidden') saveNow(); };
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', onHide);

  const loadImage = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  async function restore() {
    let d = null;
    try { d = JSON.parse(store.get(DRAFT_KEY, 'null')); } catch { /* ignore */ }
    if (d?.v === 2 && Array.isArray(d.layers) && d.layers.length) {
      seq = d.seq || 0;
      layers = d.layers.map(l => makeLayer(l.name, l));
      active = layerById(d.active) ? d.active : layers[layers.length - 1].id;
      history = (d.history || []).filter(id => layerById(id));
      const fills = layers.flatMap(l => l.ops.filter(op => op.type === 'fill'));
      await Promise.all(fills.map(async op => {
        const im = await loadImage(op.src);
        if (!im) return;
        const c = Object.assign(document.createElement('canvas'), { width: im.width, height: im.height });
        c.getContext('2d').drawImage(im, 0, 0); op.canvas = c;
      }));
    } else if (Array.isArray(d?.strokes)) {
      // draft from the single-layer version
      const l = makeLayer('レイヤー 1', { ops: d.strokes.map(s => s.type === 'clear' ? { type: 'clear' } : s) });
      layers = [l]; active = l.id; history = l.ops.map(() => l.id);
    } else {
      const l = makeLayer('レイヤー 1'); layers = [l]; active = l.id;
    }
    layers.forEach(redrawLayer);
    mountCanvases(); renderLayers(); syncButtons();
  }

  // ─ layers panel ─
  function renderLayers() {
    listEl.innerHTML = [...layers].reverse().map(l => `
      <li class="sk-layer-row${l.id === active ? ' is-active' : ''}${l.visible ? '' : ' is-hidden'}" data-layer="${l.id}">
        <button type="button" class="sk-eye" data-act="layer-vis" aria-pressed="${l.visible}" title="${l.visible ? '隠す' : '表示する'}" aria-label="${l.name}を${l.visible ? '隠す' : '表示する'}">${l.visible ? ICONS.eye : ICONS.eyeOff}</button>
        <button type="button" class="sk-layer-pick" data-act="layer-pick" aria-current="${l.id === active}"><canvas class="sk-thumb" width="64" height="48" data-thumb="${l.id}"></canvas><span>${l.name}</span></button>
      </li>`).join('');
    layers.forEach(updateThumb);
    const i = layers.findIndex(l => l.id === active);
    root.querySelector('[data-act="layer-add"]').disabled = layers.length >= MAX_LAYERS;
    root.querySelector('[data-act="layer-up"]').disabled = i === layers.length - 1;
    root.querySelector('[data-act="layer-down"]').disabled = i === 0;
    root.querySelector('[data-act="layer-del"]').disabled = layers.length <= 1;
  }
  function updateThumb(l) {
    const t = listEl.querySelector(`[data-thumb="${l.id}"]`);
    if (!t) return;
    const c = t.getContext('2d');
    c.fillStyle = PAPER; c.fillRect(0, 0, 64, 48); c.drawImage(l.canvas, 0, 0, 64, 48);
  }
  const addLayer = () => {
    if (layers.length >= MAX_LAYERS) return;
    const n = Math.max(0, ...layers.map(l => Number(l.name.replace(/\D/g, '')) || 0)) + 1;
    const l = makeLayer(`レイヤー ${n}`);
    const i = layers.findIndex(x => x.id === active);
    layers.splice(i + 1, 0, l); active = l.id;
    mountCanvases(); renderLayers(); saveDraft();
  };
  const deleteLayer = () => {
    if (layers.length <= 1) return;
    const l = activeLayer();
    if (l.ops.length && !confirm(`「${l.name}」を削除しますか？ このレイヤーの絵は元に戻せません。`)) return;
    const i = layers.indexOf(l);
    layers.splice(i, 1);
    history = history.filter(id => id !== l.id);
    redoStack = redoStack.filter(r => r.layer !== l.id);
    active = layers[Math.max(0, i - 1)].id;
    mountCanvases(); renderLayers(); syncButtons(); saveDraft();
  };
  const moveLayer = dir => {
    const i = layers.findIndex(l => l.id === active), j = i + dir;
    if (j < 0 || j >= layers.length) return;
    [layers[i], layers[j]] = [layers[j], layers[i]];
    mountCanvases(); renderLayers(); saveDraft();
  };

  // ─ history ─
  const pushOp = (l, op) => { l.ops.push(op); history.push(l.id); redoStack = []; updateThumb(l); syncButtons(); saveDraft(); };
  const undo = () => {
    const id = history.pop(); if (!id) return;
    const l = layerById(id); const op = l.ops.pop();
    redoStack.push({ layer: id, op }); redrawLayer(l); updateThumb(l); syncButtons(); saveDraft();
  };
  const redo = () => {
    const r = redoStack.pop(); if (!r) return;
    const l = layerById(r.layer); if (!l) return;
    l.ops.push(r.op); history.push(l.id); applyOp(l.ctx, r.op); updateThumb(l); syncButtons(); saveDraft();
  };
  const clearLayer = () => {
    const l = activeLayer(); if (!l.ops.length || l.ops[l.ops.length - 1].type === 'clear') return;
    const op = { type: 'clear' }; applyOp(l.ctx, op); pushOp(l, op);
    onToast?.(`「${l.name}」を消しました。元に戻すで復活できます。`);
  };
  function syncButtons() {
    root.querySelector('[data-act="undo"]').disabled = !history.length;
    root.querySelector('[data-act="redo"]').disabled = !redoStack.length;
    const l = activeLayer();
    root.querySelector('[data-act="clear"]').disabled = !l || !l.ops.length || l.ops[l.ops.length - 1].type === 'clear';
  }

  // ─ tools ─
  const setTool = t => {
    tool = t;
    root.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.tool === t)));
    root.querySelector('#skPaper').dataset.tool = t;
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
    const px = Math.max(3, Math.min(22, size * (input.clientWidth / W) * 1.2));
    d.style.width = d.style.height = `${px}px`;
    d.style.background = tool === 'eraser' ? PAPER : color;
    d.style.opacity = tool === 'marker' ? .45 : 1;
  };

  // ─ pointer input ─
  const toCanvas = e => {
    const r = input.getBoundingClientRect();
    const pressure = e.pointerType === 'pen' ? (e.pressure || .5) : .55;
    return [Math.round((e.clientX - r.left) * (W / r.width) * 10) / 10, Math.round((e.clientY - r.top) * (H / r.height) * 10) / 10, Math.round(pressure * 100) / 100];
  };
  let raf = 0;
  const drawLive = () => {
    raf = 0;
    const l = activeLayer(); if (!cur || !l) return;
    l.ctx.clearRect(0, 0, W, H); l.ctx.drawImage(snapshot, 0, 0);
    applyOp(l.ctx, cur);
  };
  const doFill = e => {
    const l = activeLayer();
    if (!l.visible) { onToast?.('非表示のレイヤーには塗れません。', true); return; }
    const [fx, fy] = toCanvas(e);
    const x = Math.max(0, Math.min(W - 1, Math.floor(fx))), y = Math.max(0, Math.min(H - 1, Math.floor(fy)));
    const comp = scratchCtx();
    for (const v of layers) if (v.visible) comp.drawImage(v.canvas, 0, 0);
    const res = floodFill(comp.getImageData(0, 0, W, H), x, y, color.toUpperCase());
    if (!res) return;
    const op = { type: 'fill', x: res.x, y: res.y, canvas: res.canvas };
    applyOp(l.ctx, op); pushOp(l, op);
  };
  input.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const l = activeLayer();
    if (tool === 'fill') { doFill(e); return; }
    if (!l.visible) { onToast?.('非表示のレイヤーには描けません。目のアイコンで表示してください。', true); return; }
    input.setPointerCapture(e.pointerId);
    snapshot ||= Object.assign(document.createElement('canvas'), { width: W, height: H });
    const sc = snapshot.getContext('2d'); sc.clearRect(0, 0, W, H); sc.drawImage(l.canvas, 0, 0);
    cur = { type: 'stroke', tool, color, size, points: [toCanvas(e)] };
    raf ||= requestAnimationFrame(drawLive);
  });
  input.addEventListener('pointermove', e => {
    if (!cur) return;
    for (const ev of e.getCoalescedEvents?.() || [e]) {
      const p = toCanvas(ev), q = cur.points[cur.points.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 1.5) cur.points.push(p);
    }
    raf ||= requestAnimationFrame(drawLive);
  });
  const end = () => {
    if (!cur) return;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const l = activeLayer();
    l.ctx.clearRect(0, 0, W, H); l.ctx.drawImage(snapshot, 0, 0); applyOp(l.ctx, cur);
    pushOp(l, cur); cur = null;
  };
  input.addEventListener('pointerup', end);
  input.addEventListener('pointercancel', end);
  input.addEventListener('lostpointercapture', end);

  // ─ export ─
  const compose = () => {
    const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const x = c.getContext('2d'); x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
    for (const l of layers) if (l.visible) x.drawImage(l.canvas, 0, 0);
    return c;
  };
  const exportBlob = () => new Promise(res => compose().toBlob(res, 'image/png'));
  const stamp = () => { const d = new Date(); const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`; };

  root.addEventListener('click', async e => {
    const t = e.target.closest('[data-tool]')?.dataset.tool;
    if (t) { setTool(t); return; }
    const c = e.target.closest('.sk-color[data-color]')?.dataset.color;
    if (c) { setColor(c); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    const rowId = e.target.closest('[data-layer]')?.dataset.layer;
    if (act === 'layer-pick' && rowId) { active = rowId; renderLayers(); syncButtons(); saveDraft(); return; }
    if (act === 'layer-vis' && rowId) {
      const l = layerById(rowId); l.visible = !l.visible; l.canvas.hidden = !l.visible; renderLayers(); saveDraft(); return;
    }
    if (act === 'layer-add') addLayer();
    if (act === 'layer-del') deleteLayer();
    if (act === 'layer-up') moveLayer(1);
    if (act === 'layer-down') moveLayer(-1);
    if (act === 'undo') undo();
    if (act === 'redo') redo();
    if (act === 'clear') clearLayer();
    if (act === 'save') {
      const blob = await exportBlob();
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `sketch-${stamp()}.png` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    if (act === 'publish') {
      if (!layers.some(l => l.visible && l.ops.some(op => op.type !== 'clear'))) { onToast?.('まだ何も描かれていません。', true); return; }
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
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'b') setTool('pen');
    if (k === 'm') setTool('marker');
    if (k === 'g') setTool('fill');
    if (k === 'e') setTool('eraser');
    if (k === '[') setSize(size - (size > 20 ? 4 : 2));
    if (k === ']') setSize(size + (size >= 20 ? 4 : 2));
  };
  document.addEventListener('keydown', onKey);
  const onResize = () => updateDot();
  window.addEventListener('resize', onResize);

  setTool('pen'); setColor(COLORS[0]); setSize(10);
  restore();

  return {
    destroy() {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pagehide', saveNow);
      document.removeEventListener('visibilitychange', onHide);
      if (layers.length) saveNow();
    },
    clearDraftAfterPublish() {
      const l = makeLayer('レイヤー 1'); seq = 1; l.id = 'L1';
      layers = [l]; active = l.id; history = []; redoStack = [];
      mountCanvases(); renderLayers(); syncButtons(); saveNow();
    },
  };
}

// Generates abstract placeholder artworks into /samples (full + thumbnail WebP).
// Run: NODE_PATH=$(npm root -g) node scripts/make-samples.cjs
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '..', 'samples');
fs.mkdirSync(out, { recursive: true });

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = a => a[Math.floor(rnd() * a.length)];
const r = (a, b) => a + rnd() * (b - a);

const PAL = [
  ['#F3EFE4', '#1F2019', '#A9B94A', '#D9D3BF'],
  ['#EDE8DC', '#2C3A2E', '#C8643B', '#E7C99A'],
  ['#E9EEF0', '#1E2B38', '#5C87A6', '#D6A85C'],
  ['#F4F0EA', '#262320', '#B8A3C9', '#E4D6C3'],
  ['#1B1C18', '#EDEAE0', '#B7C94E', '#5B5F4A'],
  ['#F2EDE3', '#3B2F2A', '#8C9A6B', '#D8B07A'],
];

const styles = {
  orbit(w, h, p) {
    let s = `<rect width="${w}" height="${h}" fill="${p[0]}"/>`;
    const cx = w * r(0.35, 0.65), cy = h * r(0.4, 0.6);
    for (let i = 0; i < 26; i++) {
      const rr = Math.min(w, h) * (0.05 + i * 0.018);
      s += `<ellipse cx="${cx}" cy="${cy}" rx="${rr * r(1, 1.6)}" ry="${rr}" transform="rotate(${r(-30, 30)} ${cx} ${cy})" fill="none" stroke="${i % 5 ? p[1] : p[2]}" stroke-opacity="${r(0.25, 0.8)}" stroke-width="${r(0.6, 2.4)}"/>`;
    }
    s += `<circle cx="${cx + r(-80, 80)}" cy="${cy + r(-80, 80)}" r="${Math.min(w, h) * 0.06}" fill="${p[2]}"/>`;
    return s;
  },
  horizon(w, h, p) {
    const y = h * r(0.55, 0.7);
    let s = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[3]}"/><stop offset="1" stop-color="${p[0]}"/></linearGradient></defs>`;
    s += `<rect width="${w}" height="${h}" fill="url(#g)"/>`;
    s += `<circle cx="${w * r(0.3, 0.7)}" cy="${y - h * 0.08}" r="${Math.min(w, h) * r(0.12, 0.2)}" fill="${p[2]}" fill-opacity=".9"/>`;
    s += `<rect y="${y}" width="${w}" height="${h - y}" fill="${p[1]}"/>`;
    for (let i = 0; i < 14; i++) {
      const yy = y + 14 + i * i * 3.2;
      s += `<line x1="${w * r(0.1, 0.4)}" x2="${w * r(0.6, 0.9)}" y1="${yy}" y2="${yy}" stroke="${p[2]}" stroke-opacity="${0.6 - i * 0.04}" stroke-width="2"/>`;
    }
    return s;
  },
  dots(w, h, p) {
    let s = `<rect width="${w}" height="${h}" fill="${p[0]}"/>`;
    const step = Math.min(w, h) / 22;
    const fx = r(0.002, 0.006), fy = r(0.002, 0.006);
    for (let x = step; x < w; x += step) for (let y = step; y < h; y += step) {
      const v = (Math.sin(x * fx) + Math.cos(y * fy) + Math.sin((x + y) * 0.003)) / 3;
      const rad = Math.max(0.6, (v + 1) * step * 0.28);
      s += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${v > 0.45 ? p[2] : p[1]}" fill-opacity="${0.35 + (v + 1) * 0.3}"/>`;
    }
    return s;
  },
  ink(w, h, p) {
    let s = `<rect width="${w}" height="${h}" fill="${p[0]}"/><defs><filter id="f"><feTurbulence type="fractalNoise" baseFrequency="${r(0.004, 0.012)}" numOctaves="4" seed="${Math.floor(r(1, 99))}"/><feDisplacementMap in="SourceGraphic" scale="${r(90, 180)}"/></filter></defs><g filter="url(#f)">`;
    for (let i = 0; i < 9; i++) s += `<circle cx="${w * r(0.2, 0.8)}" cy="${h * r(0.2, 0.8)}" r="${Math.min(w, h) * r(0.04, 0.18)}" fill="${i % 3 ? p[1] : p[2]}" fill-opacity="${r(0.55, 0.95)}"/>`;
    s += `</g>`;
    for (let i = 0; i < 60; i++) s += `<circle cx="${w * r(0.05, 0.95)}" cy="${h * r(0.05, 0.95)}" r="${r(1, 7)}" fill="${pick([p[1], p[2]])}"/>`;
    return s;
  },
  stripes(w, h, p) {
    let s = `<rect width="${w}" height="${h}" fill="${p[0]}"/>`;
    let x = w * 0.12;
    while (x < w * 0.88) {
      const bw = r(8, 70);
      s += `<rect x="${x}" y="${h * r(0.1, 0.25)}" width="${bw}" height="${h * r(0.5, 0.75)}" fill="${pick(p.slice(1))}" fill-opacity="${r(0.55, 1)}"/>`;
      x += bw + r(4, 30);
    }
    return s;
  },
  blocks(w, h, p) {
    let s = `<rect width="${w}" height="${h}" fill="${p[0]}"/>`;
    const split = (x, y, bw, bh, d) => {
      if (d > 4 || (d > 1 && rnd() < 0.25)) {
        s += `<rect x="${x + 6}" y="${y + 6}" width="${bw - 12}" height="${bh - 12}" fill="${pick([p[0], p[3], p[3], p[2], p[1]])}"/>`;
        return;
      }
      if (bw > bh) { const k = bw * r(0.3, 0.7); split(x, y, k, bh, d + 1); split(x + k, y, bw - k, bh, d + 1); }
      else { const k = bh * r(0.3, 0.7); split(x, y, bw, k, d + 1); split(x, y + k, bw, bh - k, d + 1); }
    };
    split(w * 0.08, h * 0.08, w * 0.84, h * 0.84, 0);
    return s;
  },
};

const plan = [
  ['orbit', 1600, 1200, '軌道の練習', 'Claude'],
  ['ink', 1200, 1500, '墨と黄緑', 'GPT'],
  ['horizon', 1800, 1100, '低い太陽', 'Gemini'],
  ['dots', 1400, 1400, '点の気象図', 'Qwen'],
  ['blocks', 1200, 1600, '区画 No.4', 'Claude'],
  ['stripes', 1600, 1100, 'バーコードの森', 'Kimi'],
  ['ink', 1600, 1200, '滲みの地図', 'Other'],
  ['orbit', 1200, 1500, '二重の周回', 'GPT'],
  ['horizon', 1400, 1400, '夕方のプール', 'Claude'],
  ['dots', 1800, 1100, '波の点描', 'Gemini'],
  ['blocks', 1500, 1200, '窓の配置', 'GPT'],
  ['stripes', 1200, 1500, '縦の音', 'Other'],
];

(async () => {
  const meta = [];
  for (let i = 0; i < plan.length; i++) {
    const [style, w, h, title, ai] = plan[i];
    const p = PAL[i % PAL.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${styles[style](w, h, p)}</svg>`;
    const n = String(i + 1).padStart(2, '0');
    const base = sharp(Buffer.from(svg));
    await base.clone().webp({ quality: 84 }).toFile(path.join(out, `${n}.webp`));
    await base.clone().resize({ width: 720, height: 720, fit: 'inside' }).webp({ quality: 78 }).toFile(path.join(out, `${n}-t.webp`));
    meta.push({ n, title, ai, w, h });
  }
  fs.writeFileSync(path.join(out, 'samples.json'), JSON.stringify(meta, null, 2));
  console.log('done', meta.length);
})();

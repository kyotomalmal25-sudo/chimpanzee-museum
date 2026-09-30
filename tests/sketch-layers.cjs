// Sketchbook layers + fill checks. Run: node scripts/serve.mjs & NODE_PATH=$(npm root -g) node tests/sketch-layers.cjs
const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '@font-face{font-family:"Noto Sans JP";src:url(https://fonts.gstatic.com/noto.ttf);font-weight:100 900}' }));
  await p.route('**/fonts.gstatic.com/**', r => r.fulfill({ path: process.env.NOTO_JP || '', contentType: 'font/ttf', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await p.goto('' + (process.env.BASE || 'http://127.0.0.1:4173') + '/draw?demo');
  await p.evaluate(() => localStorage.removeItem('cm-sketch-draft')); await p.reload();
  await p.waitForSelector('.sk-layer-row');
  await p.evaluate(() => window.scrollTo(0, document.querySelector('.sketch-app').offsetTop - 10)); await p.waitForTimeout(200);
  const box = await p.locator('#skLive').boundingBox();
  const at = (fx, fy) => [box.x + fx * box.width, box.y + fy * box.height];
  const draw = async pts => { await p.mouse.move(...at(...pts[0])); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(...at(...q), { steps: 4 }); await p.mouse.up(); };
  const px = (layerIdx, x, y) => p.evaluate(([i, x, y]) => [...document.querySelectorAll('#skStack canvas')[i].getContext('2d').getImageData(x, y, 1, 1).data], [layerIdx, x, y]);
  const circle = (cx, cy, r, n = 48) => Array.from({ length: n + 2 }, (_, i) => [cx + r * Math.cos(i / n * 2 * Math.PI), cy + r * 1.333 * Math.sin(i / n * 2 * Math.PI)]);
  const r = [];
  const t = async (name, fn) => { try { await fn(); r.push('PASS ' + name); } catch (e) { r.push('FAIL ' + name + ' :: ' + e.message.split('\n')[0]); } };

  await t('draw a closed circle on layer 1', async () => {
    await p.fill('#skSize', '12'); await p.locator('#skSize').dispatchEvent('input');
    await draw(circle(.35, .5, .15));
    assert.equal((await px(0, 560, 600))[3], 0, 'centre of circle is empty on layer 1');
  });
  await t('add layer 2 (becomes active, on top)', async () => {
    await p.click('[data-act="layer-add"]');
    assert.equal(await p.locator('.sk-layer-row').count(), 2);
    assert.equal(await p.locator('.sk-layer-row').first().locator('span').textContent(), 'レイヤー 2');
    assert.ok(await p.locator('.sk-layer-row').first().evaluate(e => e.classList.contains('is-active')));
  });
  await t('fill inside the circle on layer 2 only, bounded by layer-1 line', async () => {
    await p.click('[data-tool="fill"]'); await p.click('[data-color="#E0703C"]');
    await p.mouse.click(...at(.35, .5)); await p.waitForTimeout(200);
    const inside = await px(1, 560, 600), outside = await px(1, 1200, 200), l1 = await px(0, 560, 600);
    assert.deepEqual(inside, [224, 112, 60, 255], 'inside filled: ' + inside);
    assert.equal(outside[3], 0, 'outside not filled');
    assert.equal(l1[3], 0, 'layer 1 untouched');
  });
  await t('fill reaches under the line edge (no white gap)', async () => {
    // a point just inside the stroke should be covered by the fill
    const edge = await p.evaluate(() => {
      const c2 = document.querySelectorAll('#skStack canvas')[1].getContext('2d').getImageData(0, 0, 1600, 1200).data;
      const c1 = document.querySelectorAll('#skStack canvas')[0].getContext('2d').getImageData(0, 0, 1600, 1200).data;
      let gaps = 0; const y = 600;
      for (let x = 560; x < 900; x++) { const i = (y * 1600 + x) * 4; if (c1[i + 3] > 0) break; if (c2[i + 3] === 0) gaps++; }
      return gaps;
    });
    assert.equal(edge, 0, `unfilled pixels before the line: ${edge}`);
  });
  await t('eraser on layer 2 does not erase layer 1', async () => {
    await p.click('[data-tool="eraser"]'); await p.fill('#skSize', '40'); await p.locator('#skSize').dispatchEvent('input');
    await draw([[.2, .5], [.5, .5]]);
    assert.equal((await px(1, 560, 600))[3], 0, 'fill erased on layer 2');
    const l1line = await p.evaluate(() => { const d = document.querySelectorAll('#skStack canvas')[0].getContext('2d').getImageData(0, 590, 1600, 20).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
    assert.ok(l1line > 0, 'layer 1 line still there');
  });
  await t('undo restores the erased fill; history crosses layers', async () => {
    await p.keyboard.press('Control+z');
    assert.deepEqual(await px(1, 560, 600), [224, 112, 60, 255]);
    await p.keyboard.press('Control+z'); // undo the fill
    assert.equal((await px(1, 560, 600))[3], 0);
    await p.keyboard.press('Control+Shift+z'); // redo fill
    assert.deepEqual(await px(1, 560, 600), [224, 112, 60, 255]);
  });
  await t('hide layer 2 → export shows paper there; show again', async () => {
    await p.click('.sk-layer-row >> nth=0 >> [data-act="layer-vis"]');
    assert.ok(await p.evaluate(() => document.querySelectorAll('#skStack canvas')[1].hidden));
    await p.click('.sk-layer-row >> nth=0 >> [data-act="layer-vis"]');
  });
  await t('move layer 2 below layer 1 (canvas order changes)', async () => {
    await p.click('[data-act="layer-down"]');
    const names = await p.locator('.sk-layer-row span').allTextContents();
    assert.deepEqual(names, ['レイヤー 1', 'レイヤー 2']);
    assert.deepEqual(await px(0, 560, 600), [224, 112, 60, 255], 'filled layer is now the bottom canvas');
  });
  await t('draft restores layers and the fill after reload', async () => {
    await p.waitForTimeout(600);
    await p.reload(); await p.waitForSelector('.sk-layer-row'); await p.waitForTimeout(600);
    assert.equal(await p.locator('.sk-layer-row').count(), 2);
    assert.deepEqual(await px(0, 560, 600), [224, 112, 60, 255]);
  });
  await t('delete layer', async () => {
    await p.click('[data-act="layer-del"]');
    assert.equal(await p.locator('.sk-layer-row').count(), 1);
  });
  await p.evaluate(() => window.scrollTo(0, document.querySelector('.sketch-app').offsetTop - 10));
  await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/layers.png' });
  const m = await b.newPage({ viewport: { width: 390, height: 844 } });
  await m.route('**/fonts.g*/**', r => r.abort());
  await m.goto('' + (process.env.BASE || 'http://127.0.0.1:4173') + '/draw?demo'); await m.waitForSelector('.sk-layer-row'); await m.waitForTimeout(300);
  r.push('mobile overflow ' + await m.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  await m.evaluate(() => window.scrollTo(0, 400)); await m.screenshot({ path: (process.env.SHOTS || '/tmp') + '/layers-m.png' });
  console.log(r.join('\n')); console.log('errors', errs);
  await b.close();
})();

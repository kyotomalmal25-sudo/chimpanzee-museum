// End-to-end check against a simulated Supabase (REST, Auth, Storage are mocked in the browser).
// Run: node scripts/serve.mjs & NODE_PATH=$(npm root -g) node tests/e2e.cjs
const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:4173';
const SHOTS = process.env.SHOTS || '/tmp/e2e-shots';
fs.mkdirSync(SHOTS, { recursive: true });

// supabase-js sends Blob uploads as multipart/form-data; pull out the file part.
function parseUpload(req) {
  const ct = req.headers()['content-type'] || '';
  const buf = req.postDataBuffer();
  const m = ct.match(/boundary=(.+)$/);
  if (!m) return { type: ct, body: buf };
  const parts = buf.toString('latin1').split('--' + m[1]);
  for (const part of parts) {
    const i = part.indexOf('\r\n\r\n');
    if (i < 0) continue;
    const head = part.slice(0, i);
    const type = (head.match(/Content-Type: (.+)/i) || [])[1];
    if (type && /filename=/.test(head)) return { type: type.trim(), body: Buffer.from(part.slice(i + 4, part.length - 2), 'latin1') };
  }
  return { type: ct, body: buf };
}

function mockSupabase(page, db) {
  const uploads = new Map();
  const removed = [];
  const now = () => new Date().toISOString();
  page.route('**/*.supabase.co/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const m = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    const wantsObject = (req.headers()['accept'] || '').includes('pgrst.object');
    const out = rows => json(wantsObject ? (rows[0] ?? null) : rows);

    if (url.pathname.startsWith('/auth/v1/token')) {
      const body = JSON.parse(req.postData() || '{}');
      if (body.password !== 'correct') return json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
      return json({ access_token: 'tok', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: 'admin-1', email: body.email, aud: 'authenticated', role: 'authenticated' } });
    }
    if (url.pathname.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    if (url.pathname === '/rest/v1/museum_admins') return out(req.headers()['authorization']?.includes('tok') ? [{ user_id: 'admin-1' }] : []);
    if (url.pathname === '/rest/v1/museum_works') {
      if (db.fail) return json({ message: 'down' }, 500);
      if (m === 'GET') {
        const rows = [...db.works].sort((a, b) => (a.sort_order - b.sort_order) || b.created_at.localeCompare(a.created_at));
        return json(rows);
      }
      if (m === 'POST') {
        const v = JSON.parse(req.postData());
        const row = { id: `w${++db.seq}`, created_at: now(), updated_at: now(), ...v };
        db.works.push(row); return out([row]);
      }
      const id = url.searchParams.get('id')?.replace('eq.', '');
      const upd = url.searchParams.get('updated_at')?.replace('eq.', '');
      const row = db.works.find(w => w.id === id && w.updated_at === upd);
      if (m === 'PATCH') { if (!row) return out([]); Object.assign(row, JSON.parse(req.postData()), { updated_at: now() + 'x' }); return out([row]); }
      if (m === 'DELETE') { if (!row) return out([]); db.works = db.works.filter(w => w !== row); return out([{ id: row.id }]); }
    }
    if (url.pathname.startsWith('/storage/v1/object/public/')) {
      const key = url.pathname.replace('/storage/v1/object/public/museum-images/', '');
      const f = uploads.get(key);
      return f ? route.fulfill({ status: 200, contentType: f.type, body: f.body }) : route.fulfill({ status: 404 });
    }
    if (url.pathname.startsWith('/storage/v1/object/museum-images/') && m === 'POST') {
      const key = url.pathname.replace('/storage/v1/object/museum-images/', '');
      uploads.set(key, parseUpload(req));
      return json({ Key: `museum-images/${key}` });
    }
    if (url.pathname === '/storage/v1/object/museum-images' && m === 'DELETE') {
      removed.push(...JSON.parse(req.postData()).prefixes); return json([]);
    }
    return json({}, 404);
  });
  return { uploads, removed };
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const results = [];
  const step = async (name, fn) => { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); } };

  // Build a couple of real image files for upload.
  const tmp = fs.mkdtempSync('/tmp/cm-');
  const sharp = require('sharp');
  const big = path.join(tmp, 'big_landscape-01.png');
  const tall = path.join(tmp, 'tall portrait.jpg');
  await sharp({ create: { width: 4000, height: 2600, channels: 3, background: '#88aa44' } }).png().toFile(big);
  await sharp({ create: { width: 1500, height: 3000, channels: 3, background: '#224466' } }).jpeg().toFile(tall);

  const db = { seq: 0, works: [], fail: false };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  const store = mockSupabase(page, db);

  await step('empty archive shows samples', async () => {
    await page.goto(`${BASE}/collection`);
    await page.waitForSelector('.grid .card');
    assert.equal(await page.locator('.card').count(), 12);
    assert.ok(await page.locator('.sample-note').isVisible());
  });

  await step('no admin entry point in public UI', async () => {
    assert.equal(await page.locator('#adminTools').isVisible(), false);
    assert.equal(await page.getByText('管理者ログイン').isVisible(), false);
  });

  await step('wrong password shows error', async () => {
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('#loginDialog[open]');
    await page.fill('#loginEmail', 'mal@example.com');
    await page.fill('#loginPassword', 'nope');
    await page.click('#loginSubmit');
    await page.waitForFunction(() => document.getElementById('loginMsg').dataset.error === 'true');
  });

  await step('login → admin mode', async () => {
    await page.fill('#loginPassword', 'correct');
    await page.click('#loginSubmit');
    await page.waitForSelector('#adminTools:not([hidden])');
    assert.equal(new URL(page.url()).pathname, '/collection');
  });

  await step('multi upload resizes to webp + thumb and publishes', async () => {
    await page.click('[data-act="upload"]');
    await page.setInputFiles('#uploadInput', [big, tall]);
    assert.equal(await page.locator('.q-item').count(), 2);
    assert.equal(await page.inputValue('.q-item >> nth=0 >> [data-f="title"]'), 'big landscape 01');
    await page.selectOption('#bulkAi', 'Qwen');
    await page.fill('.q-item >> nth=1 >> [data-f="alt"]', '縦長のテスト');
    await page.screenshot({ path: `${SHOTS}/upload.png` });
    await page.click('#uploadSubmit');
    try { await page.waitForSelector('#uploadDialog:not([open])', { state: 'attached', timeout: 60000 }); }
    catch (e) { throw new Error('dialog still open: ' + (await page.locator('#queue').innerText()) + ' | ' + (await page.locator('#uploadMsg').innerText())); }
    await page.waitForSelector('.grid .card');
    assert.equal(await page.locator('.card').count(), 2);
    assert.equal(db.works.length, 2);
    assert.ok(db.works.every(w => w.ai === 'Qwen'));
    const keys = [...store.uploads.keys()];
    assert.equal(keys.filter(k => k.endsWith('.full.webp')).length, 2, keys.join());
    assert.equal(keys.filter(k => k.endsWith('.thumb.webp')).length, 2);
    for (const [k, f] of store.uploads) {
      const meta = await sharp(f.body).metadata();
      if (k.endsWith('.thumb.webp')) assert.ok(Math.max(meta.width, meta.height) <= 720, `thumb ${meta.width}x${meta.height}`);
      else assert.ok(Math.max(meta.width, meta.height) <= 2400, `full ${meta.width}x${meta.height}`);
      assert.equal(meta.format, 'webp');
    }
    // first selected file appears first
    assert.equal(await page.locator('.card-title').first().textContent(), 'big landscape 01');
    await page.screenshot({ path: `${SHOTS}/after-upload.png` });
  });

  await step('grid uses thumbnails, viewing room uses full', async () => {
    const src = await page.locator('.card img').first().getAttribute('src');
    assert.ok(src.endsWith('.thumb.webp'), src);
    await page.locator('.card-link').first().click();
    await page.waitForSelector('#stage img');
    const full = await page.locator('#stage img').getAttribute('src');
    assert.ok(full.endsWith('.full.webp'), full);
    assert.ok(/^\/work\/w\d+$/.test(new URL(page.url()).pathname));
    assert.match(await page.title(), /big landscape 01/);
  });

  await step('arrow keys move, title updates, back button works', async () => {
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.title.startsWith('tall portrait'));
    await page.goBack();
    await page.waitForFunction(() => document.title.startsWith('big landscape'));
    await page.reload();
    await page.waitForSelector('#stage img');
    assert.match(await page.title(), /big landscape 01/);
  });

  await step('edit title + AI', async () => {
    await page.click('[data-act-main="edit"]');
    await page.fill('#editName', '緑の平原');
    await page.selectOption('#editAi', 'Gemini');
    await page.click('#editSubmit');
    try { await page.waitForSelector('#editDialog:not([open])', { state: 'attached', timeout: 15000 }); }
    catch (e) { throw new Error('edit still open: ' + (await page.locator('#editMsg').innerText())); }
    await page.waitForFunction(() => document.querySelector('.plate-title')?.textContent === '緑の平原');
    assert.equal(db.works.find(w => w.title === '緑の平原').ai, 'Gemini');
    assert.ok(await page.locator('.nav-item[href="/collection/gemini"]').isVisible());
    await page.screenshot({ path: `${SHOTS}/work-admin.png` });
  });

  await step('replace image removes old files', async () => {
    const before = db.works.find(w => w.title === '緑の平原').storage_path;
    await page.click('[data-act-main="edit"]');
    await page.setInputFiles('#editFile', tall);
    await page.click('#editSubmit');
    try { await page.waitForSelector('#editDialog:not([open])', { state: 'attached', timeout: 60000 }); }
    catch (e) { throw new Error('edit still open: ' + (await page.locator('#editMsg').innerText())); }
    assert.ok(store.removed.includes(before), 'old full removed');
    assert.ok(store.removed.includes(before.replace('.full.webp', '.thumb.webp')), 'old thumb removed');
  });

  await step('delete from viewing room', async () => {
    await page.click('[data-act-main="edit"]');
    await page.click('#editDelete');
    await page.waitForFunction(() => !document.querySelector('#editDialog[open]'));
    await page.waitForFunction(() => document.title.startsWith('tall portrait'));
    assert.equal(db.works.length, 1);
  });

  await step('menu always lists Grok, GPT, Gemini, Qwen, MAI', async () => {
    const labels = await page.locator('#nav .nav-item .nav-label').allTextContents();
    for (const l of ['Grok', 'GPT', 'Gemini', 'Qwen', 'MAI']) assert.ok(labels.includes(l), labels.join());
    assert.ok(!labels.includes('Kimi'), labels.join());
  });

  await step('bulk change AI to Grok (legacy row keeps old image URL)', async () => {
    db.works.push({ id: 'legacy1', title: 'old', ai: 'Unknown', file: 'images/1.jpg', storage_path: null, sort_order: 5, created_at: '2026-01-01T00:00:00Z', updated_at: 'u1' });
    await page.goto(`${BASE}/collection`);
    await page.waitForSelector('#adminTools:not([hidden])');
    await page.click('[data-act="select"]');
    await page.click('[data-sel="all"]');
    await page.selectOption('#selAi', 'Grok');
    await page.click('[data-sel="setai"]');
    await page.waitForFunction(() => !document.querySelector('[data-sel]'));
    assert.ok(db.works.every(w => w.ai === 'Grok'), db.works.map(w => w.ai).join());
    assert.equal(await page.locator('.nav-item[href="/collection/grok"] .nav-count').textContent(), String(db.works.length).padStart(2, '0'));
    const legacy = await page.locator('img[alt="old"]').getAttribute('src');
    assert.ok(legacy.startsWith('https://kyotomalmal25-sudo.github.io/chimpanzee-museum/images/1.jpg'), legacy);
  });

  await step('bulk select delete', async () => {
    await page.goto(`${BASE}/collection`);
    await page.waitForSelector('#adminTools:not([hidden])');
    await page.click('[data-act="select"]');
    await page.click('[data-sel="all"]');
    await page.click('[data-sel="delete"]');
    await page.waitForSelector('.sample-note');
    assert.equal(db.works.length, 0);
  });

  await step('logout hides admin tools', async () => {
    await page.click('[data-act="logout"]');
    await page.waitForSelector('#adminTools', { state: 'hidden' });
  });

  await step('backend outage shows retry, not samples', async () => {
    db.fail = true;
    await page.goto(`${BASE}/collection`);
    await page.waitForSelector('[data-act-main="retry"]');
    assert.equal(await page.locator('.card').count(), 0);
    db.fail = false;
    await page.click('[data-act-main="retry"]');
    await page.waitForSelector('.grid .card');
  });

  await step('mobile: drawer, no overflow, drawer not focusable when closed', async () => {
    const m = await browser.newPage({ viewport: { width: 375, height: 812 } });
    mockSupabase(m, db);
    await m.goto(`${BASE}/collection`);
    await m.waitForSelector('.grid .card');
    assert.ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.equal(await m.evaluate(() => getComputedStyle(document.getElementById('side')).visibility), 'hidden');
    await m.click('#drawerOpen');
    await m.waitForTimeout(450);
    await m.screenshot({ path: `${SHOTS}/m-drawer.png` });
    await m.click('.nav-item[href="/collection/grok"]');
    await m.waitForFunction(() => location.pathname === '/collection/grok');
    await m.waitForTimeout(400);
    assert.equal(await m.evaluate(() => getComputedStyle(document.getElementById('side')).visibility), 'hidden');
    await m.close();
  });

  await step('404 route', async () => {
    await page.goto(`${BASE}/no/such/page`);
    await page.waitForSelector('text=Lost in the');
  });

  assert.deepEqual(errors, []);
  await browser.close();
  for (const r of results) console.log(r.join('  '));
  console.log(errors.length ? `page errors: ${errors}` : 'no page errors');
  process.exit(results.some(r => r[0] === 'FAIL') ? 1 : 0);
})();

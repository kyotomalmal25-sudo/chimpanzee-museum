import { test, expect } from '@playwright/test';

async function prepareBackend(page, behavior) {
  await page.goto('/');
  await page.evaluate(behavior => {
    window.backendEvents = [];
    window.testRows = [];
    const query = { eq() { return this; }, select() { return this; }, async maybeSingle() {
      backendEvents.push('database');
      return behavior.databaseError ? { status: behavior.ambiguous ? 0 : 400, error: { message: 'database failed' } } :
        behavior.conflict ? { data: null } : { data: { id: 'new', ...testRows[0] } };
    } };
    window.supabase = { createClient: () => ({
      from: () => ({ insert(values) { testRows.push(values); return query; }, update(values) { testRows.push(values); return query; }, delete: () => query }),
      storage: { from: () => ({
        upload: async path => { backendEvents.push('upload:' + path); return behavior.uploadError ? { error: { message: 'upload failed' } } : {}; },
        getPublicUrl: path => ({ data: { publicUrl: 'https://example.test/' + path } }),
        remove: async paths => { backendEvents.push('remove:' + paths[0]); return behavior.cleanupError ? { error: { message: 'cleanup failed' } } : {}; }
      }) }
    }) };
  }, behavior);
  // A distinct URL makes this import use the test client, without replacing app's existing client.
  await page.evaluate(async () => { window.testBackend = await import('/backend.js?test'); });
}

test('image replacement saves before cleaning old image; failed save cleans new image', async ({ page }) => {
  await prepareBackend(page, {});
  await page.evaluate(async () => {
    await testBackend.saveWork({ id: 'old', updated_at: 't', storage_path: 'artworks/old.jpg' }, { title: 'new', ai: 'GPT' }, new File(['image'], 'new.png', { type: 'image/png' }));
  });
  expect(await page.evaluate(() => backendEvents.map(value => value.split(':')[0]))).toEqual(['upload', 'database', 'remove']);
  expect(await page.evaluate(() => backendEvents[2])).toBe('remove:artworks/old.jpg');
  await prepareBackend(page, { databaseError: true });
  const error = await page.evaluate(async () => {
    try { await testBackend.saveWork(null, { title: 'new', ai: 'GPT' }, new File(['image'], 'new.png', { type: 'image/png' })); }
    catch (error) { return error.message; }
  });
  expect(error).toBe('database failed');
  const events = await page.evaluate(() => backendEvents);
  expect(events[2]).toBe(events[0].replace('upload:', 'remove:'));
  await prepareBackend(page, { databaseError: true, ambiguous: true });
  const unknownResult = await page.evaluate(async () => {
    try { await testBackend.saveWork(null, { title: 'new', ai: 'GPT' }, new File(['image'], 'new.png', { type: 'image/png' })); }
    catch (error) { return error.message; }
  });
  expect(unknownResult).toContain('画像ファイルは保持');
  expect(await page.evaluate(() => backendEvents.map(value => value.split(':')[0]))).toEqual(['upload', 'database']);
});

test('stale deletion does not remove image; successful deletion cleans image', async ({ page }) => {
  await prepareBackend(page, { conflict: true });
  const error = await page.evaluate(async () => {
    try { await testBackend.deleteWork({ id: 'old', updated_at: 't', storage_path: 'artworks/old.jpg' }); }
    catch (error) { return error.message; }
  });
  expect(error).toContain('別の画面');
  expect(await page.evaluate(() => backendEvents)).toEqual(['database']);
  await prepareBackend(page, {});
  await page.evaluate(() => testBackend.deleteWork({ id: 'old', updated_at: 't', storage_path: 'artworks/old.jpg' }));
  expect(await page.evaluate(() => backendEvents)).toEqual(['database', 'remove:artworks/old.jpg']);
});

test('invalid and oversized files are rejected before upload', async ({ page }) => {
  await prepareBackend(page, {});
  for (const type of ['text/html', 'large']) {
    const error = await page.evaluate(async type => {
      try { await testBackend.saveWork(null, {}, new File([type === 'large' ? new Uint8Array(10485761) : 'html'], 'file', { type: type === 'large' ? 'image/png' : type })); }
      catch (error) { return error.message; }
    }, type);
    expect(error).toBeTruthy();
  }
  expect(await page.evaluate(() => backendEvents)).toEqual([]);
});

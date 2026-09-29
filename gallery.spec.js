import { test, expect } from '@playwright/test';

test('live archive preserves 43 images, pagination, empty AI filters and image viewer', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#countLabel')).toHaveText('43 IMAGES / PUBLIC ARCHIVE');
  await expect(page.locator('.card')).toHaveCount(9);
  await expect(page.locator('#pageLabel')).toHaveText('1 / 5');
  await page.locator('#nextButton').click();
  await expect(page.locator('#pageLabel')).toHaveText('2 / 5');
  await page.getByRole('button', { name: 'GPT', exact: true }).click();
  await expect(page.locator('.card')).toHaveCount(0);
  await expect(page.locator('#nextButton')).toBeDisabled();
  await page.getByRole('button', { name: '未分類', exact: true }).click();
  await expect(page.locator('.card')).toHaveCount(9);
  await expect(page.locator('#pageLabel')).toHaveText('1 / 5');
  const image = page.locator('.image-button').first();
  await image.click();
  await expect(page.locator('#lightbox')).toBeVisible();
  await expect(page.locator('#lightboxCaption')).toContainText('未分類');
  await page.keyboard.press('Escape');
  await expect(image).toBeFocused();
  await expect(page.locator('.card-actions')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('mobile has no horizontal overflow and loaded images', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.locator('.card')).toHaveCount(9);
  await page.waitForFunction(() => document.querySelector('.card img')?.naturalWidth > 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('backend outage is explicit and never restores deleted manifest entries', async ({ page }) => {
  await page.route('**/rest/v1/museum_works**', route => route.fulfill({ status: 400, body: '{}' }));
  await page.goto('/');
  await expect(page.locator('#retryButton')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(0);
  await expect(page.locator('#gallery')).toContainText('ARCHIVE UNAVAILABLE');
});

test('admin can post, filter, edit AI and title, delete, and sign out (API fixture)', async ({ page }) => {
  await page.route('**/backend.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    let session = null, rows = [{ id: 'existing', title: 'Old work', alt: '', ai: 'Unknown', file: 'images/1.jpg', updated_at: 'original' }];
    const callbacks = [];
    export const client = { auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: fn => callbacks.push(fn),
      signInWithPassword: async () => { session = { user: { id: 'admin' } }; callbacks.forEach(fn => fn('SIGNED_IN', session)); return { data: { session } }; },
      signOut: async () => { session = null; callbacks.forEach(fn => fn('SIGNED_OUT', null)); return {}; }
    } };
    export const isAdmin = async s => Boolean(s);
    export const loadWorks = async () => rows;
    export const saveWork = async (original, values, file) => {
      const work = { ...(original || { id: 'new', file: 'images/2.jpg' }), ...values };
      rows = original ? rows.map(row => row.id === original.id ? work : row) : [work, ...rows];
      return { work, cleanupError: null };
    };
    export const deleteWork = async work => { rows = rows.filter(row => row.id !== work.id); return null; };
  ` }));
  await page.goto('/');
  await page.getByRole('button', { name: '管理', exact: true }).click();
  await page.locator('#emailInput').fill('admin@example.test');
  await page.locator('#passwordInput').fill('test-fixture');
  await page.locator('#loginSubmit').click();
  await expect(page.locator('#newButton')).toBeVisible();
  await page.locator('#newButton').click();
  await page.locator('#titleInput').fill('New artwork');
  await page.locator('#aiInput').selectOption('GPT');
  await page.locator('#fileInput').setInputFiles('images/1.jpg');
  await page.locator('#saveButton').click();
  await expect(page.locator('.card')).toHaveCount(2);
  await page.getByRole('button', { name: 'GPT', exact: true }).click();
  await expect(page.locator('.card')).toHaveCount(1);
  await page.getByRole('button', { name: '編集', exact: true }).click();
  await page.locator('#titleInput').fill('<script>safe title</script>');
  await page.locator('#aiInput').selectOption('Claude');
  await page.locator('#saveButton').click();
  await expect(page.locator('.card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Claude', exact: true }).click();
  await expect(page.locator('.filename')).toHaveText('<script>safe title</script>');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '削除', exact: true }).click();
  await expect(page.locator('.card')).toHaveCount(0);
  await page.getByRole('button', { name: 'ALL', exact: true }).click();
  await expect(page.locator('.card')).toHaveCount(1);
  await page.locator('#logoutButton').click();
  await expect(page.locator('#adminButton')).toBeVisible();
  await expect(page.locator('.card-actions')).toHaveCount(0);
});

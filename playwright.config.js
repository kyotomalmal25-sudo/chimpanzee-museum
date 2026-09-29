import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: '*.spec.js', workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', headless: true,
    launchOptions: { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } },
  webServer: { command: 'node server.mjs', url: 'http://127.0.0.1:4173', reuseExistingServer: true }
});

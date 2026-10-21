import { defineConfig } from '@playwright/test';

// Plays the built game (npm run build first) at phone size in two engines:
// Chrome (Android phones) and WebKit (the engine of every iPhone browser).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 40_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'android-chrome', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'iphone-webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});

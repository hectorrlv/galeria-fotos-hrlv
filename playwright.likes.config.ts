import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

export default defineConfig({
  ...base,
  testMatch: 'photo-likes.spec.ts',
  fullyParallel: false,
  workers: 1,
  webServer: {
    ...base.webServer,
    command: 'FIREBASE_EMULATORS_ENABLED=1 pnpm run start:e2e',
    reuseExistingServer: false,
  },
});

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5180', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'npx vite --port 5180 --strictPort', url: 'http://localhost:5180', reuseExistingServer: true },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})

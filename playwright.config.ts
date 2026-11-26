import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// Pruebas E2E, de aceptación, de accesibilidad y de compatibilidad de serv-admin.
// Requisitos antes de ejecutar:
//   1. API (repo Serv) levantada contra la base de PRUEBAS:   cd ../Serv && npm run dev
//   2. Base sembrada con prisma/seed-ape.js (cuentas *@serv.com).
//   3. npm install && npx playwright install
// La web se levanta sola con "npm run dev" si no está corriendo en BASE_URL.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const CI = !!process.env.CI;

const aceptacion = defineBddConfig({
  outputDir: '.features-gen',
  features: 'e2e/aceptacion/features/*.feature',
  steps: ['e2e/aceptacion/steps/*.ts', 'e2e/support/fixtures.ts'],
  language: 'es',
});

export default defineConfig({
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,          // comparten la base de pruebas: evitar carreras entre flujos
  workers: 1,
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: [['list'], ['html', { outputFolder: 'e2e/reporte', open: 'never' }], ['junit', { outputFile: 'e2e/resultados/junit.xml' }]],
  outputDir: 'e2e/resultados/artefactos',
  use: {
    baseURL: BASE_URL,
    testIdAttribute: 'data-cy',  // la web ya usa data-cy en los elementos clave
    locale: 'es-EC',
    timezoneId: 'America/Guayaquil',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    // Inicia sesión una vez por rol y guarda la sesión en e2e/.auth/<rol>.json
    { name: 'setup', testMatch: /auth\.setup\.ts/, testDir: 'e2e' },

    // 4. E2E funcionales
    { name: 'e2e', testDir: 'e2e/specs', dependencies: ['setup'], use: { ...devices['Desktop Chrome'] } },

    // 5. Aceptación (Gherkin en español con playwright-bdd). Generar antes con: npx bddgen
    { name: 'aceptacion', testDir: aceptacion, dependencies: ['setup'], use: { ...devices['Desktop Chrome'] } },

    // 10. Accesibilidad (axe-core, WCAG 2.1 A/AA)
    { name: 'accesibilidad', testDir: 'e2e/accesibilidad', dependencies: ['setup'], use: { ...devices['Desktop Chrome'] } },

    // 12. Compatibilidad: los mismos specs marcados con @compat en otros navegadores y en móvil
    ...[
      { name: 'compat-firefox', device: devices['Desktop Firefox'] },
      { name: 'compat-webkit', device: devices['Desktop Safari'] },
      { name: 'compat-edge', device: { ...devices['Desktop Edge'], channel: 'msedge' } },
      { name: 'compat-android', device: devices['Pixel 7'] },
      { name: 'compat-iphone', device: devices['iPhone 14'] },
    ].map(({ name, device }) => ({
      name, testDir: 'e2e/specs', grep: /@compat/, dependencies: ['setup'], use: { ...device },
    })),
  ],
});

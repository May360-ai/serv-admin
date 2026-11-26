// Rendimiento del front con Lighthouse CI (rendimiento, accesibilidad, buenas prácticas).
// Medir sobre la versión de PRODUCCIÓN local, no sobre "next dev" (sin optimizar, da números falsos):
//   npm run build
//   npm run test:lighthouse                       -> páginas públicas + cliente
//   set LHCI_ROL=tienda&& npm run test:lighthouse  -> páginas de tienda (Windows cmd)
// La API (repo Serv) debe estar levantada. Resultados en e2e/lighthouse/resultados.
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const ROL = process.env.LHCI_ROL ?? 'cliente';

const paginas = {
  cliente: ['/catalogo', '/mis-pedidos', '/checkout'],
  tienda: ['/tienda/rutas', '/tienda/pedidos', '/tienda/catalogo'],
  admin: ['/admin/metricas', '/pedidos', '/admin/zonas'],
};

module.exports = {
  ci: {
    collect: {
      startServerCommand: process.env.LHCI_SIN_SERVIDOR ? undefined : 'npm run start',
      startServerReadyPattern: 'Ready|started server|Local:',
      url: [`${BASE}/login`, `${BASE}/registro`, ...paginas[ROL].map(p => BASE + p)],
      numberOfRuns: 3, // se usa la mediana
      puppeteerScript: './e2e/lighthouse/iniciar-sesion.cjs',
      puppeteerLaunchOptions: { args: ['--no-sandbox'] },
      settings: {
        preset: 'desktop',
        disableStorageReset: true, // conserva la sesión iniciada por el script
        onlyCategories: ['performance', 'accessibility', 'best-practices'],
        locale: 'es',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'resource-summary:script:size': ['warn', { maxNumericValue: 600000 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './e2e/lighthouse/resultados' },
  },
};

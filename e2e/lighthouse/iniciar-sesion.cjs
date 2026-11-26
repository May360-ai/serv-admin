// Lighthouse CI ejecuta este script con Puppeteer antes de auditar cada URL.
// Inicia sesión una vez con el rol de LHCI_ROL; las páginas públicas se auditan igual.
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const CUENTAS = {
  cliente: process.env.E2E_CLIENTE ?? 'cliente@serv.com',
  tienda: process.env.E2E_TIENDA ?? 'tienda@serv.com',
  admin: process.env.E2E_ADMIN ?? 'admin@serv.com',
};
const CLAVE = process.env.E2E_PASSWORD ?? 'password123';
let listo = false;

module.exports = async (browser, { url }) => {
  if (listo || /\/(login|registro)$/.test(url)) return;
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  await page.type('[data-cy="input-email"]', CUENTAS[process.env.LHCI_ROL ?? 'cliente']);
  await page.type('[data-cy="input-password"]', CLAVE);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('[data-cy="btn-login"]'),
  ]);
  if (page.url().includes('/login')) throw new Error('Lighthouse no pudo iniciar sesión: revisa la API y las credenciales.');
  listo = true;
  await page.close();
};

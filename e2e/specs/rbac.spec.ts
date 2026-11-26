import { test, expect } from '@playwright/test';
import { estadoSesion } from '../support/cuentas';

// Control de acceso por rol en la web (matriz ROLE_REQUIRED_ROUTES de src/middleware.ts).
const prohibidas = {
  cliente: ['/admin/metricas', '/admin/zonas', '/tienda/pedidos', '/tienda/rutas', '/rutas'],
  tienda: ['/admin/metricas', '/admin/repartidores', '/catalogo', '/checkout', '/mis-pedidos'],
  admin: ['/tienda/catalogo', '/tienda/configuracion', '/catalogo', '/checkout'],
} as const;

for (const [rol, rutas] of Object.entries(prohibidas) as [keyof typeof prohibidas, readonly string[]][]) {
  test.describe(`${rol}: rutas no permitidas`, () => {
    test.use({ storageState: estadoSesion(rol) });
    for (const ruta of rutas) {
      test(`${ruta} → /unauthorized`, async ({ page }) => {
        await page.goto(ruta);
        await expect(page).toHaveURL(/\/unauthorized/);
        await expect(page.getByText('Acceso Restringido')).toBeVisible();
      });
    }
  });
}

test.describe('sin sesión', () => {
  for (const ruta of ['/admin/metricas', '/tienda/pedidos', '/catalogo', '/pedidos/1', '/chat']) {
    test(`@compat ${ruta} redirige al login`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test('una cookie de rol falsificada no da acceso', async ({ page, context, baseURL }) => {
    await context.addCookies([
      { name: 'serv_token', value: 'falso', url: baseURL! },
      { name: 'serv_role', value: 'administrador', url: baseURL! },
    ]);
    await page.goto('/admin/metricas');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('redirecciones por rol', () => {
  test.use({ storageState: estadoSesion('cliente') });
  test('el cliente que abre /pedidos va a /mis-pedidos', async ({ page }) => {
    await page.goto('/pedidos');
    await expect(page).toHaveURL(/\/mis-pedidos/);
  });
});

import { test, expect } from '@playwright/test';
import { estadoSesion } from '../support/cuentas';
import { abrirMenu } from '../support/acciones';

test.use({ storageState: estadoSesion('admin') });

const paginas = [
  { ruta: '/admin/metricas', menu: 'Supervisión Global', titulo: 'Dashboard' },
  { ruta: '/pedidos', menu: 'Pedidos Globales', titulo: 'Supervisión de pedidos' },
  { ruta: '/rutas', menu: 'Despacho Global', titulo: 'Despacho' },
  { ruta: '/admin/zonas', menu: 'Zonas de Reparto', titulo: 'Zonas de Entrega' },
  { ruta: '/admin/repartidores', menu: 'Gestión Repartidores', titulo: 'Gestión de repartidores' },
  { ruta: '/admin/tiendas', menu: 'Tiendas', titulo: 'Tiendas' },
  { ruta: '/admin/clientes', menu: 'Clientes', titulo: 'Clientes' },
];

test.describe('Administración', () => {
  for (const { ruta, menu, titulo } of paginas) {
    test(`@compat "${menu}" abre ${ruta} sin errores`, async ({ page }) => {
      const errores: string[] = [];
      page.on('pageerror', e => errores.push(e.message));
      page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 500) errores.push(`${r.status()} ${r.url()}`); });
      await page.goto('/admin/metricas');
      await abrirMenu(page);
      await page.getByRole('link', { name: menu }).click();
      await expect(page).toHaveURL(new RegExp(ruta.replace(/\//g, '\\/')));
      await expect(page.getByRole('heading', { name: titulo, exact: true })).toBeVisible();
      expect(errores, errores.join('\n')).toEqual([]);
    });
  }

  test('zonas: lista las zonas y el formulario nuevo exige nombre y área', async ({ page }) => {
    await page.goto('/admin/zonas');
    await expect(page.getByTestId('card-zona').first()).toBeVisible();
    await page.getByTestId('btn-nueva-zona').click();
    await expect(page.getByRole('heading', { name: 'Nueva zona' })).toBeVisible();
    await page.getByRole('button', { name: 'Crear zona' }).click();
    await expect(page.getByRole('dialog').locator('.text-destructive').first()).toBeVisible();
  });

  test('repartidores: lista los repartidores sembrados', async ({ page }) => {
    await page.goto('/admin/repartidores');
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
    expect(await page.getByRole('heading', { level: 2 }).count()).toBeGreaterThanOrEqual(3);
  });
});

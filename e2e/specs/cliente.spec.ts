import { test, expect } from '@playwright/test';
import { estadoSesion, PUNTO_ENTREGA } from '../support/cuentas';
import { agregarProductoAlCarrito, confirmarPedido, momentoEcuador } from '../support/acciones';

test.use({ storageState: estadoSesion('cliente'), geolocation: PUNTO_ENTREGA, permissions: ['geolocation'] });

test.describe('Cliente', () => {
  test('@compat el catálogo carga productos y la búsqueda filtra', async ({ page }) => {
    await page.goto('/catalogo');
    await expect(page.getByRole('heading', { name: 'Catálogo de Productos' })).toBeVisible();
    const agregar = page.getByRole('button', { name: /Agregar|En carrito/ });
    await expect(agregar.first()).toBeVisible();
    const total = await agregar.count();
    await page.getByPlaceholder('Buscar por producto, regalo, tienda...').fill('zzzz-no-existe');
    await expect(agregar).toHaveCount(0);
    expect(total).toBeGreaterThan(0);
  });

  test('el carrito vacío ofrece volver al catálogo', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('serv_carrito'));
    await page.goto('/checkout');
    await expect(page.getByRole('button', { name: 'Explorar Catálogo' })).toBeVisible();
  });

  test('checkout exige dirección y punto en el mapa', async ({ page, context }) => {
    await context.clearPermissions(); // sin GPS el botón de confirmar queda deshabilitado
    await agregarProductoAlCarrito(page);
    await page.goto('/checkout');
    await expect(page.getByRole('button', { name: /Confirmar y Realizar Pedido/ })).toBeDisabled();
  });

  test('@compat hace un pedido completo y lo ve en Mis pedidos', async ({ page }) => {
    const calle = `QA E2E cliente ${Date.now()}`;
    const { fecha } = momentoEcuador(24 * 60); // mañana, para no interferir con el despacho del día
    await agregarProductoAlCarrito(page);
    await confirmarPedido(page, { calle, fecha, hora: process.env.E2E_HORA ?? '12:00' });
    await expect(page.getByRole('heading', { name: 'Mis Pedidos y Envíos' })).toBeVisible();
    await expect(page.getByText(/Pendiente/i).first()).toBeVisible();
  });

  test('puede cancelar un pedido mientras está pendiente', async ({ page }) => {
    const calle = `QA E2E cancelar ${Date.now()}`;
    await agregarProductoAlCarrito(page);
    await confirmarPedido(page, { calle, fecha: momentoEcuador(24 * 60).fecha, hora: process.env.E2E_HORA ?? '12:00' });
    page.on('dialog', d => { if (d.message().startsWith('¿Cancelar')) void d.accept(); });
    await page.getByRole('button', { name: /Cancelar pedido/ }).first().click();
    await expect(page.getByText(/Cancelado/i).first()).toBeVisible();
  });
});

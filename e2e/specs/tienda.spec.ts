import { test, expect } from '@playwright/test';
import { estadoSesion } from '../support/cuentas';
import { abrirMenu } from '../support/acciones';

test.use({ storageState: estadoSesion('tienda') });

test.describe('Tienda', () => {
  test('@compat el menú muestra solo las opciones de tienda', async ({ page }) => {
    await page.goto('/tienda/rutas');
    await abrirMenu(page);
    for (const opcion of ['Despacho', 'Pedidos', 'Catálogo', 'Configuración', 'Mensajes']) {
      await expect(page.getByRole('link', { name: opcion })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: 'Supervisión Global' })).toHaveCount(0);
  });

  test('la tabla de pedidos filtra por búsqueda y estado', async ({ page }) => {
    await page.goto('/tienda/pedidos');
    await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
    await page.getByTestId('input-busqueda-pedidos').fill('zzzz-no-existe');
    await expect(page.getByTestId('tabla-pedidos').locator('tbody tr')).toHaveCount(0);
  });

  test('crear producto valida los campos obligatorios', async ({ page }) => {
    await page.goto('/tienda/catalogo');
    await page.getByTestId('btn-nuevo-producto').click();
    await page.getByRole('button', { name: 'Guardar Producto' }).click();
    // El formulario no se cierra ni crea nada sin nombre ni categoría.
    await expect(page.getByText('Debes seleccionar una categoría')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar Producto' })).toBeVisible();
  });

  test('crea un producto con peso y dimensiones y aparece en su catálogo', async ({ page }) => {
    const nombre = `QA E2E producto ${Date.now()}`;
    await page.goto('/tienda/catalogo');
    await page.getByTestId('btn-nuevo-producto').click();
    await page.locator('#prod-nombre').fill(nombre);
    await page.locator('#prod-categoria').selectOption({ index: 1 });
    await page.locator('#prod-precio').fill('9.99');
    await page.locator('#prod-stock').fill('5');
    await page.locator('#prod-peso').fill('1.5');
    await page.locator('#prod-largo').fill('30');
    await page.locator('#prod-ancho').fill('20');
    await page.locator('#prod-alto').fill('10');
    await page.getByRole('button', { name: 'Guardar Producto' }).click();
    await expect(page.getByText(nombre)).toBeVisible();
  });

  test('el tablero de despacho permite cambiar de día y armar rutas', async ({ page }) => {
    await page.goto('/tienda/rutas');
    await expect(page.getByRole('heading', { name: 'Despacho' })).toBeVisible();
    const fecha = page.getByTestId('input-fecha-entrega');
    const inicial = await fecha.inputValue();
    await page.getByRole('button', { name: 'Día siguiente' }).click();
    await expect(fecha).not.toHaveValue(inicial);
    await page.getByRole('button', { name: 'Hoy' }).click();
    await expect(page.getByTestId('btn-armar-rutas')).toBeEnabled();
  });

  test('la configuración de la tienda carga y guarda', async ({ page }) => {
    await page.goto('/tienda/configuracion');
    await expect(page.getByRole('heading', { name: 'Configuración de Tienda' })).toBeVisible();
    await page.getByRole('button', { name: 'Guardar Configuración' }).click();
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible();
  });
});

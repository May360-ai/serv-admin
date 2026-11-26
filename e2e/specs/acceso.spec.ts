import { test, expect } from '@playwright/test';
import { CUENTAS, CLAVE } from '../support/cuentas';
import { iniciarSesion, cerrarSesion, abrirMenu } from '../support/acciones';

// Inicio de sesión, registro y cierre de sesión. Las marcadas con @compat se repiten en Firefox,
// WebKit (Safari), Edge y vista móvil en los proyectos compat-*.

test.describe('Inicio de sesión', () => {
  const casos = [
    { rol: 'admin', destino: /\/admin\/metricas/ },
    { rol: 'tienda', destino: /\/tienda\/rutas/ },
    { rol: 'cliente', destino: /\/catalogo/ },
  ] as const;

  for (const { rol, destino } of casos) {
    test(`@compat ${rol} entra y llega a su panel`, async ({ page }) => {
      await iniciarSesion(page, CUENTAS[rol]);
      await expect(page).toHaveURL(destino);
      await abrirMenu(page);
      await expect(page.getByRole('button', { name: 'Cerrar sesión' }).first()).toBeVisible();
    });
  }

  test('@compat credenciales incorrectas muestran error y no entran', async ({ page }) => {
    await iniciarSesion(page, CUENTAS.cliente, 'clave-incorrecta');
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('valida formato de correo y longitud de contraseña antes de llamar a la API', async ({ page }) => {
    let llamadas = 0;
    page.on('request', r => { if (r.url().includes('/api/auth/login')) llamadas++; });
    await iniciarSesion(page, 'no-es-correo', '123');
    await expect(page.getByText('Email inválido')).toBeVisible();
    await expect(page.getByText('Mínimo 6 caracteres')).toBeVisible();
    expect(llamadas).toBe(0);
  });

  test('el repartidor no puede usar la web: se queda en el login con el aviso de la app', async ({ page }) => {
    await iniciarSesion(page, CUENTAS.repartidor);
    await expect(page.getByText('Los repartidores trabajan desde la app Android de SERV')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/); // no quedó ninguna sesión guardada
  });

  test('@compat cerrar sesión borra la sesión y protege las rutas', async ({ page }) => {
    await iniciarSesion(page, CUENTAS.cliente);
    await expect(page).toHaveURL(/\/catalogo/);
    await cerrarSesion(page);
    await page.goto('/mis-pedidos');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Registro', () => {
  test('muestra los errores de validación del formulario', async ({ page }) => {
    await page.goto('/registro');
    await page.getByRole('button', { name: 'Cliente' }).click();
    await page.locator('#nombre').fill('A');
    await page.locator('#email').fill('correo-malo');
    await page.locator('#password').fill('123');
    await page.locator('#confirmar_password').fill('456');
    await page.getByRole('button', { name: 'Registrarse' }).click();
    await expect(page.getByText('Nombre demasiado corto')).toBeVisible();
    await expect(page.getByText('Email inválido')).toBeVisible();
    await expect(page.getByText('Mínimo 6 caracteres')).toBeVisible();
  });

  test('una tienda debe indicar su nombre comercial', async ({ page }) => {
    await page.goto('/registro');
    await page.getByRole('button', { name: 'Tienda' }).click();
    await page.locator('#nombre').fill('QA Tienda');
    await page.locator('#email').fill(`qa.tienda.${Date.now()}@serv.test`);
    await page.locator('#password').fill(CLAVE);
    await page.locator('#confirmar_password').fill(CLAVE);
    await page.getByRole('button', { name: 'Registrarse' }).click();
    await expect(page.getByText('Indica el nombre comercial de tu tienda')).toBeVisible();
  });

  test('@compat un cliente nuevo se registra y entra al catálogo', async ({ page }) => {
    // Crea un usuario con prefijo qa.e2e en la base de pruebas.
    await page.goto('/registro');
    await page.getByRole('button', { name: 'Cliente' }).click();
    await page.locator('#nombre').fill('QA Cliente E2E');
    await page.locator('#email').fill(`qa.e2e.${Date.now()}@serv.test`);
    await page.locator('#password').fill(CLAVE);
    await page.locator('#confirmar_password').fill(CLAVE);
    await page.getByRole('button', { name: 'Registrarse' }).click();
    await expect(page).toHaveURL(/\/catalogo/, { timeout: 30_000 });
  });
});

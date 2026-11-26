import { test as setup, expect } from '@playwright/test';
import { CUENTAS, CLAVE, estadoSesion, type Rol } from './support/cuentas';

// Se inicia sesión por la interfaz una sola vez por rol; el resto de pruebas reutiliza la sesión guardada.
const destinos: Record<Exclude<Rol, 'repartidor'>, RegExp> = {
  admin: /\/admin\/metricas/,
  tienda: /\/tienda\/rutas/,
  cliente: /\/catalogo/,
};

for (const [rol, destino] of Object.entries(destinos) as [Exclude<Rol, 'repartidor'>, RegExp][]) {
  setup(`sesión de ${rol}`, async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('input-email').fill(CUENTAS[rol]);
    await page.getByTestId('input-password').fill(CLAVE);
    await page.getByTestId('btn-login').click();
    await expect(page).toHaveURL(destino, { timeout: 30_000 });
    await page.context().storageState({ path: estadoSesion(rol) });
  });
}

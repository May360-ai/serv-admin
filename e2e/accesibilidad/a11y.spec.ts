import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { estadoSesion, type Rol } from '../support/cuentas';

// Accesibilidad automática con axe-core: WCAG 2.0/2.1 niveles A y AA.
// Falla con infracciones "serious" o "critical"; las "moderate"/"minor" se adjuntan al reporte.
// axe detecta ~30-40 % de los problemas: complementar con revisión manual de teclado y lector de pantalla.
const NIVELES_QUE_FALLAN = ['serious', 'critical'];

async function auditar(page: Page, nombre: string) {
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('.leaflet-container') // el mapa de terceros se revisa a mano
    .analyze();
  await test.info().attach(`axe-${nombre}.json`, { body: JSON.stringify(resultado.violations, null, 2), contentType: 'application/json' });
  const graves = resultado.violations.filter(v => NIVELES_QUE_FALLAN.includes(v.impact ?? ''));
  const detalle = graves.map(v => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} elementos)\n  ${v.helpUrl}`).join('\n');
  expect(graves, `Infracciones graves en ${nombre}:\n${detalle}`).toEqual([]);
}

test.describe('páginas públicas', () => {
  for (const ruta of ['/login', '/registro']) {
    test(`${ruta}`, async ({ page }) => {
      await page.goto(ruta);
      await auditar(page, ruta);
    });
  }

  test('/login en modo oscuro (contraste)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    await auditar(page, 'login-oscuro');
  });

  test('el login se puede completar solo con teclado', async ({ page }) => {
    await page.goto('/login');
    await page.keyboard.press('Tab');
    const enfocados: string[] = [];
    for (let i = 0; i < 6; i++) {
      enfocados.push(await page.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute('data-cy') || document.activeElement?.tagName || ''));
      await page.keyboard.press('Tab');
    }
    expect(enfocados).toContain('email');
    expect(enfocados).toContain('password');
    expect(enfocados).toContain('btn-login');
  });
});

const porRol: Record<Exclude<Rol, 'repartidor'>, string[]> = {
  cliente: ['/catalogo', '/checkout', '/mis-pedidos', '/chat'],
  tienda: ['/tienda/rutas', '/tienda/pedidos', '/tienda/catalogo', '/tienda/configuracion'],
  admin: ['/admin/metricas', '/pedidos', '/admin/zonas', '/admin/repartidores', '/admin/tiendas', '/admin/clientes'],
};

for (const [rol, rutas] of Object.entries(porRol) as [Exclude<Rol, 'repartidor'>, string[]][]) {
  test.describe(`páginas de ${rol}`, () => {
    test.use({ storageState: estadoSesion(rol) });
    for (const ruta of rutas) {
      test(ruta, async ({ page }) => {
        await page.goto(ruta);
        await page.waitForLoadState('networkidle');
        await auditar(page, `${rol}${ruta.replace(/\//g, '-')}`);
      });
    }
  });
}

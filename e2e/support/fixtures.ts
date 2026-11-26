import { test as base } from 'playwright-bdd';
import type { Page } from '@playwright/test';
import { estadoSesion, PUNTO_ENTREGA, type Rol } from './cuentas';

type RolWeb = Exclude<Rol, 'repartidor'>;

/** Estado compartido entre los pasos de un escenario de aceptación. */
export type Escenario = {
  pagina?: Page;                          // pestaña del actor principal del escenario
  paginas: Partial<Record<RolWeb, Page>>; // una pestaña por rol cuando intervienen varios
  calle?: string;                         // marca única del pedido creado en el escenario
};

type Fixtures = {
  /** Devuelve (y reutiliza) una pestaña con la sesión guardada del rol, con GPS simulado en Ambato. */
  comoRol: (rol: RolWeb, opciones?: { sinGps?: boolean }) => Promise<Page>;
  escenario: Escenario;
};

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright exige el patrón vacío en fixtures sin dependencias
  escenario: async ({}, use) => { await use({ paginas: {} }); },

  comoRol: async ({ browser, baseURL, escenario }, use) => {
    const contextos: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await use(async (rol, opciones = {}) => {
      const existente = escenario.paginas[rol];
      if (existente && !opciones.sinGps) return existente;
      const contexto = await browser.newContext({
        baseURL,
        storageState: estadoSesion(rol),
        locale: 'es-EC',
        timezoneId: 'America/Guayaquil',
        ...(opciones.sinGps ? {} : { geolocation: PUNTO_ENTREGA, permissions: ['geolocation'] }),
      });
      contextos.push(contexto);
      const pagina = await contexto.newPage();
      escenario.paginas[rol] = pagina;
      return pagina;
    });
    for (const c of contextos) await c.close();
  },
});

export { expect } from '@playwright/test';

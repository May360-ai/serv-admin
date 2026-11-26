import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../support/fixtures';
import { CUENTAS } from '../../support/cuentas';
import {
  agregarProductoAlCarrito, confirmarPedido, accionSobrePedido, iniciarSesion, momentoEcuador, abrirMenu,
} from '../../support/acciones';

const { Given, When, Then } = createBdd(test);

// "Aceptado" acepta también "Agendado": un pedido futuro aceptado queda agendado.
const estadoVisible = (estado: string) =>
  estado.toLowerCase() === 'aceptado' || estado.toLowerCase() === 'agendado' ? /Aceptado|Agendado/i : new RegExp(estado, 'i');

// ---------- Sesión ----------

Given('que inicié sesión como {string}', async ({ comoRol, escenario }, rol: 'cliente' | 'tienda' | 'admin') => {
  escenario.pagina = await comoRol(rol);
});

Given('que no di permiso de ubicación', async ({ comoRol, escenario }) => {
  escenario.pagina = await comoRol('cliente', { sinGps: true });
});

Given('que estoy en la página de inicio de sesión', async ({ page, escenario }) => {
  escenario.pagina = page;
  await page.goto('/login');
});

When('inicio sesión con la cuenta de repartidor', async ({ escenario }) => {
  await iniciarSesion(escenario.pagina!, CUENTAS.repartidor);
});

Then('sigo en el inicio de sesión con el aviso {string}', async ({ escenario }, aviso: string) => {
  await expect(escenario.pagina!.getByText(aviso)).toBeVisible();
  await expect(escenario.pagina!).toHaveURL(/\/login/);
});

// ---------- Cliente ----------

When('agrego al carrito un producto de la tienda de pruebas', async ({ escenario }) => {
  await agregarProductoAlCarrito(escenario.pagina!);
});

When('abro el carrito', async ({ escenario }) => {
  await escenario.pagina!.goto('/checkout');
});

When('confirmo el pedido para mañana con mi ubicación actual', async ({ escenario }) => {
  escenario.calle = `QA BDD ${Date.now()}`;
  await confirmarPedido(escenario.pagina!, {
    calle: escenario.calle, fecha: momentoEcuador(24 * 60).fecha, hora: process.env.E2E_HORA ?? '12:00',
  });
});

When('cancelo ese pedido', async ({ escenario }) => {
  const pagina = escenario.pagina!;
  pagina.on('dialog', d => { if (d.message().startsWith('¿Cancelar')) void d.accept(); });
  await pagina.getByRole('button', { name: /Cancelar pedido/ }).first().click();
});

Then('veo el pedido en {string} con estado {string}', async ({ escenario }, titulo: string, estado: string) => {
  const pagina = escenario.pagina!;
  await expect(pagina.getByRole('heading', { name: titulo })).toBeVisible();
  await expect(pagina.getByText(estadoVisible(estado)).first()).toBeVisible();
});

Then('el botón {string} está deshabilitado', async ({ escenario }, nombre: string) => {
  await expect(escenario.pagina!.getByRole('button', { name: nombre })).toBeDisabled();
});

// ---------- Tienda ----------

Given('que el cliente hizo un pedido para mañana', async ({ comoRol, escenario }) => {
  const cliente = await comoRol('cliente');
  escenario.calle = `QA BDD tienda ${Date.now()}`;
  await agregarProductoAlCarrito(cliente);
  await confirmarPedido(cliente, { calle: escenario.calle, fecha: momentoEcuador(24 * 60).fecha, hora: process.env.E2E_HORA ?? '12:00' });
});

When('la tienda acepta ese pedido', async ({ comoRol, escenario }) => {
  await accionSobrePedido(await comoRol('tienda'), escenario.calle!, 'Aceptar pedido');
});

When('la tienda rechaza ese pedido', async ({ comoRol, escenario }) => {
  await accionSobrePedido(await comoRol('tienda'), escenario.calle!, 'Rechazar pedido');
});

Then('la tienda ve el pedido con estado {string}', async ({ comoRol, escenario }, estado: string) => {
  const tienda = await comoRol('tienda');
  await expect(tienda.getByTestId('tabla-pedidos').locator('tbody tr').first()).toContainText(estadoVisible(estado));
});

Then('el cliente ve su pedido con estado {string}', async ({ comoRol }, estado: string) => {
  const cliente = await comoRol('cliente');
  await cliente.goto('/mis-pedidos');
  await expect(cliente.getByText(estadoVisible(estado)).first()).toBeVisible();
});

// ---------- Navegación y permisos ----------

When('intento abrir {string}', async ({ escenario }, ruta: string) => {
  await escenario.pagina!.goto(ruta);
});

Then('veo la página {string}', async ({ escenario }, texto: string) => {
  await expect(escenario.pagina!.getByText(texto)).toBeVisible();
});

When('abro {string} en el menú', async ({ escenario }, opcion: string) => {
  const pagina = escenario.pagina!;
  if (!/\/admin|\/pedidos|\/rutas/.test(pagina.url())) await pagina.goto('/dashboard');
  await abrirMenu(pagina);
  await pagina.getByRole('link', { name: opcion }).click();
});

Then('veo el título {string}', async ({ escenario }, titulo: string) => {
  await expect(escenario.pagina!.getByRole('heading', { name: titulo, exact: true })).toBeVisible();
});

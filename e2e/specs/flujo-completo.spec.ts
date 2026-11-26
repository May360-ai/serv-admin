import { test, expect } from '@playwright/test';
import { estadoSesion, PUNTO_ENTREGA } from '../support/cuentas';
import {
  agregarProductoAlCarrito, confirmarPedido, accionSobrePedido, momentoEcuador,
  repartidoresDisponibles, entregarComoRepartidor, idPedidoPorCalle,
} from '../support/acciones';

// Flujo de punta a punta del negocio: cliente pide → tienda acepta → tienda arma la ruta →
// repartidor entrega (simulado por API, como lo hace la app Android) → cliente ve el pedido completado.
// Requisitos de la base de pruebas: la tienda de E2E_TIENDA atiende a la hora elegida, tiene una sucursal
// que cubre la zona de E2E_LAT/E2E_LNG y no hay otros pedidos aceptados para hoy en esa zona.
test.describe.configure({ mode: 'serial' });

test('pedido de punta a punta hasta la entrega', async ({ browser, request, baseURL }) => {
  test.setTimeout(240_000);
  const calle = `QA E2E flujo ${Date.now()}`;
  // Hoy, por defecto 3 h adelante (fuera de la ventana de 120 min del despacho automático) para armar la
  // ruta a mano. E2E_MINUTOS_ADELANTE permite acortarlo cerca del cierre; entonces el despacho automático
  // puede asignar el pedido al aceptarlo y "Armar rutas" no encuentra nada nuevo, lo cual también es válido.
  const { fecha, hora } = momentoEcuador(Number(process.env.E2E_MINUTOS_ADELANTE ?? 180));
  const [apertura, cierre] = [process.env.E2E_APERTURA ?? '09:00', process.env.E2E_CIERRE ?? '20:00'];
  test.skip(hora < apertura || hora > cierre, `La entrega (${hora}) cae fuera del horario de la tienda (${apertura}–${cierre}). Ejecutar más temprano o ajustar E2E_MINUTOS_ADELANTE.`);

  const nuevaPagina = async (rol: 'cliente' | 'tienda') => {
    const ctx = await browser.newContext({ baseURL, storageState: estadoSesion(rol), geolocation: PUNTO_ENTREGA, permissions: ['geolocation'] });
    return ctx.newPage();
  };
  const cliente = await nuevaPagina('cliente');
  const tienda = await nuevaPagina('tienda');
  let pedidoId = '';

  await test.step('cliente realiza el pedido', async () => {
    await agregarProductoAlCarrito(cliente);
    await confirmarPedido(cliente, { calle, fecha, hora: process.env.E2E_HORA ?? hora });
    pedidoId = await idPedidoPorCalle(request, calle);
  });

  await test.step('tienda acepta el pedido', async () => {
    await accionSobrePedido(tienda, calle, 'Aceptar pedido');
    await expect(tienda.getByTestId('tabla-pedidos').locator('tbody tr').first()).toContainText(/Aceptado|Agendado/i);
  });

  await test.step('cliente ve el cambio de estado', async () => {
    await cliente.goto('/mis-pedidos');
    await expect(cliente.getByText(/Aceptado|Agendado/i).first()).toBeVisible();
  });

  await test.step('tienda arma las rutas del día', async () => {
    await repartidoresDisponibles(request);
    await tienda.goto('/tienda/rutas');
    await tienda.getByTestId('input-fecha-entrega').fill(fecha);
    await tienda.getByTestId('btn-armar-rutas').click();
    await expect(tienda.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 30_000 });
    await expect(tienda.getByTestId('pedido-item-ruta').first()).toBeVisible();
    // El paso siguiente confirma por API que este pedido quedó en la ruta de algún repartidor.
  });

  await test.step('repartidor entrega (API, como la app Android)', async () => {
    const repartidor = await entregarComoRepartidor(request, tienda, pedidoId);
    test.info().annotations.push({ type: 'repartidor', description: repartidor });
  });

  await test.step('cliente ve el pedido completado', async () => {
    await cliente.goto(`/pedidos/${pedidoId}`);
    await expect(cliente.getByText(/Completado|Entregado/i).first()).toBeVisible();
  });
});

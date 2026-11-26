import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { API_URL, CLAVE, CUENTAS, NOMBRE_TIENDA, PUNTO_ENTREGA, REPARTIDORES } from './cuentas';

export async function iniciarSesion(page: Page, email: string, clave = CLAVE) {
  await page.goto('/login');
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill(clave);
  await page.getByTestId('btn-login').click();
}

/** En pantallas pequeñas el menú lateral está oculto tras el botón "Abrir menú". */
export async function abrirMenu(page: Page) {
  const boton = page.getByRole('button', { name: 'Abrir menú' });
  await page.waitForLoadState('domcontentloaded');
  if (await boton.isVisible()) await boton.click();
}

export async function cerrarSesion(page: Page) {
  await abrirMenu(page);
  await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();
  await expect(page).toHaveURL(/\/login/);
}

/** Fecha (YYYY-MM-DD) y hora (HH:MM) de Ecuador desplazadas N minutos desde ahora. */
export function momentoEcuador(minutosAdelante = 0) {
  const d = new Date(Date.now() + minutosAdelante * 60_000);
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(d);
  const hora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return { fecha, hora };
}

/** Agrega al carrito el primer producto disponible de la tienda de pruebas. Devuelve su nombre. */
export async function agregarProductoAlCarrito(page: Page, tienda = NOMBRE_TIENDA) {
  // Acepta solo el aviso de "productos de otra tienda"; los demás diálogos los maneja cada prueba.
  page.on('dialog', d => { if (d.message().includes('otra tienda')) void d.accept(); });
  await page.goto('/catalogo');
  await expect(page.getByRole('heading', { name: 'Catálogo de Productos' })).toBeVisible();
  await page.getByPlaceholder('Buscar por producto, regalo, tienda...').fill(tienda);
  const boton = page.getByRole('button', { name: /^Agregar$/ }).and(page.locator(':enabled')).first();
  await expect(boton, `No hay productos con stock de "${tienda}" en el catálogo`).toBeVisible();
  await boton.click();
  await expect(page.getByRole('button', { name: /En carrito \(1\)/ }).first()).toBeVisible();
}

/**
 * Completa el checkout con un punto GPS simulado. La calle lleva una marca única para encontrar
 * el pedido después desde la tienda. Requiere que el contexto tenga permiso de geolocalización.
 */
export async function confirmarPedido(page: Page, { calle, fecha, hora }: { calle: string; fecha: string; hora: string }) {
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Confirmar Pedido' })).toBeVisible();
  await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
  await page.locator('#calle').fill(calle);
  await page.locator('#fecha_entrega').fill(fecha);
  await page.locator('#hora_entrega').fill(hora);
  await page.locator('#metodo-pago').selectOption('efectivo');
  const enviar = page.getByRole('button', { name: /Confirmar y Realizar Pedido/ });
  await expect(enviar, 'El punto GPS no quedó dentro de una zona activa: revisa E2E_LAT y E2E_LNG').toBeEnabled();
  await enviar.click();
  await expect(page).toHaveURL(/\/mis-pedidos/, { timeout: 30_000 });
}

/** La tienda busca el pedido por su calle única y ejecuta una acción del menú (p. ej. "Aceptar pedido"). */
export async function accionSobrePedido(page: Page, calle: string, accion: string) {
  await page.goto('/tienda/pedidos');
  await page.getByTestId('input-busqueda-pedidos').fill(calle);
  const tabla = page.getByTestId('tabla-pedidos');
  await expect(tabla.locator('tbody tr')).toHaveCount(1);
  await tabla.getByTestId('btn-acciones-pedido').click();
  await page.getByRole('button', { name: accion }).click();
}

// ---------- Apoyo por API (pasos que en la vida real hace la app Android) ----------

async function tokenDe(request: APIRequestContext, email: string) {
  const r = await request.post(`${API_URL}/api/auth/login`, { data: { email, password: CLAVE } });
  expect(r.status(), `login API de ${email}`).toBe(200);
  return (await r.json()).token as string;
}

/** Pone a los repartidores de pruebas como disponibles en el centro de Ambato (requisito del armado del día). */
export async function repartidoresDisponibles(request: APIRequestContext) {
  for (const email of REPARTIDORES) {
    const token = await tokenDe(request, email);
    await request.put(`${API_URL}/api/repartidores/disponibilidad`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { disponible: true, latitud: PUNTO_ENTREGA.latitude, longitud: PUNTO_ENTREGA.longitude },
    });
  }
}

/**
 * Simula a la app Android: busca qué repartidor recibió el pedido, inicia la salida, marca en camino,
 * sube la foto y confirma la entrega con GPS en el destino.
 */
export async function entregarComoRepartidor(request: APIRequestContext, page: Page, pedidoId: string) {
  for (const email of REPARTIDORES) {
    const token = await tokenDe(request, email);
    const auth = { Authorization: `Bearer ${token}` };
    const rutas = await (await request.get(`${API_URL}/api/rutas/mis-entregas?incluir_atrasadas=true`, { headers: auth })).json();
    const ruta = (rutas.data ?? []).find((r: { pedidos: { id: unknown }[] }) => r.pedidos.some(p => String(p.id) === pedidoId));
    if (!ruta) continue;
    const parada = ruta.pedidos.find((p: { id: unknown }) => String(p.id) === pedidoId);
    const pendientesAntes = ruta.pedidos.filter((p: { estado: string; orden_en_ruta: number }) =>
      !['completado', 'cancelado', 'fallido'].includes(p.estado) && p.orden_en_ruta < parada.orden_en_ruta);
    expect(pendientesAntes, 'El pedido de prueba no es la primera parada: hay otros pedidos pendientes del día en la ruta').toHaveLength(0);

    if (ruta.estado === 'armando') {
      expect((await request.post(`${API_URL}/api/rutas/${ruta.id}/iniciar`, { headers: auth, data: {} })).status()).toBeLessThan(300);
    }
    const base = `${API_URL}/api/rutas/${ruta.id}/entregas/${pedidoId}`;
    expect((await request.patch(base, { headers: auth, data: { estado: 'en_camino' } })).status()).toBeLessThan(300);

    const foto = await page.screenshot({ clip: { x: 0, y: 0, width: 200, height: 200 } });
    const subida = await request.put(`${API_URL}/api/pedidos/${pedidoId}/foto-entrega`, {
      headers: { ...auth, 'Content-Type': 'image/png' }, data: foto,
    });
    expect(subida.status(), await subida.text()).toBeLessThan(300);

    const destino = parada.direccion;
    const confirmacion = await request.patch(base, {
      headers: auth,
      data: { estado: 'completado', ubicacion: { latitud: Number(destino.latitud), longitud: Number(destino.longitud), precision_m: 10, capturada_en: new Date().toISOString() } },
    });
    expect(confirmacion.status(), await confirmacion.text()).toBeLessThan(300);
    return email;
  }
  throw new Error(`Ningún repartidor de ${REPARTIDORES.join(', ')} tiene asignado el pedido ${pedidoId}`);
}

/** Id del pedido más reciente del cliente con esa calle (consultado por API). */
export async function idPedidoPorCalle(request: APIRequestContext, calle: string) {
  const token = await tokenDe(request, CUENTAS.cliente);
  const pedidos = await (await request.get(`${API_URL}/api/pedidos/mis-pedidos`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const pedido = pedidos.find((p: { direcciones?: { direccion?: string } }) => p.direcciones?.direccion === calle);
  expect(pedido, `No se encontró el pedido con calle "${calle}"`).toBeTruthy();
  return String(pedido.id);
}

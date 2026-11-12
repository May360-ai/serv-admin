import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import type { EstadoPedido } from '@/types';
import type { Usuario } from '@/types';

export const estadoConsulta = z.enum(['pendiente', 'aceptado', 'agendado', 'en_progreso', 'en_camino', 'completado', 'cancelado']);
const id = z.number().int().positive().max(2147483647);
const fecha = z.string().refine(value => Number.isFinite(+new Date(value)));
const importe = z.union([z.string().min(1), z.number()]).refine(value => Number.isFinite(Number(value)));
const pedidoLista = z.object({
  id, cliente_id: id, proveedor_id: id, codigo_seguimiento: z.string().nullable(),
  estados_pedido: z.object({ nombre: estadoConsulta }), fecha_creacion: fecha.nullable(), fecha_programada: fecha.nullable(),
  total: importe, ruta_id: z.string().min(1).nullable(), usuarios: z.object({ nombre: z.string(), apellido: z.string().nullable() }),
  proveedores: z.object({ nombre_comercial: z.string() }),
  direcciones: z.object({ id, direccion: z.string(), ciudad: z.string(), zona_id: id.nullable() }).nullable(),
});
const listado = z.object({ success: z.literal(true), data: z.array(pedidoLista), meta: z.object({
  page: z.number().int().positive(), page_size: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(), total_pages: z.number().int().nonnegative(),
}) });

export interface FiltrosAdministracion {
  page?: number; page_size?: number; estado?: EstadoPedido;
  proveedor_id?: string; zona_id?: string; fecha_desde?: string; fecha_hasta?: string;
}

export async function consultarPedidosAdministracion(filtros: FiltrosAdministracion, signal?: AbortSignal) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filtros)) if (value !== undefined && value !== '') params.set(key, String(value));
  const { data } = await apiClient.get<unknown>(`/api/pedidos?${params}`, { signal });
  const resultado = listado.safeParse(data);
  if (!resultado.success) throw new Error('Respuesta de pedidos administrativos inesperada.');
  const { meta, data: pedidos } = resultado.data;
  const cantidad = Math.max(0, Math.min(meta.page_size, meta.total - (meta.page - 1) * meta.page_size));
  if (meta.page !== (filtros.page ?? 1) || meta.page_size !== (filtros.page_size ?? 20) ||
      meta.total_pages !== Math.ceil(meta.total / meta.page_size) || pedidos.length !== cantidad ||
      new Set(pedidos.map(p => p.id)).size !== pedidos.length) throw new Error('Paginación de pedidos inconsistente.');
  return resultado.data;
}

export function idPedidoValido(value: string): boolean {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= 2147483647;
}

const detalleBase = z.object({
  id, codigo_seguimiento: z.string().nullable(), estados_pedido: z.object({ nombre: estadoConsulta }),
  fecha_creacion: fecha.nullable(), fecha_programada: fecha.nullable(), fecha_entrega_final: fecha.nullable(),
  instrucciones_especiales: z.string().nullable(), orden_en_ruta: z.number().int().positive().nullable(),
  proveedores: z.object({ id, nombre_comercial: z.string() }),
  direcciones: z.object({ id, nombre_ubicacion: z.string(), direccion: z.string(), ciudad: z.string(), referencia: z.string().nullable(),
    zona: z.object({ id, nombre: z.string() }).nullable(),
  }).nullable(),
  ruta: z.object({ id: z.string().min(1), fecha_entrega: z.string(), estado: z.string(), repartidor_id: id }).nullable(),
  detalle_pedido: z.array(z.object({
    id, cantidad: z.number().int().positive(), precio_unitario: importe.optional(), subtotal: importe.optional(),
    items: z.object({ id, nombre: z.string(), es_servicio: z.boolean().nullable() }),
    variaciones_item: z.object({ id, nombre_variacion: z.string() }).nullable(),
  })),
  cliente_id: id.optional(), subtotal: importe.optional(), costo_envio: importe.nullable().optional(),
  impuesto: importe.nullable().optional(), descuento: importe.nullable().optional(), total: importe.optional(),
});

export async function consultarDetallePedido(pedidoId: string, rol: Usuario['rol'], signal?: AbortSignal) {
  if (!idPedidoValido(pedidoId)) throw new Error('Identificador de pedido inválido.');
  const { data } = await apiClient.get<unknown>(`/api/pedidos/${pedidoId}`, { signal });
  const resultado = z.object({ success: z.literal(true), data: detalleBase }).safeParse(data);
  if (!resultado.success || String(resultado.data.data.id) !== pedidoId) throw new Error('Respuesta de detalle de pedido inesperada.');
  const pedido = resultado.data.data;
  if (['cliente', 'administrador'].includes(rol) && pedido.cliente_id === undefined) throw new Error('Respuesta de identidad del pedido incompleta.');
  if (rol !== 'repartidor' && (pedido.total === undefined || pedido.subtotal === undefined || pedido.costo_envio === undefined ||
    pedido.impuesto === undefined || pedido.descuento === undefined || pedido.detalle_pedido.some(linea => linea.precio_unitario === undefined || linea.subtotal === undefined))) {
    throw new Error('Respuesta de importes del pedido incompleta.');
  }
  if (rol === 'repartidor') {
    // Aunque un servidor enviara más campos, no se mantienen importes en la caché de reparto.
    delete pedido.cliente_id; delete pedido.total; delete pedido.subtotal; delete pedido.costo_envio; delete pedido.impuesto; delete pedido.descuento;
    pedido.detalle_pedido.forEach(linea => { delete linea.precio_unitario; delete linea.subtotal; });
  }
  if (rol === 'proveedor') delete pedido.cliente_id;
  return pedido;
}

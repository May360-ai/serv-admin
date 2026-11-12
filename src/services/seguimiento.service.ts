import { z } from 'zod';
import { apiClient } from '@/lib/api-client';

const dinero = z.union([z.number(), z.string()]).refine(value => Number.isFinite(Number(value)));
const fecha = z.string().refine(value => Number.isFinite(+new Date(value)));
const pedidoCliente = z.object({
  id: z.number().int().positive(), cliente_id: z.number().int().positive(), numero_pedido: z.string().optional(),
  total: dinero, subtotal: dinero, costo_envio: dinero.nullable(), fecha_creacion: fecha.nullable(),
  fecha_programada: fecha.nullable().optional(), instrucciones_especiales: z.string().nullable().optional(),
  estados_pedido: z.object({ nombre: z.enum(['pendiente', 'aceptado', 'agendado', 'en_progreso', 'en_camino', 'completado', 'cancelado']) }),
  proveedores: z.object({ nombre_comercial: z.string(), logo_url: z.string().nullable().optional() }).nullish(),
  direcciones: z.object({ direccion: z.string(), ciudad: z.string(), referencia: z.string().nullable().optional() }).nullish(),
  detalle_pedido: z.array(z.object({
    id: z.number(), cantidad: z.number(), precio_unitario: dinero, subtotal: dinero,
    items: z.object({ nombre: z.string(), es_servicio: z.boolean().nullish() }).optional(),
  })).optional(),
});

export async function consultarMisPedidos(clienteId: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<unknown>('/api/pedidos/mis-pedidos', { signal });
  const result = z.array(pedidoCliente).safeParse(data);
  if (!result.success) throw new Error('No se pudieron confirmar los estados: respuesta de pedidos inesperada.');
  if (result.data.some(pedido => String(pedido.cliente_id) !== clienteId)) {
    throw new Error('La respuesta no corresponde a los pedidos de esta sesión.');
  }
  return result.data;
}

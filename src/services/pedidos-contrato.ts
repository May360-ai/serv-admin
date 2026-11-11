import { z } from 'zod';
import type { CrearPedidoRequest } from '@/types';
import type { ItemCatalogo } from './items.service';

export class ContratoPedidosError extends Error {}

export function programarEntrega(fecha: string, hora: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    throw new Error('Indica una fecha y hora de entrega válidas');
  }
  const fechaHora = `${fecha}T${hora}:00-05:00`;
  const date = new Date(fechaHora);
  if (!Number.isFinite(+date) || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(date) !== fecha) {
    throw new Error('La fecha de entrega no existe');
  }
  return date.toISOString();
}

const id = z.number().int().positive();
const direccionSchema = z.object({
  nombre_ubicacion: z.string().trim().min(1, 'Indica un nombre para la dirección').max(50),
  direccion: z.string().trim().min(1, 'Indica la dirección').max(255),
  ciudad: z.string().trim().min(1, 'Indica la ciudad').max(100),
  zona_id: id,
  referencia: z.string().max(255).optional(),
  latitud: z.number().min(-90).max(90).optional(),
  longitud: z.number().min(-180).max(180).optional(),
});

export const nuevoPedidoSchema = z.object({
  proveedor_id: id,
  items_comprados: z.array(z.object({ item_id: id, cantidad: id, variacion_item_id: id.optional() }))
    .min(1, 'Selecciona al menos un producto'),
  fecha_entrega: z.string().min(1, 'Indica la fecha'),
  hora_entrega: z.string().min(1, 'Indica la hora'),
  direccion: direccionSchema,
  instrucciones_especiales: z.string().optional(),
}).superRefine((value, ctx) => {
  try { programarEntrega(value.fecha_entrega, value.hora_entrega); }
  catch (error) { ctx.addIssue({ code: 'custom', path: ['fecha_entrega'], message: (error as Error).message }); }
});

export function validarPedido(datos: CrearPedidoRequest, catalogo: ItemCatalogo[]) {
  const result = nuevoPedidoSchema.safeParse(datos);
  if (!result.success) throw new Error(result.error.issues[0].message);
  const pedido = result.data;
  for (const linea of pedido.items_comprados) {
    const item = catalogo.find(i => i.id === linea.item_id);
    if (!item?.activo || item.proveedor_id !== pedido.proveedor_id) throw new Error('Selecciona productos activos de la tienda elegida');
    if (linea.variacion_item_id && !item.variaciones_item?.some(v => v.id === linea.variacion_item_id)) throw new Error('Variación no válida');
    if (!item.es_servicio && item.inventario_stock != null && linea.cantidad > item.inventario_stock) throw new Error(`Stock insuficiente para ${item.nombre}`);
  }
  return { pedido, fecha_programada: programarEntrega(pedido.fecha_entrega, pedido.hora_entrega) };
}

import { apiClient } from '@/lib/api-client';
import { z } from 'zod';
import type { RepartidorActivo, AsignacionRepartidor } from './elegibilidad';
import type {
  Ruta,
  ArmarRutasRequest,
  ArmarRutasResponse,
  AgregarPedidoARutaRequest,
  TransferirPedidoRequest,
  FiltrosRutas,
} from '@/types';

const idSchema = z.union([z.number().int().positive(), z.string().min(1)]).transform(String);
const activosSchema = z.object({ data: z.array(z.object({
  id: idSchema, nombre: z.string().min(1), apellido: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  estado: z.literal('activo').optional(),
})) });
const asignacionesSchema = z.object({ data: z.array(z.object({
  id: z.string().min(1), fecha_entrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  repartidor_id: idSchema,
})) });

export const rutasService = {
  /** Activos no implica disponibles: este endpoint no informa ocupación por fecha. */
  async listarRepartidoresActivos(): Promise<RepartidorActivo[]> {
    const { data } = await apiClient.get<unknown>('/api/rutas/repartidores');
    const result = activosSchema.safeParse(data);
    if (!result.success) throw new Error('Respuesta de repartidores inesperada');
    return result.data.data;
  },

  /** Solo el administrador tiene alcance global; no filtrar por zona ni estado. */
  async listarAsignaciones(fecha: string): Promise<AsignacionRepartidor[]> {
    const params = new URLSearchParams({ fecha_entrega: fecha });
    const { data } = await apiClient.get<unknown>(`/api/rutas?${params}`);
    const result = asignacionesSchema.safeParse(data);
    if (!result.success) throw new Error('Respuesta de asignaciones inesperada');
    return result.data.data;
  },
  /**
   * Lista las rutas de un día y zona específicos.
   */
  async listarRutas(filtros: FiltrosRutas): Promise<Ruta[]> {
    const params = new URLSearchParams({ fecha_entrega: filtros.fecha_entrega });
    if (filtros.zona_id) params.set('zona_id', filtros.zona_id);

    const { data } = await apiClient.get<unknown>(
      `/api/rutas?${params.toString()}`
    );
    const lista = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data || [];
    return lista as Ruta[];
  },

  /**
   * Dispara el armado automático de rutas (máx. 4 pedidos por repartidor).
   */
  async armarRutas(body: ArmarRutasRequest): Promise<ArmarRutasResponse> {
    const { data } = await apiClient.post<unknown>(
      '/api/rutas/armar',
      body
    );
    const res = (data as { data?: ArmarRutasResponse })?.data ?? (data as ArmarRutasResponse);
    return res;
  },

  /**
   * Agrega un pedido libre a una ruta existente.
   */
  async agregarPedidoARuta(body: AgregarPedidoARutaRequest): Promise<Ruta> {
    const { data } = await apiClient.post<unknown>(
      '/api/rutas/asignar-pedido',
      body
    );
    const res = (data as { data?: Ruta })?.data ?? (data as Ruta);
    return res;
  },

  /**
   * Transfiere un pedido entre rutas.
   */
  async transferirPedido(body: TransferirPedidoRequest): Promise<void> {
    await apiClient.post('/api/rutas/transferir-pedido', body);
    return;
  },

  /**
   * Remueve un pedido de una ruta.
   */
  async removerPedidoDeRuta(
    ruta_id: string,
    pedido_id: string
  ): Promise<void> {
    await apiClient.delete(`/api/rutas/${ruta_id}/pedidos/${pedido_id}`);
    return;
  },

  /**
   * Reordena los pedidos dentro de una ruta.
   */
  async reordenarPedidos(
    ruta_id: string,
    orden: string[]
  ): Promise<Ruta> {
    const { data } = await apiClient.patch<unknown>(
      `/api/rutas/${ruta_id}/reordenar`,
      { orden }
    );
    const res = (data as { data?: Ruta })?.data ?? (data as Ruta);
    return res;
  },

  /**
   * Reasigna un repartidor a una ruta.
   */
  async reasignarRepartidor(
    ruta_id: string,
    repartidor_id: string
  ): Promise<Ruta> {
    const { data } = await apiClient.patch<unknown>(
      `/api/rutas/${ruta_id}/repartidor`,
      { repartidor_id }
    );
    const res = (data as { data?: Ruta })?.data ?? (data as Ruta);
    return res;
  },
};

import { apiClient } from '@/lib/api-client';
import type {
  Ruta,
  ArmarRutasRequest,
  ArmarRutasResponse,
  AgregarPedidoARutaRequest,
  TransferirPedidoRequest,
  FiltrosRutas,
} from '@/types';

export const rutasService = {
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

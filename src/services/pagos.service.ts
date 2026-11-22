import { apiClient } from '@/lib/api-client';
import type { Pago } from '@/types';

// Sin pasarela de tarjetas: los métodos no presenciales quedan pendientes hasta que la tienda confirma el cobro.
export type MetodoPago = 'efectivo' | 'transferencia_bancaria' | 'billetera_movil';

export const pagosService = {
  /**
   * Registra el método de pago de un pedido recién creado (cliente).
   */
  async registrarPago(body: { pedido_id: number; metodo_pago: MetodoPago; transaccion_externa_id?: string }): Promise<Pago> {
    const { data } = await apiClient.post<unknown>('/api/pagos', body);
    const obj = (data as { data?: unknown; pago?: unknown })?.data ?? (data as { pago?: unknown })?.pago ?? data;
    return obj as Pago;
  },

  /**
   * Confirma el pago de un pedido recibido (mostrador o contraentrega).
   */
  async confirmarPago(pedidoId: string): Promise<Pago> {
    const { data } = await apiClient.patch<unknown>(
      `/api/pagos/${pedidoId}/confirmar`
    );
    const obj = (data as { data?: unknown; pago?: unknown })?.data ?? (data as { pago?: unknown })?.pago ?? data;
    return obj as Pago;
  },
};

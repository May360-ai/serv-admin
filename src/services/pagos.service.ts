import { apiClient } from '@/lib/api-client';
import type { Pago } from '@/types';

export const pagosService = {
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

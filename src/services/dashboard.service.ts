import { apiClient } from '@/lib/api-client';
import type { MetricasDashboard } from '@/types';

export const dashboardService = {
  async obtenerMetricas(): Promise<MetricasDashboard> {
    try {
      const { data } = await apiClient.get<unknown>('/api/dashboard/metricas');
      const obj = (data as { data?: MetricasDashboard })?.data ?? (data as MetricasDashboard);
      if (obj && typeof obj.pedidos_hoy === 'number') {
        return obj;
      }
    } catch {
      // Si el endpoint no está disponible en el backend original, devolvemos métricas base
    }

    return {
      pedidos_hoy: 0,
      pedidos_pendientes: 0,
      pedidos_en_camino: 0,
      pedidos_completados: 0,
      rutas_activas: 0,
      repartidores_disponibles: 3,
      ingresos_hoy: 0,
    };
  },
};

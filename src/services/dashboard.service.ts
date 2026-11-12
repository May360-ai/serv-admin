import { apiClient } from '@/lib/api-client';
import type { MetricasDashboard } from '@/types';

export const dashboardService = {
  async obtenerMetricas(): Promise<MetricasDashboard> {
    const { data } = await apiClient.get<unknown>('/api/dashboard/metricas');
    const obj = (data as { data?: MetricasDashboard })?.data ?? data;
    const campos = ['pedidos_hoy', 'pedidos_pendientes', 'pedidos_en_camino', 'pedidos_completados',
      'rutas_activas', 'repartidores_disponibles', 'ingresos_hoy'] as const;
    if (!obj || typeof obj !== 'object' || campos.some(campo =>
      !(campo in obj) || !Number.isFinite((obj as MetricasDashboard)[campo]))) {
      throw new Error('Respuesta de métricas inesperada.');
    }
    return obj as MetricasDashboard;
  },
};

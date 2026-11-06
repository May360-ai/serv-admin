import { apiClient } from '@/lib/api-client';
import type { Zona, Categoria, DireccionEntrega } from '@/types';

export const zonasService = {
  async listarZonas(): Promise<Zona[]> {
    const { data } = await apiClient.get<{ data: Zona[] }>('/api/zonas');
    return data.data;
  },

  async listarCategorias(): Promise<Categoria[]> {
    const { data } = await apiClient.get<unknown>('/api/datos/categorias');
    const lista = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data || [];
    return lista as Categoria[];
  },

  async registrarDireccion(
    direccion: Omit<DireccionEntrega, 'id' | 'zona'>
  ): Promise<DireccionEntrega> {
    const { data } = await apiClient.post<unknown>(
      '/api/datos/direcciones',
      direccion
    );
    const obj = (data as { data?: unknown }).data ?? data;
    return obj as DireccionEntrega;
  },
};

import { apiClient } from '@/lib/api-client';
import type { Zona, Categoria, DireccionEntrega } from '@/types';

export const zonasService = {
  async listarZonas(): Promise<Zona[]> {
    try {
      const { data } = await apiClient.get<unknown>('/api/zonas');
      const lista = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data || [];
      return lista as Zona[];
    } catch {
      // Fallback predeterminado de zonas
      return [
        { id: '1', nombre: 'Zona Norte', descripcion: 'Palermo, Belgrano', color: '#3B82F6', capacidad_maxima: 4, activa: true, created_at: new Date().toISOString() },
        { id: '2', nombre: 'Zona Centro', descripcion: 'Centro, San Nicolás', color: '#10B981', capacidad_maxima: 4, activa: true, created_at: new Date().toISOString() },
        { id: '3', nombre: 'Zona Sur', descripcion: 'San Telmo, Barracas', color: '#F59E0B', capacidad_maxima: 4, activa: true, created_at: new Date().toISOString() },
      ];
    }
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

import { apiClient } from '@/lib/api-client';
import type { Tienda, HorarioTienda } from '@/types';

export const proveedoresService = {
  /**
   * Obtiene los datos de un proveedor/tienda por ID.
   */
  async obtenerProveedor(id: string): Promise<Tienda> {
    const { data } = await apiClient.get<unknown>(`/api/proveedores/${id}`);
    const obj = (data as { data?: unknown; tienda?: unknown })?.data ?? (data as { tienda?: unknown })?.tienda ?? data;
    return obj as Tienda;
  },

  /**
   * Obtiene la tienda vinculada al usuario autenticado.
   * Si proveedor_id no está disponible, busca por usuario_id en el listado.
   */
  async obtenerMiTienda(proveedor_id?: string | number | null, usuario_id?: string): Promise<Tienda | null> {
    try {
      if (proveedor_id) {
        const { data } = await apiClient.get<unknown>(`/api/proveedores/${proveedor_id}`);
        const obj = (data as { data?: unknown; tienda?: unknown })?.data ?? (data as { tienda?: unknown })?.tienda ?? data;
        if (obj) return obj as Tienda;
      }

      const { data } = await apiClient.get<unknown>('/api/proveedores');
      const lista = Array.isArray(data) ? data : ((data as { data?: unknown[] })?.data || []);
      if (usuario_id) {
        const encontrada = (lista as Array<{ usuario_id?: number }>).find(p => String(p.usuario_id) === String(usuario_id));
        if (encontrada) return encontrada as Tienda;
      }
      return (lista[0] as Tienda) || null;
    } catch {
      return null;
    }
  },

  /**
   * Actualiza el perfil de la tienda autenticada.
   */
  async actualizarMiTienda(tienda: Partial<Tienda>): Promise<Tienda> {
    const { data } = await apiClient.put<unknown>('/api/proveedores/mi-tienda', tienda);
    const obj = (data as { data?: unknown; tienda?: unknown })?.data ?? (data as { tienda?: unknown })?.tienda ?? data;
    return obj as Tienda;
  },

  /**
   * Configura los horarios de atención y despacho de la tienda.
   */
  async configurarHorarios(horarios: HorarioTienda[]): Promise<HorarioTienda[]> {
    // Adaptar nombres de campos esperados por el backend (hora_apertura, hora_cierre)
    const payload = horarios.map(h => ({
      dia_semana: h.dia_semana,
      hora_apertura: h.apertura || '09:00',
      hora_cierre: h.cierre || '20:00',
      esta_abierto: h.activo !== false,
    }));

    const { data } = await apiClient.post<unknown>(
      '/api/proveedores/mi-tienda/horarios',
      { horarios: payload }
    );
    const obj = (data as { data?: unknown; horarios?: unknown })?.data ?? (data as { horarios?: unknown })?.horarios ?? data;
    return (Array.isArray(obj) ? obj : []) as HorarioTienda[];
  },
};

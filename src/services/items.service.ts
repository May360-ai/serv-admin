import { apiClient } from '@/lib/api-client';

export interface ItemCatalogo {
  id: number;
  proveedor_id: number;
  categoria_id: number;
  nombre: string;
  descripcion: string | null;
  precio: string | number;
  imagen_url: string | null;
  es_servicio: boolean;
  duracion_estimada_minutos: number | null;
  requiere_agendamiento: boolean;
  inventario_stock: number | null;
  activo: boolean;
  proveedores?: {
    nombre_comercial: string;
    rating_promedio: number | string | null;
    logo_url: string | null;
  };
  variaciones_item?: Array<{
    id: number;
    nombre_variacion: string;
    precio_adicional: number | string;
  }>;
}

export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  imagen_url?: string | null;
}

export const itemsService = {
  /**
   * Obtiene todos los productos y servicios disponibles en la plataforma.
   */
  async listarCatalogo(filtros?: {
    categoria_id?: number;
    proveedor_id?: number;
    es_servicio?: boolean;
  }): Promise<ItemCatalogo[]> {
    const params = new URLSearchParams();
    if (filtros?.categoria_id) params.set('categoria_id', String(filtros.categoria_id));
    if (filtros?.proveedor_id) params.set('proveedor_id', String(filtros.proveedor_id));
    if (filtros?.es_servicio !== undefined) params.set('es_servicio', String(filtros.es_servicio));

    const { data } = await apiClient.get<ItemCatalogo[] | { data: ItemCatalogo[] }>(
      `/api/items?${params.toString()}`
    );

    if (!Array.isArray(data) || data.some(item => !item || !Number.isInteger(item.id) ||
      !Number.isInteger(item.proveedor_id) || typeof item.nombre !== 'string' || typeof item.activo !== 'boolean')) {
      throw new Error('Respuesta de catálogo inesperada');
    }
    return data;
  },

  /**
   * Obtiene las categorías de productos/servicios.
   */
  async listarCategorias(): Promise<Categoria[]> {
    try {
      const { data } = await apiClient.get<Categoria[] | { data: Categoria[] }>('/api/datos/categorias');
      if (Array.isArray(data)) return data;
      return (data as { data: Categoria[] })?.data ?? [];
    } catch {
      return [];
    }
  },
};

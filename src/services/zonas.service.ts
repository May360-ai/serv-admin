import { apiClient } from '@/lib/api-client';
import type { Zona, Categoria, DireccionEntrega } from '@/types';
import { z } from 'zod';
import { itemsService } from './items.service';

const zonasSchema = z.object({ success: z.literal(true), data: z.array(z.object({
  id: z.string().min(1), nombre: z.string(), color: z.string(), capacidad_maxima: z.number().int().positive(),
  activa: z.boolean(), descripcion: z.string().nullable().optional(), created_at: z.string().optional(),
  pedidos_count: z.number().optional(),
})) });

export const zonasService = {
  async listarZonas(): Promise<Zona[]> {
    const { data } = await apiClient.get<unknown>('/api/zonas');
    const resultado = zonasSchema.safeParse(data);
    if (!resultado.success) throw new Error('Respuesta de zonas inesperada.');
    return resultado.data.data.map(zona => ({ ...zona, descripcion: zona.descripcion ?? undefined, created_at: zona.created_at ?? '' }));
  },

  async listarCategorias(): Promise<Categoria[]> {
    return (await itemsService.listarCategorias()).map(categoria => ({
      id: String(categoria.id), nombre: categoria.nombre, descripcion: categoria.descripcion ?? undefined,
    }));
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

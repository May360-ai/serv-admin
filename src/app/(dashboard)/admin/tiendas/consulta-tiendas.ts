import { z } from 'zod';
import { apiClient } from '@/lib/api-client';

// Campos utilizados por esta pantalla; el endpoint devuelve un arreglo directo.
const tiendasSchema = z.array(z.object({
  id: z.union([z.number().int().positive(), z.string().min(1)]),
  nombre_comercial: z.string().min(1),
  email: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  activa: z.boolean().optional(),
}));

export class RespuestaTiendasInvalida extends Error {
  constructor() {
    super('La API devolvió una respuesta de tiendas con formato inesperado.');
    this.name = 'RespuestaTiendasInvalida';
  }
}

export async function consultarTiendas() {
  const { data } = await apiClient.get<unknown>('/api/proveedores');
  const resultado = tiendasSchema.safeParse(data);
  if (!resultado.success) throw new RespuestaTiendasInvalida();
  return resultado.data;
}

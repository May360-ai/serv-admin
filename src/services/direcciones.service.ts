import { z } from 'zod';
import { apiClient } from '@/lib/api-client';

const direccionSchema = z.object({
  id: z.number().int().positive(), nombre_ubicacion: z.string(), direccion: z.string(), referencia: z.string().nullable(),
  ciudad: z.string(), latitud: z.number(), longitud: z.number(),
  zona: z.object({ id: z.string(), nombre: z.string() }).nullable(),
});
export type DireccionGuardada = z.infer<typeof direccionSchema>;

export const direccionesService = {
  /** Direcciones del cliente que siguen dentro de una zona activa. */
  async listarMias(): Promise<DireccionGuardada[]> {
    const { data } = await apiClient.get<unknown>('/api/datos/direcciones');
    const resultado = z.object({ data: z.array(direccionSchema) }).safeParse(data);
    if (!resultado.success) throw new Error('Respuesta de direcciones inesperada.');
    return resultado.data.data;
  },
};

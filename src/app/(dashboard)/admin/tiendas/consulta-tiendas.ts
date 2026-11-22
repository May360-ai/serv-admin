import { z } from 'zod';
import { apiClient } from '@/lib/api-client';

// Listado administrativo: incluye tiendas pendientes de aprobación y suspendidas.
const tiendasSchema = z.object({ data: z.array(z.object({
  id: z.union([z.number().int().positive(), z.string().min(1)]).transform(String),
  nombre_comercial: z.string().min(1),
  descripcion: z.string().nullable().optional(),
  es_verificado: z.boolean().nullable().transform(v => Boolean(v)),
  estado: z.string(),
  fecha_registro: z.string().nullable().optional(),
  propietario: z.object({
    nombre: z.string(), apellido: z.string().nullable().optional(), email: z.string(), telefono: z.string().nullable().optional(),
  }).nullable().optional(),
  sucursales_activas: z.number().int().nonnegative(),
  productos: z.number().int().nonnegative(),
  pedidos: z.number().int().nonnegative(),
  visible_en_catalogo: z.boolean(),
})) });

export type TiendaAdmin = z.infer<typeof tiendasSchema>['data'][number];

export class RespuestaTiendasInvalida extends Error {
  constructor() {
    super('La API devolvió una respuesta de tiendas con formato inesperado.');
    this.name = 'RespuestaTiendasInvalida';
  }
}

export async function consultarTiendas(): Promise<TiendaAdmin[]> {
  const { data } = await apiClient.get<unknown>('/api/proveedores/admin/todas');
  const resultado = tiendasSchema.safeParse(data);
  if (!resultado.success) throw new RespuestaTiendasInvalida();
  return resultado.data.data;
}

export async function aprobarTienda(id: string, es_verificado: boolean) {
  await apiClient.patch(`/api/proveedores/${id}/aprobacion`, { es_verificado });
}

export async function cambiarEstadoTienda(id: string, estado: 'activo' | 'inactivo') {
  await apiClient.patch(`/api/proveedores/${id}/estado`, { estado });
}

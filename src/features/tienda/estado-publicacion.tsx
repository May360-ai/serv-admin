'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

const tiendaSchema = z.object({ es_verificado: z.boolean().nullable().optional() });
const sucursalesSchema = z.object({ data: z.array(z.object({ activa: z.boolean() })) });

/** Explica por qué la tienda todavía no aparece en el catálogo de clientes. */
export function EstadoPublicacionTienda() {
  const usuario = useAuthStore(s => s.usuario);
  const proveedorId = usuario?.rol === 'proveedor' ? usuario.proveedor_id : undefined;
  const tienda = useQuery({
    queryKey: ['mi-tienda-publicacion', proveedorId],
    enabled: Boolean(proveedorId),
    queryFn: async () => tiendaSchema.parse((await apiClient.get<unknown>(`/api/proveedores/${proveedorId}`)).data),
    staleTime: 60_000,
  });
  const sucursales = useQuery({
    queryKey: ['sucursales'],
    enabled: Boolean(proveedorId),
    queryFn: async () => sucursalesSchema.parse((await apiClient.get<unknown>('/api/sucursales')).data).data,
  });
  if (!proveedorId || !tienda.data || !sucursales.data) return null;
  const pendientes: string[] = [];
  if (!tienda.data.es_verificado) pendientes.push('administración debe aprobar tu tienda');
  if (!sucursales.data.some(s => s.activa)) pendientes.push('registra al menos una sucursal activa con sus zonas de cobertura');
  if (!pendientes.length) return null;
  return (
    <div role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <p className="font-semibold">Tu tienda aún no aparece en el catálogo de clientes.</p>
      <p>Falta que {pendientes.join(' y ')}.{' '}
        {!sucursales.data.some(s => s.activa) && <Link className="underline" href="/tienda/configuracion">Ir a configuración</Link>}
      </p>
    </div>
  );
}

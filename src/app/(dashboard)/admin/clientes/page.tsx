'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { esAdministrador } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Paginacion, usePaginacion } from '@/components/ui/paginacion';

const clientesSchema = z.object({ data: z.array(z.object({
  id: z.string(), nombre: z.string(), apellido: z.string().nullable(), email: z.string(),
  telefono: z.string().nullable(), estado: z.enum(['activo', 'inactivo']), fecha_registro: z.string().nullable(),
  pedidos: z.number().int().nonnegative(),
})) });

export default function AdminClientesPage() {
  const usuario = useAuthStore(s => s.usuario);
  const permitido = esAdministrador(usuario?.rol);
  const client = useQueryClient();
  const [borrador, setBorrador] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const consulta = useQuery({
    queryKey: ['admin-clientes', busqueda],
    enabled: permitido,
    queryFn: async ({ signal }) => clientesSchema.parse((await apiClient.get<unknown>('/api/clientes', {
      params: busqueda ? { busqueda } : {}, signal })).data).data,
  });
  const paginado = usePaginacion(consulta.data ?? [], busqueda, 20);
  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'activo' | 'inactivo' }) => {
      await apiClient.patch(`/api/clientes/${id}/estado`, { estado });
    },
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin-clientes'] }); },
  });

  if (!permitido) return <p role="alert">Esta gestión requiere una cuenta de administración.</p>;
  return <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-bold">Clientes</h1>
      <p className="text-sm text-muted-foreground">Consulta cuentas de cliente y suspende el acceso cuando sea necesario. Una cuenta suspendida no puede iniciar sesión ni crear pedidos.</p>
    </div>
    <form className="flex max-w-lg gap-2" onSubmit={e => { e.preventDefault(); setBusqueda(borrador.trim()); }}>
      <Input aria-label="Buscar cliente" placeholder="Nombre, apellido o correo" value={borrador} onChange={e => setBorrador(e.target.value)} />
      <Button type="submit" variant="outline">Buscar</Button>
    </form>
    {consulta.isLoading && <p role="status">Consultando clientes…</p>}
    {consulta.isError && <p role="alert">No se pudieron cargar los clientes. <Button variant="outline" onClick={() => consulta.refetch()}>Reintentar</Button></p>}
    {cambiarEstado.isError && <p role="alert">{cambiarEstado.error.message}</p>}
    {consulta.isSuccess && consulta.data.length === 0 && <p>No hay clientes que coincidan.</p>}
    {consulta.isSuccess && consulta.data.length === 200 && <p className="text-sm text-muted-foreground">Se muestran los 200 registros más recientes; refina la búsqueda para encontrar otros.</p>}
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left"><tr>
          <th className="p-3">Cliente</th><th className="p-3">Contacto</th><th className="p-3">Pedidos</th><th className="p-3">Estado</th><th className="p-3"><span className="sr-only">Acciones</span></th>
        </tr></thead>
        <tbody>{paginado.datos.map(c => <tr key={c.id} className="border-t">
          <td className="p-3 font-medium">{c.nombre} {c.apellido}</td>
          <td className="p-3 break-all">{c.email}{c.telefono ? ` · ${c.telefono}` : ''}</td>
          <td className="p-3">{c.pedidos}</td>
          <td className="p-3">{c.estado === 'activo' ? 'Activa' : 'Suspendida'}</td>
          <td className="p-3 text-right"><Button size="sm" variant="outline" disabled={cambiarEstado.isPending}
            onClick={() => cambiarEstado.mutate({ id: c.id, estado: c.estado === 'activo' ? 'inactivo' : 'activo' })}>
            {c.estado === 'activo' ? 'Suspender' : 'Reactivar'}</Button></td>
        </tr>)}</tbody>
      </table>
    </div>
    <Paginacion {...paginado} />
  </div>;
}

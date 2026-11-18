'use client';

import { Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { getFechaHoy } from '@/features/despacho/despacho.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorHttp } from '@/lib/error-http';
import { Paginacion, usePaginacion } from '@/components/ui/paginacion';

const repartidoresSchema = z.object({ data: z.array(z.object({
  id: z.number().int(), nombre: z.string(), apellido: z.string().nullable(),
  email: z.string(), telefono: z.string().nullable(), vehiculo: z.string().nullable(),
  estado: z.enum(['activo', 'inactivo']),
  rutas: z.array(z.object({ id: z.string(), estado: z.string() })),
})) });

export default function AdminRepartidoresPage() {
  return <Suspense fallback={<p role="status">Cargando gestión de repartidores…</p>}><GestionRepartidores /></Suspense>;
}

function GestionRepartidores() {
  const usuario = useAuthStore(state => state.usuario);
  const client = useQueryClient();
  const [fecha, setFecha] = useState(getFechaHoy);
  const [formulario, setFormulario] = useState(false);
  const permitido = usuario?.rol === 'administrador' || usuario?.rol === 'admin';
  const consulta = useQuery({
    queryKey: ['flota', usuario?.id, fecha],
    enabled: permitido && Boolean(fecha),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<unknown>('/api/repartidores', { params: { fecha }, signal });
      return repartidoresSchema.parse(data).data;
    },
  });
  const paginado = usePaginacion(consulta.data ?? [], `${usuario?.id}:${fecha}`, 12);
  const actualizar = () => {
    for (const key of ['flota', 'repartidores-despacho', 'repartidores-reprogramacion']) {
      void client.invalidateQueries({ queryKey: [key] });
    }
  };
  const crear = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      await apiClient.post('/api/repartidores', Object.fromEntries(new FormData(form)));
    },
    onSuccess: () => { setFormulario(false); actualizar(); },
  });
  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: number; estado: string }) => {
      await apiClient.patch(`/api/repartidores/${id}/estado`, { estado });
    },
    onSuccess: actualizar,
  });

  if (!permitido) return <p role="alert">Esta gestión requiere una cuenta de administración.</p>;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Gestión de repartidores</h1>
      <Button onClick={() => { crear.reset(); setFormulario(true); }}>Nuevo repartidor</Button>
    </div>
    {formulario && <form className="space-y-4 rounded-lg border bg-card p-4" onSubmit={event => {
      event.preventDefault();
      crear.mutate(event.currentTarget);
    }}>
      <h2 className="text-lg font-semibold">Registrar repartidor</h2>
      <fieldset disabled={crear.isPending} className="grid gap-3 sm:grid-cols-2">
        <label>Nombre<Input name="nombre" required maxLength={100} autoFocus autoComplete="given-name" /></label>
        <label>Apellido<Input name="apellido" maxLength={100} autoComplete="family-name" /></label>
        <label>Correo electrónico<Input name="email" type="email" required maxLength={150} autoComplete="email" /></label>
        <label>Teléfono<Input name="telefono" type="tel" maxLength={20} autoComplete="tel" /></label>
        <label>Vehículo<Input name="vehiculo" maxLength={150} /></label>
        <label>Contraseña inicial<Input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label>
      </fieldset>
      {crear.isError && <p role="alert">{crear.error instanceof ErrorHttp && crear.error.status === 409 ? 'El correo ya está registrado.' : crear.error.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" isLoading={crear.isPending}>Registrar</Button>
        <Button type="button" variant="outline" disabled={crear.isPending} onClick={() => setFormulario(false)}>Cancelar</Button>
      </div>
    </form>}
    <label className="block max-w-xs">Consultar asignaciones del día
      <Input type="date" value={fecha} onChange={event => setFecha(event.target.value)} required />
    </label>
    {!fecha && <p role="status">Selecciona una fecha para consultar la disponibilidad.</p>}
    {consulta.isLoading && <p role="status">Consultando repartidores…</p>}
    {consulta.isError && <p role="alert">No se pudo cargar la flota. <Button variant="outline" onClick={() => consulta.refetch()}>Reintentar</Button></p>}
    {cambiarEstado.isError && <p role="alert">{cambiarEstado.error.message}. Si tiene rutas pendientes, reasígnalas desde Despacho.</p>}
    {consulta.isSuccess && consulta.data.length === 0 && <p>No hay repartidores registrados.</p>}
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {paginado.datos.map(rep => <li key={rep.id} className="space-y-2 rounded-lg border bg-card p-4">
        <h2 className="break-words font-semibold">{rep.nombre} {rep.apellido}</h2>
        <p className="break-all text-sm">{rep.email}</p>
        {rep.telefono && <p className="text-sm">{rep.telefono}</p>}
        {rep.vehiculo && <p className="text-sm">{rep.vehiculo}</p>}
        <p>{rep.estado === 'inactivo' ? 'Cuenta inactiva' : rep.rutas.length ? 'Con ruta asignada para esta fecha' : 'Disponible para esta fecha'}</p>
        {rep.rutas.map(ruta => <p key={ruta.id} className="text-sm">Ruta {ruta.estado.replaceAll('_', ' ')}</p>)}
        <Button variant="outline" disabled={cambiarEstado.isPending} onClick={() => cambiarEstado.mutate({
          id: rep.id, estado: rep.estado === 'activo' ? 'inactivo' : 'activo',
        })}>{rep.estado === 'activo' ? 'Desactivar cuenta' : 'Activar cuenta'}</Button>
      </li>)}
    </ul>
    <Paginacion {...paginado} />
  </div>;
}

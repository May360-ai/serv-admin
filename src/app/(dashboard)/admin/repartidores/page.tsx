'use client';

import { Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { getFechaHoy } from '@/features/despacho/despacho.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Paginacion, usePaginacion } from '@/components/ui/paginacion';

const repartidoresSchema = z.object({ data: z.array(z.object({
  id: z.number().int(), nombre: z.string(), apellido: z.string().nullable(),
  email: z.string(), telefono: z.string().nullable(), cedula: z.string().nullable().optional(),
  vehiculo: z.string().nullable(), capacidad_maxima: z.number().int().nullable().optional(),
  estado: z.enum(['activo', 'inactivo']),
  calificacion_promedio: z.number().nullable().optional(), cantidad_resenas: z.number().optional(),
  rutas: z.array(z.object({ id: z.string(), estado: z.string() })),
})) });

function construirPayloadRepartidor(form: HTMLFormElement, esEdicion: boolean) {
  const raw = Object.fromEntries(new FormData(form));
  const payload: Record<string, unknown> = { ...raw };
  const cedula = typeof raw.cedula === 'string' ? raw.cedula.trim() : '';
  if (cedula) payload.cedula = cedula;
  else if (esEdicion) payload.cedula = null;
  else delete payload.cedula;

  const capTexto = typeof raw.capacidad_maxima === 'string' ? raw.capacidad_maxima.trim() : '';
  if (capTexto) payload.capacidad_maxima = Number(capTexto);
  else if (esEdicion) payload.capacidad_maxima = null;
  else delete payload.capacidad_maxima;

  return payload;
}

export default function AdminRepartidoresPage() {
  return <Suspense fallback={<p role="status">Cargando gestión de repartidores…</p>}><GestionRepartidores /></Suspense>;
}

function GestionRepartidores() {
  const usuario = useAuthStore(state => state.usuario);
  const client = useQueryClient();
  const [fecha, setFecha] = useState(getFechaHoy);
  const [formulario, setFormulario] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
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
      await apiClient.post('/api/repartidores', construirPayloadRepartidor(form, false));
    },
    onSuccess: () => { setFormulario(false); actualizar(); },
  });
  const editar = useMutation({
    mutationFn: async ({ id, form }: { id: number; form: HTMLFormElement }) => {
      await apiClient.patch(`/api/repartidores/${id}`, construirPayloadRepartidor(form, true));
    },
    onSuccess: () => { setEditando(null); actualizar(); },
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
        <label>Cédula<Input name="cedula" maxLength={10} inputMode="numeric" placeholder="1803456787" /></label>
        <label>Capacidad máxima (pedidos/ruta)<Input name="capacidad_maxima" type="number" min={1} max={20} step={1} placeholder="Según zona" /></label>
        <label>Vehículo<Input name="vehiculo" maxLength={150} /></label>
        <label>Contraseña inicial<Input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label>
      </fieldset>
      {crear.isError && <p role="alert">{crear.error.message}</p>}
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
        <p className="text-sm">{rep.calificacion_promedio != null ? `${rep.calificacion_promedio.toFixed(1)}/5 · ${rep.cantidad_resenas ?? 0} entregas valoradas` : 'Sin valoraciones de entregas'}</p>
        <p className="break-all text-sm">{rep.email}</p>
        {rep.telefono && <p className="text-sm">{rep.telefono}</p>}
        {rep.cedula && <p className="text-sm">Cédula: {rep.cedula}</p>}
        {rep.vehiculo && <p className="text-sm">{rep.vehiculo}</p>}
        <p className="text-sm">Capacidad por salida: {rep.capacidad_maxima != null ? `${rep.capacidad_maxima} pedidos` : 'según zona'}</p>
        <p>{rep.estado === 'inactivo' ? 'Cuenta inactiva'
          : rep.rutas.some(r => r.estado === 'armando' || r.estado === 'en_ruta') ? 'Con una salida abierta en esta fecha'
          : rep.rutas.length ? 'Salidas de esta fecha terminadas; puede recibir otra' : 'Sin salidas en esta fecha'}</p>
        {rep.rutas.map(ruta => <p key={ruta.id} className="text-sm">Ruta {ruta.estado.replaceAll('_', ' ')}</p>)}
        {editando === rep.id ? <form className="space-y-2 border-t pt-2" onSubmit={event => {
          event.preventDefault();
          editar.mutate({ id: rep.id, form: event.currentTarget });
        }}>
          <fieldset disabled={editar.isPending} className="grid gap-2">
            <label>Nombre<Input name="nombre" defaultValue={rep.nombre} required maxLength={100} /></label>
            <label>Apellido<Input name="apellido" defaultValue={rep.apellido ?? ''} maxLength={100} /></label>
            <label>Teléfono<Input name="telefono" type="tel" defaultValue={rep.telefono ?? ''} maxLength={20} /></label>
            <label>Cédula<Input name="cedula" defaultValue={rep.cedula ?? ''} maxLength={10} inputMode="numeric" /></label>
            <label>Capacidad máxima (pedidos/ruta)<Input name="capacidad_maxima" type="number" defaultValue={rep.capacidad_maxima ?? ''} min={1} max={20} step={1} placeholder="Según zona" /></label>
            <label>Vehículo<Input name="vehiculo" defaultValue={rep.vehiculo ?? ''} maxLength={150} /></label>
          </fieldset>
          {editar.isError && <p role="alert">{editar.error.message}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" isLoading={editar.isPending}>Guardar</Button>
            <Button type="button" size="sm" variant="outline" disabled={editar.isPending} onClick={() => setEditando(null)}>Cancelar</Button>
          </div>
        </form> : <Button variant="outline" onClick={() => { editar.reset(); setEditando(rep.id); }}>Editar datos</Button>}
        <Button variant="outline" disabled={cambiarEstado.isPending} onClick={() => cambiarEstado.mutate({
          id: rep.id, estado: rep.estado === 'activo' ? 'inactivo' : 'activo',
        })}>{rep.estado === 'activo' ? 'Desactivar cuenta' : 'Activar cuenta'}</Button>
      </li>)}
    </ul>
    <Paginacion {...paginado} />
  </div>;
}

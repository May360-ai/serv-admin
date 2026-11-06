'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { getFechaHoy } from './despacho.store';
import type { Ruta } from '@/types';

type Historial = { id: number; pedido_id: number; fecha_anterior: string; fecha_nueva: string; motivo: string; repartidor_anterior_id: number; repartidor_nuevo_id: number };

export function EntregasAtrasadas({ zona }: { zona: string | null }) {
  const client = useQueryClient();
  const [seleccion, setSeleccion] = useState<{ ruta: Ruta; pedido: Ruta['pedidos'][number] } | null>(null);
  const consulta = useQuery({
    queryKey: ['atrasadas', zona], refetchInterval: 15000,
    queryFn: async () => (await apiClient.get<{ data: Ruta[] }>('/api/rutas/atrasadas', { params: { zona_id: zona || undefined } })).data.data,
  });
  const repartidores = useQuery({
    queryKey: ['repartidores-reprogramacion'], enabled: Boolean(seleccion),
    queryFn: async () => (await apiClient.get<{ data: { id: number; nombre: string; apellido: string | null }[] }>('/api/rutas/repartidores')).data.data,
  });
  const historial = useQuery({
    queryKey: ['reprogramaciones'],
    queryFn: async () => (await apiClient.get<{ data: Historial[] }>('/api/rutas/reprogramaciones')).data.data,
  });
  const guardar = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      if (!seleccion) return;
      const body = Object.fromEntries(new FormData(form));
      await apiClient.post(`/api/rutas/${seleccion.ruta.id}/pedidos/${seleccion.pedido.id}/reprogramar`, body);
    },
    onSuccess: () => {
      setSeleccion(null);
      for (const key of ['atrasadas', 'rutas', 'pedidos', 'reprogramaciones', 'mis-entregas']) void client.invalidateQueries({ queryKey: [key] });
      toast.success('Pedido reprogramado. El historial quedó guardado.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const cantidad = consulta.data?.reduce((total, ruta) => total + ruta.pedidos.length, 0) ?? 0;
  return <section className="space-y-4 rounded-lg border bg-card p-4" aria-labelledby="titulo-atrasadas">
    <h2 id="titulo-atrasadas" className="text-lg font-semibold">Entregas atrasadas ({cantidad})</h2>
    <p className="text-sm text-muted-foreground">Pedidos de días anteriores sin completar, aunque ya tengan ruta asignada.</p>
    {consulta.isLoading && <p role="status">Consultando entregas atrasadas…</p>}
    {consulta.isError && <p role="alert">No se pudieron cargar. <Button variant="outline" onClick={() => consulta.refetch()}>Reintentar</Button></p>}
    {consulta.isSuccess && cantidad === 0 && <p>No hay entregas atrasadas en esta zona.</p>}
    <ul className="divide-y">{consulta.data?.flatMap(ruta => ruta.pedidos.map(pedido => <li key={pedido.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 break-words"><p className="font-medium">{pedido.numero_pedido} · {pedido.cliente_nombre}</p>
        <p className="text-sm">{ruta.fecha_entrega} · {ruta.repartidor?.nombre} · {pedido.estado.replaceAll('_', ' ')}</p></div>
      <Button variant="outline" disabled={guardar.isPending} onClick={() => { guardar.reset(); setSeleccion({ ruta, pedido }); }}>Reprogramar</Button>
    </li>))}</ul>
    {seleccion && <form key={seleccion.pedido.id} className="space-y-3 rounded-md border p-4" onSubmit={event => { event.preventDefault(); guardar.mutate(event.currentTarget); }}>
      <h3 className="font-semibold">Reprogramar {seleccion.pedido.numero_pedido}</h3>
      <p className="text-sm">Volverá a pendiente en la nueva ruta. Si ya se entregó, el repartidor debe confirmarlo en Mis entregas.</p>
      <fieldset disabled={guardar.isPending} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">Nueva fecha<Input autoFocus name="fecha_entrega" type="date" min={getFechaHoy()} defaultValue={getFechaHoy()} required /></label>
        <label className="space-y-1">Hora de entrega<Input name="hora_entrega" type="time" required /></label>
        <label className="space-y-1 sm:col-span-2">Repartidor<Select name="repartidor_id" required defaultValue="">
          <option value="">Seleccionar repartidor</option>
          {repartidores.data?.map(rep => <option key={rep.id} value={rep.id}>{rep.nombre} {rep.apellido}</option>)}
        </Select></label>
        <label className="space-y-1 sm:col-span-2">Motivo<Input name="motivo" maxLength={500} required placeholder="Por ejemplo: no se pudo completar el recorrido" /></label>
      </fieldset>
      {repartidores.isLoading && <p role="status">Cargando repartidores…</p>}
      {repartidores.isError && <p role="alert">No se pudieron cargar los repartidores. <Button type="button" variant="outline" onClick={() => repartidores.refetch()}>Reintentar</Button></p>}
      {guardar.isError && <p role="alert">{guardar.error.message}</p>}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!repartidores.data?.length} isLoading={guardar.isPending}>Confirmar reprogramación</Button>
        <Button type="button" variant="outline" disabled={guardar.isPending} onClick={() => setSeleccion(null)}>Cancelar</Button></div>
    </form>}
    <details>
      <summary className="cursor-pointer font-medium">Historial de reprogramaciones (últimas 50)</summary>
      {historial.isLoading && <p role="status">Cargando historial…</p>}
      {historial.isError && <p role="alert">No se pudo cargar el historial. <Button variant="outline" onClick={() => historial.refetch()}>Reintentar</Button></p>}
      {historial.data?.length === 0 && <p>No hay reprogramaciones registradas.</p>}
      <ul className="divide-y">{historial.data?.map(item => <li key={item.id} className="break-words py-3 text-sm">
        <p>Pedido {item.pedido_id}: {new Date(item.fecha_anterior).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })} → {new Date(item.fecha_nueva).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}</p>
        <p>Repartidor {item.repartidor_anterior_id} → {item.repartidor_nuevo_id}. {item.motivo}</p>
      </li>)}</ul>
    </details>
  </section>;
}

'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { getFechaHoy } from '@/features/despacho/despacho.store';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import type { Ruta } from '@/types';
import { ubicacionParaConfirmar } from '@/lib/ubicacion-confirmacion';
import { prepararFoto } from '@/lib/preparar-foto';

const suscribirFecha = () => () => {};
const fechaServidor = () => '';

export default function EntregasPage() {
  const fecha = useSyncExternalStore(suscribirFecha, getFechaHoy, fechaServidor);
  const queryClient = useQueryClient();
  const key = ['mis-entregas', fecha];
  const consulta = useQuery({
    queryKey: key, enabled: Boolean(fecha), refetchInterval: 15000,
    queryFn: async () => (await apiClient.get<{ data: Ruta[] }>('/api/rutas/mis-entregas', { params: { fecha_entrega: fecha, incluir_atrasadas: true } })).data.data,
  });
  const avanzar = useMutation({
    mutationFn: async ({ ruta, pedido, estado }: { ruta: string; pedido: string; estado: string }) => {
      const ubicacion = estado === 'completado' ? await ubicacionParaConfirmar() : undefined;
      return apiClient.patch('/api/rutas/' + ruta + '/entregas/' + pedido, { estado, ...(ubicacion ? { ubicacion } : {}) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (error: Error) => toast.error(error.message),
  });
  const foto = useMutation({ mutationFn: async ({ pedido, archivo }: { pedido: string; archivo: File }) => {
    await apiClient.put(`/api/pedidos/${pedido}/foto-entrega`, await prepararFoto(archivo), { headers: { 'Content-Type': 'image/jpeg' } });
  }, onSuccess: () => queryClient.invalidateQueries({ queryKey: key }) });
  return <section className="mx-auto max-w-2xl space-y-5">
    <h1 className="text-4xl font-semibold tracking-tight">Mis entregas</h1>
    {(!fecha || consulta.isLoading) && <p>Consultando tus paradas…</p>}
    {consulta.isError && <p role="alert">No se pudieron cargar tus entregas. <button onClick={() => consulta.refetch()}>Reintentar</button></p>}
    {avanzar.isError && <p role="alert">{avanzar.error.message}</p>}
    {foto.isError && <p role="alert">{foto.error.message}</p>}
    {consulta.data?.length === 0 && <p>No tienes salidas asignadas para hoy.</p>}
    {consulta.data?.map(ruta => {
      const siguiente = ruta.pedidos.find(p => !['completado', 'cancelado', 'fallido'].includes(p.estado));
      return <article key={ruta.id} className="rounded-lg border bg-card p-5">
        <h2 className="text-xl font-semibold">{ruta.zona?.nombre}</h2>
        {ruta.fecha_entrega < fecha && <p className="font-medium">Entrega atrasada del {ruta.fecha_entrega}. Si ya entregaste, confirma la entrega.</p>}
        <ol className="divide-y">{ruta.pedidos.map(p => <li key={p.id} className="py-4">
          <p className="text-sm text-muted-foreground">Parada {p.orden_en_ruta} · {p.ventana_horaria?.desde ?? 'Sin hora'}</p>
          <h3 className="font-semibold">{p.direccion.calle}</h3>
          <p>{p.cliente_nombre} · {p.estado === 'completado' ? 'Entregado' : p.estado.replaceAll('_', ' ')}</p>
          {p.motivo_fallo && <p>Motivo: {p.motivo_fallo}</p>}
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link className="rounded underline underline-offset-4 focus-visible:outline focus-visible:outline-2" href={`/chat?pedido=${encodeURIComponent(p.id)}&contacto=cliente`}>Contactar al cliente</Link>
            <Link className="rounded underline underline-offset-4 focus-visible:outline focus-visible:outline-2" href={`/chat?pedido=${encodeURIComponent(p.id)}&contacto=tienda`}>Contactar a la tienda</Link>
          </div>
          {siguiente?.id === p.id && p.estado === 'en_camino' && <label className="mt-3 block text-sm">{p.foto_entrega ? 'Foto enviada. Puedes reemplazarla antes de confirmar.' : 'Foto del pedido obligatoria'}<input className="mt-2 block w-full" type="file" capture="environment" accept="image/jpeg,image/png,image/webp" disabled={foto.isPending || avanzar.isPending} onChange={event => { const archivo = event.target.files?.[0]; if (archivo) foto.mutate({ pedido: p.id, archivo }); event.target.value = ''; }} /></label>}
          {siguiente?.id === p.id && <Button className="mt-3" disabled={avanzar.isPending || foto.isPending || (p.estado === 'en_camino' && !p.foto_entrega)} onClick={() => avanzar.mutate({
            ruta: ruta.id, pedido: p.id, estado: p.estado === 'en_camino' ? 'completado' : 'en_camino'
          })}>{avanzar.isPending ? 'Procesando…' : p.estado === 'en_camino' ? 'Confirmar entrega' : 'Marcar en camino'}</Button>}
          {siguiente?.id === p.id && p.estado === 'en_camino' && <p className="mt-2 text-sm">Al confirmar se comprueba tu cercanía al destino con una ubicación reciente. Si el GPS falla, contacta a despacho.</p>}
        </li>)}</ol>
      </article>;
    })}
  </section>;
}

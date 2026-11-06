'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getFechaHoy } from '@/features/despacho/despacho.store';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import type { Ruta } from '@/types';

export default function EntregasPage() {
  const [fecha, setFecha] = useState('');
  useEffect(() => setFecha(getFechaHoy()), []);
  const queryClient = useQueryClient();
  const key = ['mis-entregas', fecha];
  const consulta = useQuery({
    queryKey: key, enabled: Boolean(fecha), refetchInterval: 15000,
    queryFn: async () => (await apiClient.get<{ data: Ruta[] }>('/api/rutas/mis-entregas', { params: { fecha_entrega: fecha, incluir_atrasadas: true } })).data.data,
  });
  const avanzar = useMutation({
    mutationFn: ({ ruta, pedido, estado }: { ruta: string; pedido: string; estado: string }) =>
      apiClient.patch('/api/rutas/' + ruta + '/entregas/' + pedido, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (error: Error) => toast.error(error.message),
  });
  return <section className="mx-auto max-w-2xl space-y-5">
    <h1 className="text-4xl font-semibold tracking-tight">Mis entregas</h1>
    {(!fecha || consulta.isLoading) && <p>Consultando tus paradas…</p>}
    {consulta.isError && <p role="alert">No se pudieron cargar tus entregas. <button onClick={() => consulta.refetch()}>Reintentar</button></p>}
    {consulta.data?.length === 0 && <p>No tienes salidas asignadas para hoy.</p>}
    {consulta.data?.map(ruta => {
      const siguiente = ruta.pedidos.find(p => !['completado', 'cancelado'].includes(p.estado));
      return <article key={ruta.id} className="rounded-lg border bg-card p-5">
        <h2 className="text-xl font-semibold">{ruta.zona?.nombre}</h2>
        {ruta.fecha_entrega < fecha && <p className="font-medium">Entrega atrasada del {ruta.fecha_entrega}. Si ya entregaste, confirma la entrega.</p>}
        <ol className="divide-y">{ruta.pedidos.map(p => <li key={p.id} className="py-4">
          <p className="text-sm text-muted-foreground">Parada {p.orden_en_ruta} · {p.ventana_horaria.desde}</p>
          <h3 className="font-semibold">{p.direccion.calle}</h3>
          <p>{p.cliente_nombre} · {p.estado === 'completado' ? 'Entregado' : p.estado.replaceAll('_', ' ')}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link className="rounded underline underline-offset-4 focus-visible:outline focus-visible:outline-2" href={`/chat?pedido=${encodeURIComponent(p.id)}&contacto=cliente`}>Contactar al cliente</Link>
            <Link className="rounded underline underline-offset-4 focus-visible:outline focus-visible:outline-2" href={`/chat?pedido=${encodeURIComponent(p.id)}&contacto=tienda`}>Contactar a la tienda</Link>
          </div>
          {siguiente?.id === p.id && <Button className="mt-3" disabled={avanzar.isPending} onClick={() => avanzar.mutate({
            ruta: ruta.id, pedido: p.id, estado: p.estado === 'en_camino' ? 'completado' : 'en_camino'
          })}>{p.estado === 'en_camino' ? 'Confirmar entrega' : 'Marcar en camino'}</Button>}
        </li>)}</ol>
      </article>;
    })}
  </section>;
}

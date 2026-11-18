'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Paginacion } from '@/components/ui/paginacion';

function FormularioValoracion({ path, initial, onSaved }: { path: string; initial?: { calificacion: number | null; comentario: string }; onSaved: () => void }) {
  const [puntos, setPuntos] = useState(String(initial?.calificacion ?? 5));
  const [comentario, setComentario] = useState(initial?.comentario ?? '');
  const guardar = useMutation({ mutationFn: () => apiClient.put(path, { calificacion: Number(puntos), comentario: comentario.trim() }), onSuccess: onSaved });
  return <form className="space-y-3" onSubmit={e => { e.preventDefault(); guardar.mutate(); }}>
    <label className="block space-y-1">Mi calificación<Select value={puntos} onChange={e => setPuntos(e.target.value)} disabled={guardar.isPending}>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n} de 5</option>)}</Select></label>
    <label className="block space-y-1">Mi comentario<Textarea value={comentario} maxLength={1000} onChange={e => setComentario(e.target.value)} disabled={guardar.isPending} /></label>
    <p className="text-sm">Puedes editar tu valoración; guardarla de nuevo no agrega otra calificación.</p>
    {guardar.isError && <p role="alert">{guardar.error.message}</p>}
    {guardar.isSuccess && <p role="status">Valoración guardada.</p>}
    <Button type="submit" isLoading={guardar.isPending}>Guardar mi valoración</Button>
  </form>;
}

export function ResenasProducto({ itemId }: { itemId: number }) {
  const usuario = useAuthStore(s => s.usuario);
  const [open, setOpen] = useState(false); const [page, setPage] = useState(1);
  const client = useQueryClient();
  const consulta = useQuery({ queryKey: ['resenas-producto', itemId, page], enabled: open,
    queryFn: async () => (await apiClient.get<{ data: { nombre_cliente: string; calificacion: number; comentario: string }[]; meta: { page: number; total_pages: number } }>(`/api/items/${itemId}/resenas`, { params: { page } })).data });
  const mia = useQuery({ queryKey: ['mi-resena-producto', usuario?.id, itemId], enabled: open && usuario?.rol === 'cliente',
    queryFn: async () => (await apiClient.get<{ calificacion: number | null; comentario: string; puede_resenar: boolean }>(`/api/items/${itemId}/mi-resena`)).data });
  return <><Button variant="outline" onClick={() => setOpen(true)}>Reseñas del producto</Button>
    {open && <Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[calc(100vw-2rem)] sm:w-[36rem]" onClose={() => setOpen(false)} aria-labelledby={`resenas-${itemId}`}>
      <DialogHeader><DialogTitle id={`resenas-${itemId}`}>Reseñas del producto</DialogTitle></DialogHeader>
      {consulta.isPending && <p role="status">Cargando reseñas…</p>}
      {consulta.isError && <p role="alert">No se pudieron cargar las reseñas. <Button onClick={() => void consulta.refetch()}>Reintentar reseñas</Button></p>}
      {consulta.data?.data.length === 0 && <p>Todavía no hay reseñas.</p>}
      <ul className="space-y-3">{consulta.data?.data.map((r,i) => <li key={i} className="border-b py-2"><p>{r.nombre_cliente} · {r.calificacion}/5</p><p className="break-words">{r.comentario}</p></li>)}</ul>
      <Paginacion pagina={page} paginas={Math.max(1,consulta.data?.meta.total_pages ?? 1)} cambiar={setPage} />
      {usuario?.rol === 'cliente' && <div className="mt-4 border-t pt-4">
        {mia.isPending && <p>Cargando tu valoración…</p>}
        {mia.isError && <p role="alert">No se pudo consultar si puedes valorar este producto. <Button onClick={() => void mia.refetch()}>Reintentar</Button></p>}
        {mia.data?.puede_resenar ? <FormularioValoracion path={`/api/items/${itemId}/resena`} initial={mia.data} onSaved={() => {
          void client.invalidateQueries({ queryKey: ['resenas-producto', itemId] }); void client.invalidateQueries({ queryKey: ['catalogo-items'] }); void client.invalidateQueries({ queryKey: ['items-tienda'] });
        }} /> : mia.isSuccess && <p>Podrás valorar este producto cuando recibas un pedido que lo incluya.</p>}
      </div>}
    </DialogContent></Dialog>}
  </>;
}

export function ResenaRepartidor({ pedidoId }: { pedidoId: number }) {
  const usuario = useAuthStore(s => s.usuario);
  const consulta = useQuery({ queryKey: ['resena-repartidor', usuario?.id, pedidoId], queryFn: async () => (await apiClient.get<{ repartidor_nombre: string; calificacion: number | null; comentario: string }>(`/api/pedidos/${pedidoId}/resena-repartidor`)).data });
  return <section className="space-y-3 rounded-lg border bg-card p-4">
    <h2 className="font-semibold">Valoración del repartidor</h2>
    {consulta.isPending && <p>Cargando valoración…</p>}
    {consulta.isError && <p role="alert">No se pudo cargar la valoración. <Button onClick={() => void consulta.refetch()}>Reintentar valoración</Button></p>}
    {consulta.data && <><p>{consulta.data.repartidor_nombre}{consulta.data.calificacion ? ` · ${consulta.data.calificacion}/5` : ' · Sin valorar'}</p>
      {usuario?.rol === 'cliente' ? <FormularioValoracion path={`/api/pedidos/${pedidoId}/resena-repartidor`} initial={consulta.data} onSaved={() => void consulta.refetch()} /> : <p>{consulta.data.comentario}</p>}
    </>}
  </section>;
}

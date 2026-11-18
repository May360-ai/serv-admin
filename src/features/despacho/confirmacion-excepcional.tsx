'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Ruta } from '@/types';

export function ConfirmacionExcepcional({ rutas }: { rutas: Ruta[] }) {
  const [abierto, setAbierto] = useState(false);
  const [id, setId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const client = useQueryClient();
  const opciones = rutas.filter(r => r.estado === 'en_ruta').flatMap(ruta => {
    const pedido = ruta.pedidos.find(p => !['completado', 'cancelado', 'fallido'].includes(p.estado));
    return pedido?.estado === 'en_camino' ? [{ ruta, pedido }] : [];
  });
  const seleccion = opciones.find(opcion => opcion.pedido.id === id);
  const registros = rutas.flatMap(ruta => ruta.pedidos.filter(p => p.confirmacion_entrega).map(pedido => ({ ruta, pedido })));
  const guardar = useMutation({
    mutationFn: async () => {
      if (!seleccion || !confirmado || motivo.trim().length < 10) throw new Error('Selecciona la entrega, explica el motivo y confirma la verificación.');
      await apiClient.post(`/api/rutas/${seleccion.ruta.id}/entregas/${seleccion.pedido.id}/excepcion`, { motivo: motivo.trim() });
    },
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: ['rutas'] }), client.invalidateQueries({ queryKey: ['pedidos'] })]);
      setMotivo(''); setConfirmado(false); setId('');
    },
  });
  return <>
    <Button variant="outline" onClick={() => setAbierto(true)}>Confirmaciones de entrega</Button>
    <Dialog open={abierto} onOpenChange={valor => { if (!guardar.isPending) setAbierto(valor); }}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-[36rem] sm:max-w-[36rem]" onClose={() => { if (!guardar.isPending) setAbierto(false); }} aria-labelledby="titulo-confirmaciones">
        <DialogHeader><DialogTitle id="titulo-confirmaciones">Confirmaciones de entrega</DialogTitle></DialogHeader>
        <p className="mb-4 text-sm">Si el repartidor no puede validar el GPS, verifica la entrega con él o con el cliente. La excepción completa el pedido y registra tu identidad, la fecha y el motivo.</p>
        {!opciones.length ? <p role="status">No hay próximas paradas en camino que requieran confirmación.</p> : <form className="space-y-3" onSubmit={event => { event.preventDefault(); guardar.mutate(); }}>
          <label className="block space-y-1">Entrega
            <Select value={id} required disabled={guardar.isPending} onChange={event => { setId(event.target.value); setMotivo(''); setConfirmado(false); guardar.reset(); }}>
              <option value="">Selecciona una entrega</option>
              {opciones.map(({ ruta, pedido }) => <option key={pedido.id} value={pedido.id}>{pedido.numero_pedido} · {pedido.cliente_nombre} · {ruta.nombre}</option>)}
            </Select>
          </label>
          {seleccion && <p className="text-sm">{seleccion.pedido.direccion.calle}, {seleccion.pedido.direccion.ciudad}</p>}
          <label className="block space-y-1">Motivo de la excepción
            <Textarea value={motivo} minLength={10} maxLength={500} required disabled={guardar.isPending} onChange={event => setMotivo(event.target.value)} />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={confirmado} disabled={guardar.isPending} onChange={event => setConfirmado(event.target.checked)} /> Verifiqué que el cliente recibió el pedido.</label>
          {guardar.isError && <p role="alert">{guardar.error.message}</p>}
          <Button type="submit" disabled={!seleccion || !confirmado || motivo.trim().length < 10 || guardar.isPending} isLoading={guardar.isPending}>Confirmar entrega excepcional</Button>
        </form>}
        <h3 className="mt-6 mb-2 font-medium">Confirmaciones de las rutas seleccionadas</h3>
        {!registros.length && <p className="text-sm">Todavía no hay confirmaciones.</p>}
        <ul className="space-y-3 text-sm">{registros.map(({ pedido }) => <li key={pedido.id} className="border-t pt-2">
          <p>{pedido.numero_pedido} · {pedido.confirmacion_entrega?.metodo === 'gps' ? 'Cercanía GPS verificada' : 'Excepción autorizada'}</p>
          <p>Usuario #{pedido.confirmacion_entrega?.actor_id} · {new Date(pedido.confirmacion_entrega!.registrada_en).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}</p>
          {pedido.confirmacion_entrega?.motivo && <p>Motivo: {pedido.confirmacion_entrega.motivo}</p>}
        </li>)}</ul>
      </DialogContent>
    </Dialog>
  </>;
}

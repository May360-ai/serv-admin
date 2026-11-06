'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatService, type ContactoChat, type PedidoChat } from '@/services/chat.service';
import { useAuthStore } from '@/store/auth.store';
import { useSocket } from '@/hooks/use-socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

function Conversacion({ pedido, contacto }: { pedido: PedidoChat; contacto: ContactoChat }) {
  const usuario = useAuthStore(s => s.usuario);
  const client = useQueryClient();
  const { on, off } = useSocket();
  const [texto, setTexto] = useState('');
  const final = useRef<HTMLDivElement>(null);
  const key = ['chat-mensajes', pedido.id, contacto.id];
  const consulta = useQuery({ queryKey: key, queryFn: () => chatService.obtenerMensajes(pedido.id, contacto.id), refetchInterval: 10000 });
  useEffect(() => {
    const actualizar = (raw: unknown) => {
      const mensaje = raw as { pedido_id: number };
      if (String(mensaje.pedido_id) === pedido.id) void client.invalidateQueries({ queryKey: ['chat-mensajes', pedido.id] });
    };
    on('nuevo_mensaje', actualizar);
    return () => off('nuevo_mensaje', actualizar);
  }, [pedido.id, on, off, client]);
  useEffect(() => { final.current?.scrollIntoView({ block: 'nearest' }); }, [consulta.data]);
  const enviar = useMutation({
    mutationFn: () => chatService.enviarMensaje({ pedido_id: pedido.id, destinatario_id: contacto.id, contenido: texto.trim() }),
    onSuccess: () => { setTexto(''); void client.invalidateQueries({ queryKey: key }); },
  });
  return <section className="flex min-h-96 min-w-0 flex-1 flex-col rounded-lg border bg-card" aria-label={`Conversación con ${contacto.nombre}`}>
    <header className="border-b p-4">
      <h2 className="font-semibold">{contacto.nombre} · {contacto.tipo}</h2>
      <p className="break-words text-sm text-muted-foreground">{pedido.numero_pedido} · {pedido.direccion}</p>
      <p className="text-sm">Solo tú y este contacto reciben estos mensajes.</p>
    </header>
    <div className="max-h-[55vh] flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-label="Mensajes">
      {consulta.isLoading && <p role="status">Cargando mensajes…</p>}
      {consulta.isError && <p role="alert">{consulta.error.message} <Button variant="outline" onClick={() => consulta.refetch()}>Reintentar</Button></p>}
      {consulta.isSuccess && consulta.data.length === 0 && <p>No hay mensajes con este contacto. Escribe para coordinar la entrega.</p>}
      {consulta.data?.map(msg => <article key={msg.id} className={`w-fit max-w-[90%] rounded-lg border p-3 ${String(msg.autor_id) === String(usuario?.id) ? 'ml-auto bg-muted' : 'bg-background'}`}>
        <p className="text-sm font-medium">{String(msg.autor_id) === String(usuario?.id) ? 'Tú' : contacto.nombre}</p>
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.contenido}</p>
        <time className="text-xs text-muted-foreground" dateTime={msg.created_at}>{new Date(msg.created_at).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', dateStyle: 'short', timeStyle: 'short' })}</time>
      </article>)}
      <div ref={final} />
    </div>
    <form className="space-y-2 border-t p-3" onSubmit={event => { event.preventDefault(); if (texto.trim() && !enviar.isPending) enviar.mutate(); }}>
      <div className="flex gap-2">
        <Input aria-label={`Mensaje para ${contacto.nombre}`} placeholder="Escribe un mensaje" maxLength={4000} value={texto} onChange={event => { setTexto(event.target.value); enviar.reset(); }} disabled={enviar.isPending || !consulta.isSuccess} className="min-w-0" />
        <Button type="submit" disabled={!texto.trim() || !consulta.isSuccess || enviar.isPending} isLoading={enviar.isPending}>Enviar</Button>
      </div>
      {enviar.isError && <p role="alert">{enviar.error.message}</p>}
    </form>
  </section>;
}

export default function ChatPage() {
  const usuario = useAuthStore(s => s.usuario);
  const [pedidoId, setPedidoId] = useState('');
  const [contactoId, setContactoId] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPedidoId(params.get('pedido') || '');
    setContactoId(params.get('contacto') || '');
  }, []);
  const consulta = useQuery({ queryKey: ['pedidos-chat', usuario?.id], queryFn: chatService.listarPedidos, enabled: Boolean(usuario), refetchInterval: 15000 });
  const pedidos = consulta.data ?? [];
  const pedido = pedidos.find(p => p.id === pedidoId) ?? (!pedidoId ? pedidos[0] : undefined);
  const contacto = pedido?.contactos.find(c => c.tipo === contactoId || String(c.id) === contactoId) ?? (!contactoId ? pedido?.contactos[0] : undefined);
  return <div className="mx-auto max-w-5xl space-y-4">
    <h1 className="text-3xl font-semibold">Chat de pedido</h1>
    <p>Selecciona un pedido y la persona con quien necesitas coordinar.</p>
    {consulta.isLoading && <p role="status">Cargando tus pedidos…</p>}
    {consulta.isError && <p role="alert">{consulta.error.message} <Button variant="outline" onClick={() => consulta.refetch()}>Reintentar</Button></p>}
    {consulta.isSuccess && pedidos.length === 0 && <p>No tienes pedidos con chat disponible.</p>}
    {pedidos.length > 0 && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>Pedido<Select value={pedido?.id ?? ''} onChange={event => { setPedidoId(event.target.value); setContactoId(''); }}>
          {!pedido && <option value="">Selecciona un pedido disponible</option>}
          {pedidos.map(p => <option key={p.id} value={p.id}>{p.numero_pedido} · {p.direccion}</option>)}
        </Select></label>
        <label>Contactar a<Select value={contacto?.id ?? ''} onChange={event => setContactoId(event.target.value)} disabled={!pedido}>
          {!contacto && <option value="">Selecciona un contacto disponible</option>}
          {pedido?.contactos.map(c => <option key={c.id} value={c.id}>{c.nombre} · {c.tipo}</option>)}
        </Select></label>
      </div>
      {!pedido && <p role="status">Este pedido ya no está disponible para tu cuenta. Elige otro de la lista.</p>}
      {pedido && !contacto && <p role="status">Este contacto ya no participa en el pedido. Elige otro contacto.</p>}
      {pedido && contacto && <Conversacion key={`${pedido.id}-${contacto.id}`} pedido={pedido} contacto={contacto} />}
    </>}
  </div>;
}

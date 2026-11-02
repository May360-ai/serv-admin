'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Package, Store, User } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { chatService } from '@/services/chat.service';
import { useSocket } from '@/hooks/use-socket';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatFecha, getEstadoColor, getEstadoLabel } from '@/lib/utils';
import type { MensajeChat, EstadoPedido } from '@/types';

interface PedidoChatItem {
  id: string;
  numero_pedido: string;
  nombre_contacto: string;
  direccion: string;
  fecha: string;
  estado: string;
  destinatario_id: number;
}

interface ChatPedidoProps {
  pedido: PedidoChatItem;
  isSelected: boolean;
  onClick: () => void;
  esCliente: boolean;
}

function ChatPedidoItem({ pedido, isSelected, onClick, esCliente }: ChatPedidoProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-all hover:bg-accent text-left',
        isSelected ? 'bg-primary/10 border-primary/40 shadow-sm' : 'border-border bg-card'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {esCliente ? (
            <Store className="h-3.5 w-3.5 text-primary shrink-0" />
          ) : (
            <User className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          )}
          <p className="text-sm font-semibold text-foreground truncate">{pedido.nombre_contacto}</p>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
          #{pedido.numero_pedido}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground mt-1 truncate">
        {pedido.direccion}
      </p>

      <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-border/40">
        <span className="text-[11px] text-muted-foreground">{formatFecha(pedido.fecha)}</span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-semibold border ${getEstadoColor(
            pedido.estado as EstadoPedido
          )}`}
        >
          {getEstadoLabel(pedido.estado as EstadoPedido)}
        </span>
      </div>
    </button>
  );
}

interface PanelMensajesProps {
  pedido: PedidoChatItem;
}

function PanelMensajes({ pedido }: PanelMensajesProps) {
  const usuario = useAuthStore((s) => s.usuario);
  const queryClient = useQueryClient();
  const { on, off, emit } = useSocket();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Unirse a la sala de Socket.io del pedido
  useEffect(() => {
    if (pedido.id) {
      emit('join_pedido', pedido.id);
    }
  }, [pedido.id, emit]);

  // Cargar historial de mensajes vía REST usando React Query como fuente de verdad
  const { data: mensajes = [], isLoading } = useQuery<MensajeChat[]>({
    queryKey: ['chat-mensajes', pedido.id],
    queryFn: () => chatService.obtenerMensajes(pedido.id),
    enabled: Boolean(pedido.id),
  });

  // Escuchar mensajes en tiempo real vía WebSockets e inyectar en la caché de React Query
  useEffect(() => {
    const handleNuevoMensaje = (raw: unknown) => {
      const data = raw as Record<string, unknown>;
      if (String(data.pedido_id) === String(pedido.id)) {
        const msgNormalizado: MensajeChat = {
          id: String(data.id ?? Date.now()),
          pedido_id: String(data.pedido_id),
          autor_id: String(data.remitente_id || data.autor_id || ''),
          autor_nombre:
            String(data.remitente_id) === String(usuario?.id)
              ? (usuario?.nombre ?? 'Yo')
              : pedido.nombre_contacto,
          autor_rol: 'tienda',
          contenido: String(data.mensaje || data.contenido || ''),
          created_at: String(data.fecha_envio || data.created_at || new Date().toISOString()),
        };

        queryClient.setQueryData<MensajeChat[]>(['chat-mensajes', pedido.id], (prev = []) => {
          if (prev.some((m) => m.id === msgNormalizado.id)) return prev;
          return [...prev, msgNormalizado];
        });
      }
    };

    on('nuevo_mensaje', handleNuevoMensaje);
    on('mensaje_recibido', handleNuevoMensaje);

    return () => {
      off('nuevo_mensaje', handleNuevoMensaje);
      off('mensaje_recibido', handleNuevoMensaje);
    };
  }, [pedido.id, pedido.nombre_contacto, usuario, queryClient, on, off]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const handleEnviar = async () => {
    if (!texto.trim() || !usuario) return;
    setEnviando(true);
    try {
      const msg = await chatService.enviarMensaje({
        pedido_id: pedido.id,
        destinatario_id: pedido.destinatario_id,
        contenido: texto.trim(),
      });

      // Actualizar caché de React Query de forma reactiva e instantánea
      queryClient.setQueryData<MensajeChat[]>(['chat-mensajes', pedido.id], (prev = []) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      setTexto('');
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error al enviar mensaje';
      toast.error(mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleEnviar();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={cn('h-14 w-2/3', i % 2 !== 0 && 'ml-auto')} />
          ))
        ) : mensajes.length === 0 ? (
          <EmptyState
            title="Sin mensajes en este pedido"
            description="Escribí un mensaje para iniciar la conversación en tiempo real."
            icon={<MessageSquare className="h-8 w-8 text-muted-foreground" />}
            className="py-12"
          />
        ) : (
          mensajes.map((msg) => {
            const esMio = String(msg.autor_id) === String(usuario?.id);
            return (
              <div
                key={msg.id}
                className={cn('flex', esMio ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-xs sm:max-w-md rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                    esMio
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-card border border-border rounded-bl-sm text-foreground'
                  )}
                >
                  {!esMio && (
                    <p className="text-[11px] font-bold mb-1 opacity-75">{pedido.nombre_contacto}</p>
                  )}
                  <p className="leading-relaxed break-words">{msg.contenido}</p>
                  <p className={cn('text-[10px] mt-1 opacity-65', esMio ? 'text-right' : 'text-left')}>
                    {new Date(msg.created_at).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 sm:p-4 bg-card">
        <div className="flex gap-2">
          <Input
            placeholder={`Escribí un mensaje para ${pedido.nombre_contacto}...`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={enviando}
            className="flex-1"
            data-cy="input-chat-mensaje"
          />
          <Button
            onClick={() => void handleEnviar()}
            disabled={!texto.trim() || enviando}
            isLoading={enviando}
            size="icon"
            className="shrink-0"
            data-cy="btn-enviar-mensaje"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const esCliente = usuario?.rol === 'cliente';
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState<string | null>(null);

  // Consulta de pedidos adaptada al rol
  const { data: pedidos = [], isLoading } = useQuery<PedidoChatItem[]>({
    queryKey: ['pedidos-chat', usuario?.rol, usuario?.id],
    queryFn: async () => {
      if (esCliente) {
        const { data } = await apiClient.get<unknown>('/api/pedidos/mis-pedidos');
        const lista = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data || [];
        return lista.map((item: any) => ({
          id: String(item.id),
          numero_pedido: item.numero_pedido || `PED-${item.id}`,
          nombre_contacto: item.proveedores?.nombre_comercial || 'Tienda Aliada',
          direccion: item.direcciones?.direccion || 'Dirección registrada',
          fecha: item.fecha_programada || item.fecha_creacion,
          estado: item.estados_pedido?.nombre || item.estado || 'pendiente',
          destinatario_id: 2, // Usuario de la tienda (Carlos por defecto)
        }));
      } else {
        const { data } = await apiClient.get<unknown>('/api/pedidos/tienda');
        const lista = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data || [];
        return lista.map((item: any) => ({
          id: String(item.id),
          numero_pedido: item.numero_pedido || `PED-${item.id}`,
          nombre_contacto: item.usuarios
            ? `${item.usuarios.nombre} ${item.usuarios.apellido || ''}`.trim()
            : (item.cliente_nombre || 'Cliente'),
          direccion: item.direcciones?.direccion || item.direccion?.calle || 'Dirección registrada',
          fecha: item.fecha_programada || item.fecha_creacion,
          estado: item.estados_pedido?.nombre || item.estado || 'pendiente',
          destinatario_id: Number(item.cliente_id || item.usuarios?.id || 5),
        }));
      }
    },
    enabled: Boolean(usuario),
  });

  // Auto-seleccionar el primer pedido cuando cargan
  useEffect(() => {
    if (pedidos.length > 0 && !pedidoSeleccionadoId) {
      setPedidoSeleccionadoId(pedidos[0].id);
    }
  }, [pedidos, pedidoSeleccionadoId]);

  const pedidoActual = pedidos.find((p) => p.id === pedidoSeleccionadoId);

  return (
    <div className="flex h-[calc(100vh-8.5rem)] rounded-xl border border-border overflow-hidden bg-card shadow-sm">
      {/* Lista de pedidos */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border bg-muted/20">
          <h2 className="text-sm font-bold text-foreground">
            {esCliente ? 'Conversaciones con Tiendas' : 'Bandeja de Mensajes'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading ? 'Cargando pedidos...' : `${pedidos.length} pedido(s) con chat disponible`}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))
          ) : pedidos.length === 0 ? (
            <EmptyState
              title="Sin pedidos registrados"
              description={
                esCliente
                  ? 'Tus conversaciones aparecerán cuando realices un pedido.'
                  : 'Los pedidos recibidos por tu tienda aparecerán aquí para chatear.'
              }
              icon={<Package className="h-8 w-8 text-muted-foreground" />}
              className="py-12"
            />
          ) : (
            pedidos.map((p) => (
              <ChatPedidoItem
                key={p.id}
                pedido={p}
                isSelected={p.id === pedidoSeleccionadoId}
                onClick={() => setPedidoSeleccionadoId(p.id)}
                esCliente={esCliente}
              />
            ))
          )}
        </div>
      </div>

      {/* Panel de chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {pedidoActual ? (
          <>
            {/* Header del chat */}
            <div className="p-3.5 border-b border-border bg-card flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">
                    {pedidoActual.nombre_contacto}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Pedido #{pedidoActual.numero_pedido} • {pedidoActual.direccion}
                  </p>
                </div>
              </div>

              <span
                className={`hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getEstadoColor(
                  pedidoActual.estado as EstadoPedido
                )}`}
              >
                {getEstadoLabel(pedidoActual.estado as EstadoPedido)}
              </span>
            </div>

            <PanelMensajes key={pedidoActual.id} pedido={pedidoActual} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <EmptyState
              title="Seleccioná un pedido"
              description="Hacé clic en un pedido de la lista lateral para ver o enviar mensajes en tiempo real."
              icon={<MessageSquare className="h-12 w-12 text-muted-foreground" />}
            />
          </div>
        )}
      </div>
    </div>
  );
}

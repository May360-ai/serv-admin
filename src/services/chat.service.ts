import { apiClient } from '@/lib/api-client';
import type { MensajeChat, CrearMensajeRequest } from '@/types';

function normalizarMensaje(m: unknown): MensajeChat {
  const item = m as Record<string, unknown>;
  const usuarioRel = (item.usuarios_chat_mensajes_remitente_idTousuarios || {}) as Record<string, unknown>;
  return {
    id: String(item.id ?? ''),
    pedido_id: String(item.pedido_id ?? ''),
    autor_id: String(item.remitente_id || item.autor_id || ''),
    autor_nombre: (item.autor_nombre || usuarioRel.nombre || 'Usuario') as string,
    autor_rol: (item.autor_rol || 'tienda') as MensajeChat['autor_rol'],
    contenido: (item.contenido || item.mensaje || '') as string,
    created_at: (item.created_at || item.fecha_envio || new Date().toISOString()) as string,
  };
}

export const chatService = {
  async obtenerMensajes(pedido_id: string): Promise<MensajeChat[]> {
    const { data } = await apiClient.get<unknown>(
      `/api/chat/pedido/${pedido_id}`
    );
    const lista = Array.isArray(data)
      ? data
      : (data as { data?: unknown[] })?.data || [];
    return lista.map(normalizarMensaje);
  },

  async enviarMensaje(body: CrearMensajeRequest): Promise<MensajeChat> {
    const payload = {
      pedido_id: Number(body.pedido_id),
      destinatario_id: Number(body.destinatario_id || 1),
      mensaje: body.contenido,
    };
    const { data } = await apiClient.post<unknown>('/api/chat', payload);
    const obj = (data as { data?: unknown }).data ?? data;
    return normalizarMensaje(obj);
  },
};

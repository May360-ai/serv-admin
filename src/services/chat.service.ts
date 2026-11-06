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
    autor_rol: (item.autor_rol || 'proveedor') as MensajeChat['autor_rol'],
    contenido: (item.contenido || item.mensaje || '') as string,
    created_at: (item.created_at || item.fecha_envio || new Date().toISOString()) as string,
  };
}

export const chatService = {
  async listarPedidos(): Promise<PedidoChat[]> {
    return (await apiClient.get<PedidoChat[]>('/api/chat/pedidos')).data;
  },
  async obtenerMensajes(pedido_id: string, contacto_id?: number): Promise<MensajeChat[]> {
    const { data } = await apiClient.get<unknown>(
      `/api/chat/pedido/${pedido_id}`, { params: { contacto_id } }
    );
    const lista = Array.isArray(data)
      ? data
      : (data as { data?: unknown[] })?.data || [];
    return lista.map(normalizarMensaje);
  },

  async enviarMensaje(body: CrearMensajeRequest): Promise<MensajeChat> {
    const payload = {
      pedido_id: Number(body.pedido_id),
      destinatario_id: Number(body.destinatario_id),
      mensaje: body.contenido,
    };
    const { data } = await apiClient.post<unknown>('/api/chat', payload);
    const obj = (data as { data?: unknown }).data ?? data;
    return normalizarMensaje(obj);
  },
};

export interface ContactoChat { id: number; nombre: string; tipo: 'cliente' | 'tienda' | 'repartidor' }
export interface PedidoChat {
  id: string; numero_pedido: string; direccion: string; fecha: string; estado: string;
  contactos: ContactoChat[];
}

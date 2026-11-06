import { apiClient } from '@/lib/api-client';
import type {
  Pedido,
  CrearPedidoRequest,
  CambiarEstadoRequest,
  FiltrosPedidos,
  PaginatedResponse,
} from '@/types';

const diaEntrega = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' });
const horaEntrega = new Intl.DateTimeFormat('es-EC', {
  timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// Normaliza el formato de un pedido devuelto por la API
function normalizarPedido(p: unknown): Pedido {
  const item = p as Record<string, unknown>;
  const dir = (item.direcciones || item.direccion || {}) as Record<string, unknown>;
  const usr = (item.usuarios || {}) as Record<string, unknown>;
  const est = (item.estados_pedido || {}) as Record<string, unknown>;

  const id = String(item.id ?? '');
  const numero_pedido = (item.numero_pedido || item.codigo_seguimiento || `PED-${id}`) as string;
  const cliente_nombre = (item.cliente_nombre || usr.nombre ? `${usr.nombre || ''} ${usr.apellido || ''}`.trim() : 'Cliente') as string;
  const cliente_telefono = (item.cliente_telefono || usr.telefono || '1122334455') as string;
  const estado = ((typeof item.estado === 'string' ? item.estado : est.nombre) || 'pendiente') as Pedido['estado'];
  const fecha_registro = (item.fecha_registro || item.fecha_creacion || new Date().toISOString()) as string;
  const programada = item.fecha_programada ? new Date(String(item.fecha_programada)) : null;
  const fecha_entrega = String(item.fecha_entrega ?? (programada ? diaEntrega.format(programada) : ''));
  const hora = programada ? horaEntrega.format(programada) : '';
  const monto_total = Number(item.monto_total ?? item.total ?? 0);

  return {
    id,
    numero_pedido,
    ruta_id: item.ruta_id ? String(item.ruta_id) : undefined,
    cliente_id: item.cliente_id ? String(item.cliente_id) : (usr.id ? String(usr.id) : undefined),
    cliente_nombre,
    cliente_telefono,
    estado,
    fecha_registro,
    fecha_entrega,
    ventana_horaria: (item.ventana_horaria as Pedido['ventana_horaria']) || { desde: hora, hasta: hora },
    direccion: {
      id: String(dir.id || '1'),
      calle: (dir.direccion || dir.calle || 'Calle Principal') as string,
      numero: (dir.numero || '123') as string,
      ciudad: (dir.ciudad || 'Buenos Aires') as string,
      zona_id: (dir.zona_id || '1') as string,
      referencia: (dir.referencia || '') as string,
      latitud: Number(dir.latitud || -34.6037),
      longitud: Number(dir.longitud || -58.3816),
    },
    zona_id: String(item.zona_id || dir.zona_id || ''),
    tienda_id: String(item.proveedor_id || item.tienda_id || '1'),
    notas: (item.notas || item.instrucciones_especiales || '') as string,
    monto_total,
    pago_confirmado: Boolean(item.pago_confirmado || (item.pagos && (item.pagos as Record<string, unknown>).estado === 'completado')),
    ultimo_minuto: Boolean(item.ultimo_minuto ?? (programada && diaEntrega.format(new Date(fecha_registro)) === fecha_entrega)),
    created_at: fecha_registro,
    updated_at: fecha_registro,
  };
}

export const pedidosService = {
  /**
   * Obtiene los pedidos de la tienda autenticada.
   * Compatible con respuestas en array directo o paginadas.
   */
  async listarPedidosTienda(
    filtros?: FiltrosPedidos
  ): Promise<PaginatedResponse<Pedido>> {
    const params = new URLSearchParams();
    if (filtros?.estado) params.set('estado', filtros.estado);
    if (filtros?.fecha) params.set('fecha', filtros.fecha);

    const { data } = await apiClient.get<unknown>(
      `/api/pedidos/tienda?${params.toString()}`
    );

    const listaCruda = Array.isArray(data)
      ? data
      : (data as { data?: unknown[] })?.data || [];

    const listaNormalizada = listaCruda.map(normalizarPedido);

    return {
      data: listaNormalizada,
      total: listaNormalizada.length,
      pagina: 1,
      por_pagina: listaNormalizada.length,
    };
  },

  /**
   * Obtiene todos los pedidos para el despachador.
   * Con fallback defensivo a /api/pedidos/tienda si /api/pedidos no existe.
   */
  async listarTodosPedidos(
    filtros?: FiltrosPedidos
  ): Promise<PaginatedResponse<Pedido>> {
    try {
      const params = new URLSearchParams();
      if (filtros?.estado) params.set('estado', filtros.estado);
      if (filtros?.fecha) params.set('fecha', filtros.fecha);

      const { data } = await apiClient.get<unknown>(
        `/api/pedidos?${params.toString()}`
      );

      const listaCruda = Array.isArray(data)
        ? data
        : (data as { data?: unknown[] })?.data || [];

      const listaNormalizada = listaCruda.map(normalizarPedido);

      return {
        data: listaNormalizada,
        total: listaNormalizada.length,
        pagina: 1,
        por_pagina: listaNormalizada.length,
      };
    } catch {
      // Fallback a los pedidos de la tienda
      return this.listarPedidosTienda(filtros);
    }
  },

  /**
   * Obtiene un pedido por ID.
   */
  async obtenerPedido(id: string): Promise<Pedido> {
    const { data } = await apiClient.get<unknown>(`/api/pedidos/${id}`);
    const obj = (data as { data?: unknown }).data ?? data;
    return normalizarPedido(obj);
  },

  /**
   * Crea un pedido manualmente en mostrador/call center o e-commerce.
   */
  async crearPedido(pedido: CrearPedidoRequest): Promise<Pedido> {
    // Si no viene direccion_id pero viene direccion con calle, registrarla vía /api/datos/direcciones
    let direccion_id = (pedido as unknown as { direccion_id?: number }).direccion_id;
    if (!direccion_id && pedido.direccion?.calle) {
      try {
        const { data: dirData } = await apiClient.post<{ id: number }>('/api/datos/direcciones', {
          nombre_ubicacion: 'Entrega Pedido',
          direccion: `${pedido.direccion.calle} ${pedido.direccion.numero || ''}`.trim(),
          referencia: pedido.direccion.referencia || '',
          ciudad: pedido.direccion.ciudad || 'Buenos Aires',
          latitud: pedido.direccion.latitud || null,
          longitud: pedido.direccion.longitud || null,
          es_principal: false,
        });
        direccion_id = dirData.id;
      } catch {
        // Continuar si la dirección falla
      }
    }

    const payload = {
      proveedor_id: Number(pedido.tienda_id || 1),
      direccion_id: direccion_id ? Number(direccion_id) : undefined,
      fecha_programada: pedido.fecha_entrega,
      instrucciones_especiales: pedido.notas,
      items_comprados: (pedido as unknown as { items_comprados?: unknown[] }).items_comprados || [],
    };

    const { data } = await apiClient.post<unknown>('/api/pedidos', payload);
    const obj = (data as { data?: unknown; pedido?: unknown }).data ?? (data as { pedido?: unknown }).pedido ?? data;
    return normalizarPedido(obj);
  },

  /**
   * Cambia el estado de un pedido.
   * Envía tanto 'nuevo_estado' (backend original) como 'estado'.
   */
  async cambiarEstado(
    id: string,
    body: CambiarEstadoRequest
  ): Promise<Pedido> {
    const payload = {
      nuevo_estado: body.estado,
      estado: body.estado,
    };

    const { data } = await apiClient.patch<unknown>(
      `/api/pedidos/${id}/estado`,
      payload
    );

    const obj = (data as { data?: unknown; pedido?: unknown }).data ?? (data as { pedido?: unknown }).pedido ?? data;
    return normalizarPedido(obj);
  },
};

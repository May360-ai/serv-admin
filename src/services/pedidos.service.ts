import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import type { Pedido, CrearPedidoRequest, CambiarEstadoRequest, FiltrosPedidos, PaginatedResponse, Usuario } from '@/types';
import type { ItemCatalogo } from './items.service';
import { ContratoPedidosError, validarPedido } from './pedidos-contrato';

const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' });
const hora = new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const idSchema = z.number().int().positive();
const fechaSchema = z.string().refine(value => Number.isFinite(+new Date(value)), 'Fecha de API inválida');
const pedidoSchema = z.object({
  id: idSchema, proveedor_id: idSchema, cliente_id: idSchema.optional(),
  codigo_seguimiento: z.string().nullable().optional(), ruta_id: z.string().nullable().optional(),
  total: z.union([z.number(), z.string()]).refine(value => Number.isFinite(Number(value))),
  fecha_creacion: fechaSchema, fecha_programada: fechaSchema.nullable().optional(),
  instrucciones_especiales: z.string().nullable().optional(),
  estados_pedido: z.object({ nombre: z.enum(['pendiente', 'aceptado', 'agendado', 'en_progreso', 'en_camino', 'completado', 'cancelado']) }),
  usuarios: z.object({ nombre: z.string(), apellido: z.string().nullable().optional(), telefono: z.string().nullable().optional() }).optional(),
  direcciones: z.object({ id: idSchema, direccion: z.string(), ciudad: z.string(), zona_id: idSchema.nullable().optional(),
    referencia: z.string().nullable().optional(),
    latitud: z.union([z.string(), z.number()]).nullable().optional(),
    longitud: z.union([z.string(), z.number()]).nullable().optional(),
  }).nullable().optional(),
});

function normalizarPedido(value: unknown): Pedido {
  const result = pedidoSchema.safeParse(value);
  if (!result.success) throw new Error('Respuesta de pedidos inesperada');
  const p = result.data;
  const dir = p.direcciones;
  const programada = p.fecha_programada ? new Date(p.fecha_programada) : null;
  const fecha = programada ? dia.format(programada) : '';
  const horario = programada ? hora.format(programada) : '';
  return {
    id: String(p.id), numero_pedido: p.codigo_seguimiento || `PED-${p.id}`,
    ruta_id: p.ruta_id || undefined, cliente_id: p.cliente_id ? String(p.cliente_id) : undefined,
    cliente_nombre: p.usuarios ? [p.usuarios.nombre, p.usuarios.apellido].filter(Boolean).join(' ') : 'No informado',
    cliente_telefono: p.usuarios?.telefono ?? '', estado: p.estados_pedido.nombre,
    fecha_registro: p.fecha_creacion, fecha_entrega: fecha,
    ventana_horaria: { desde: horario, hasta: horario },
    direccion: {
      id: dir ? String(dir.id) : '', calle: dir?.direccion ?? '', numero: '', ciudad: dir?.ciudad ?? '',
      zona_id: dir?.zona_id ? String(dir.zona_id) : '', referencia: dir?.referencia ?? '',
      latitud: dir?.latitud != null ? Number(dir.latitud) : undefined,
      longitud: dir?.longitud != null ? Number(dir.longitud) : undefined,
    },
    zona_id: dir?.zona_id ? String(dir.zona_id) : '', tienda_id: String(p.proveedor_id),
    notas: p.instrucciones_especiales ?? '', monto_total: Number(p.total), pago_confirmado: false,
    ultimo_minuto: Boolean(fecha && dia.format(new Date(p.fecha_creacion)) === fecha),
    created_at: p.fecha_creacion, updated_at: p.fecha_creacion,
  };
}

async function listar(endpoint: string, filtros?: FiltrosPedidos): Promise<PaginatedResponse<Pedido>> {
  const { data } = await apiClient.get<unknown>(endpoint);
  if (!Array.isArray(data)) throw new Error('Respuesta de pedidos inesperada: se esperaba un arreglo');
  const pedidos = data.map(normalizarPedido).filter(p => {
    const texto = filtros?.busqueda?.trim().toLocaleLowerCase();
    return (!filtros?.estado || p.estado === filtros.estado) && (!filtros?.fecha || p.fecha_entrega === filtros.fecha) &&
      (!filtros?.zona_id || p.zona_id === filtros.zona_id) &&
      (!texto || `${p.numero_pedido} ${p.cliente_nombre} ${p.direccion.calle}`.toLocaleLowerCase().includes(texto));
  });
  return { data: pedidos, total: pedidos.length, pagina: 1, por_pagina: pedidos.length };
}

export const pedidosService = {
  listarPedidosTienda(filtros?: FiltrosPedidos) {
    const params = new URLSearchParams();
    if (filtros?.estado) params.set('estado', filtros.estado);
    return listar(`/api/pedidos/tienda${params.size ? `?${params}` : ''}`, filtros);
  },
  listarPedidosCliente(filtros?: FiltrosPedidos) {
    return listar('/api/pedidos/mis-pedidos', filtros);
  },
  listarPedidosPorRol(rol: Usuario['rol'] | undefined, filtros?: FiltrosPedidos) {
    if (rol === 'cliente') return this.listarPedidosCliente(filtros);
    if (rol === 'proveedor') return this.listarPedidosTienda(filtros);
    throw new ContratoPedidosError(rol === 'admin' || rol === 'administrador'
      ? 'La API no ofrece un listado global de pedidos para administración.'
      : 'Tu sesión no permite consultar este listado de pedidos.');
  },
  async cambiarEstado(id: string, body: CambiarEstadoRequest): Promise<Pedido> {
    const { data } = await apiClient.patch<{ pedido: unknown }>(`/api/pedidos/${id}/estado`, { nuevo_estado: body.estado });
    return normalizarPedido(data.pedido);
  },
};

/** Conserva las direcciones confirmadas solo durante la vida del formulario/sesión. */
export function crearRegistroPedido(clienteId?: string) {
  const direccionesConfirmadas = new Map<string, number>();
  let confirmacionPendiente = false;
  let enCurso = false;
  return async (datos: CrearPedidoRequest, usuario: Usuario | null, catalogo: ItemCatalogo[]): Promise<Pedido> => {
    if (usuario?.rol !== 'cliente') throw new ContratoPedidosError('Solo el cliente autenticado puede crear sus propios pedidos.');
    if (confirmacionPendiente) throw new Error('La respuesta anterior no permitió confirmar el pedido. Revisa Mis pedidos antes de volver a registrarlo.');
    if (enCurso) throw new Error('Ya hay un registro en curso. Espera su resultado antes de reintentar.');
    const { pedido, fecha_programada } = validarPedido(datos, catalogo);
    enCurso = true;
    try {
      const clave = JSON.stringify([clienteId, usuario.id, pedido.direccion]);
      let direccionId = direccionesConfirmadas.get(clave);
      if (direccionId == null) {
        const { data } = await apiClient.post<unknown>('/api/datos/direcciones', { ...pedido.direccion, es_principal: false });
        const response = z.object({ id: idSchema }).safeParse(data);
        if (!response.success) {
          confirmacionPendiente = true;
          throw new Error('La respuesta no permite confirmar la dirección registrada. Revisa el registro antes de reintentar.');
        }
        direccionId = response.data.id;
        direccionesConfirmadas.set(clave, direccionId);
      }
      const { data } = await apiClient.post<unknown>('/api/pedidos', {
        proveedor_id: pedido.proveedor_id, direccion_id: direccionId,
        items_comprados: pedido.items_comprados, fecha_programada,
        instrucciones_especiales: pedido.instrucciones_especiales,
      });
      const response = z.object({ pedido: pedidoSchema }).safeParse(data);
      if (!response.success) {
        confirmacionPendiente = true;
        throw new Error('Respuesta de creación inesperada. Revisa Mis pedidos antes de volver a registrarlo.');
      }
      return normalizarPedido(response.data.pedido);
    } finally {
      enCurso = false;
    }
  };
}

import type { Pedido, Ruta } from '@/types';

export interface RepartidorActivo {
  id: string;
  nombre: string;
  apellido?: string | null;
  telefono?: string | null;
}

export interface AsignacionRepartidor {
  id: string;
  fecha_entrega: string;
  repartidor_id: string;
}

// Solo se utiliza con el listado global del administrador, sin filtro de zona.
export function repartidoresElegibles(
  activos: RepartidorActivo[], asignaciones: AsignacionRepartidor[], ruta: Ruta,
): RepartidorActivo[] {
  if (ruta.estado !== 'armando') return [];
  return activos.filter(rep => rep.id !== String(ruta.repartidor_id) && !asignaciones.some(
    asignacion => asignacion.fecha_entrega === ruta.fecha_entrega &&
      asignacion.id !== ruta.id && asignacion.repartidor_id === rep.id,
  ));
}

// Refleja obtener() y asignarPedido() del backend. El servidor vuelve a validar al guardar.
export function esRutaCompatible(pedido: Pedido, ruta: Ruta): boolean {
  return !pedido.ruta_id && ['pendiente', 'aceptado'].includes(pedido.estado) &&
    ruta.estado === 'armando' && Boolean(pedido.zona_id && pedido.tienda_id && pedido.fecha_entrega) &&
    ruta.proveedor_id != null && String(ruta.proveedor_id) === String(pedido.tienda_id) &&
    String(ruta.zona_id) === String(pedido.zona_id) && ruta.fecha_entrega === pedido.fecha_entrega &&
    Number.isInteger(ruta.capacidad_maxima) && ruta.capacidad_maxima > 0 &&
    ruta.pedidos.length < ruta.capacidad_maxima;
}

export function mensajeErrorDespacho(error: Error): string {
  // El cliente HTTP compartido conserva el mensaje, pero no el código HTTP.
  const conflictos = ['Pedido ya asignado o ruta llena', 'La ruta ya salió', 'Repartidor no disponible'];
  return conflictos.includes(error.message)
    ? `Conflicto de asignación: ${error.message}. Actualiza las opciones y vuelve a intentarlo.`
    : error.message;
}

// Tipos completos del sistema SERV - Gestión de Entregas y Rutas

export type EstadoPedido =
  | 'pendiente'
  | 'aceptado'
  | 'agendado'
  | 'en_progreso'
  | 'en_camino'
  | 'completado'
  | 'cancelado';

export type EstadoRepartidor = 'disponible' | 'en_ruta' | 'inactivo';

export type RolUsuario = 'admin' | 'administrador' | 'proveedor' | 'cliente' | 'repartidor';
export type { Role, User } from './auth';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  proveedor_id?: string | number | null;
  token?: string;
}

export interface Zona {
  id: string;
  nombre: string;
  descripcion?: string;
  color: string;
  capacidad_maxima: number;
  pedidos_count?: number;
  activa: boolean;
  created_at: string;
}

export interface DireccionEntrega {
  id: string;
  calle: string;
  numero: string;
  ciudad: string;
  zona_id: string;
  zona?: Zona;
  referencia?: string;
  latitud: number;
  longitud: number;
}

export interface VentanaHoraria {
  desde: string; // "09:00"
  hasta: string; // "13:00"
}

export interface Pedido {
  id: string;
  numero_pedido: string;
  cliente_id?: string;
  cliente_nombre: string;
  cliente_telefono: string;
  estado: EstadoPedido;
  fecha_registro: string; // ISO 8601
  fecha_entrega: string;  // ISO 8601 - día de entrega
  ventana_horaria: VentanaHoraria;
  direccion: DireccionEntrega;
  zona_id: string;
  zona?: Zona;
  tienda_id: string;
  ruta_id?: string;
  ruta?: Ruta;
  orden_en_ruta?: number; // Parada 1, 2, 3...
  notas?: string;
  monto_total: number;
  pago_confirmado: boolean;
  ultimo_minuto: boolean; // Flag para pedidos de último momento
  created_at: string;
  updated_at: string;
}

export interface Repartidor {
  id: string;
  nombre: string;
  telefono: string;
  estado: EstadoRepartidor;
  vehiculo?: string;
  foto_url?: string;
}

export interface Ruta {
  id: string;
  nombre: string;
  fecha_entrega: string;
  zona_id: string;
  zona?: Zona;
  repartidor_id?: string;
  repartidor?: Repartidor;
  pedidos: Pedido[];
  capacidad_maxima: number; // por defecto 4
  estado: 'armando' | 'lista' | 'en_camino' | 'completada';
  created_at: string;
  updated_at: string;
}

export interface MensajeChat {
  id: string;
  pedido_id: string;
  autor_id: string;
  autor_nombre: string;
  autor_rol: RolUsuario;
  contenido: string;
  created_at: string;
}

export interface Tienda {
  id: string;
  nombre_comercial: string;
  email: string;
  telefono: string;
  logo_url?: string;
  direccion?: string;
  activa: boolean;
}

export interface HorarioTienda {
  dia_semana: number; // 0=Domingo, 6=Sábado
  apertura: string;
  cierre: string;
  activo: boolean;
}

export interface Pago {
  id: string;
  pedido_id: string;
  monto: number;
  metodo: 'efectivo' | 'transferencia' | 'tarjeta';
  confirmado: boolean;
  confirmado_at?: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion?: string;
}

// ---- DTOs y Request Bodies ----

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

export interface RegistroRequest {
  nombre: string;
  email: string;
  password: string;
  nombre_comercial?: string;
  rol?: RolUsuario;
}

export interface CrearPedidoRequest {
  cliente_nombre: string;
  cliente_telefono: string;
  fecha_entrega: string;
  ventana_horaria: VentanaHoraria;
  zona_id: string;
  direccion: Omit<DireccionEntrega, 'id' | 'zona'>;
  notas?: string;
  monto_total: number;
}

export interface CambiarEstadoRequest {
  estado: EstadoPedido;
}

export interface AgregarPedidoARutaRequest {
  pedido_id: string;
  ruta_id: string;
  orden?: number;
}

export interface TransferirPedidoRequest {
  pedido_id: string;
  ruta_origen_id: string;
  ruta_destino_id: string;
}

export interface ArmarRutasRequest {
  fecha_entrega: string;
  zona_id?: string;
}

export interface ArmarRutasResponse {
  rutas_creadas: number;
  pedidos_asignados: number;
  rutas: Ruta[];
}

export interface CrearMensajeRequest {
  pedido_id: string;
  contenido: string;
  destinatario_id?: string | number;
}

// ---- Respuestas API genéricas ----

export interface ApiResponse<T> {
  data: T;
  mensaje?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

// ---- Filtros ----

export interface FiltrosPedidos {
  estado?: EstadoPedido;
  fecha?: string;
  zona_id?: string;
  busqueda?: string;
}

export interface FiltrosRutas {
  fecha_entrega: string;
  zona_id?: string;
}

// ---- Métricas Dashboard ----

export interface MetricasDashboard {
  pedidos_hoy: number;
  pedidos_pendientes: number;
  pedidos_en_camino: number;
  pedidos_completados: number;
  rutas_activas: number;
  repartidores_disponibles: number;
  ingresos_hoy: number;
}

// ---- Eventos Socket ----

export interface SocketEventMap {
  mensaje_recibido: MensajeChat;
  nuevo_mensaje: unknown;
  estado_pedido_actualizado: { pedido_id: string; estado: EstadoPedido };
  ruta_actualizada: Ruta;
  repartidor_estado_actualizado: { repartidor_id: string; estado: EstadoRepartidor };
}

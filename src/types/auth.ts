// Definiciones de tipos para Control de Acceso Basado en Roles (RBAC) - SERV

// Roles soportados (soporta 'admin' y 'administrador' como equivalentes)
export type Role = 'admin' | 'administrador' | 'proveedor' | 'cliente' | 'repartidor';

export interface User {
  id: string;
  nombre: string;
  apellido?: string;
  email: string;
  rol: Role;
  tienda_id?: string | null;
  telefono?: string;
  token?: string;
}

export interface JWTPayload {
  id: number | string;
  rol_nombre: Role;
  proveedor_id?: number | string | null;
  iat?: number;
  exp?: number;
}

// Rutas de administración
const RUTAS_ADMIN = [
  '/admin',
  '/admin/zonas',
  '/admin/repartidores',
  '/admin/tiendas',
  '/admin/metricas',
  '/dashboard',
  '/zonas',
  '/chat',
] as const;

// Configuración de rutas permitidas por cada rol
export const ROLE_ROUTES: Record<Role, readonly string[]> = {
  admin: RUTAS_ADMIN,
  administrador: RUTAS_ADMIN,
  proveedor: [
    '/tienda',
    '/tienda/catalogo',
    '/tienda/pedidos',
    '/tienda/rutas',
    '/tienda/configuracion',
    '/dashboard',
    '/pedidos',
    '/rutas',
    '/chat',
  ],
  cliente: [
    '/catalogo',
    '/mis-pedidos',
    '/seguimiento',
    '/checkout',
    '/chat',
  ],
  repartidor: [
    '/rutas',
    '/chat',
  ],
} as const;

// Ruta de aterrizaje predeterminada según rol
export const DEFAULT_ROLE_REDIRECT: Record<Role, string> = {
  admin: '/admin/metricas',
  administrador: '/admin/metricas',
  proveedor: '/tienda/rutas',
  cliente: '/catalogo',
  repartidor: '/rutas',
};

// Rutas públicas que no requieren autenticación
export const PUBLIC_ROUTES: readonly string[] = [
  '/',
  '/login',
  '/registro',
  '/unauthorized',
];

// Cuentas de la base de PRUEBAS (prisma/seed-ape.js del repo Serv). Se pueden cambiar por variables de entorno.
// No pongas aquí las cuentas reales de producción.
export type Rol = 'admin' | 'tienda' | 'cliente' | 'repartidor';

export const CLAVE = process.env.E2E_PASSWORD ?? process.env.NEXT_PUBLIC_SERV_DEMO_PASSWORD ?? 'password123';

export const CUENTAS: Record<Rol, string> = {
  admin: process.env.E2E_ADMIN ?? 'admin@serv.com',
  tienda: process.env.E2E_TIENDA ?? 'tienda@serv.com',
  cliente: process.env.E2E_CLIENTE ?? 'cliente@serv.com',
  repartidor: process.env.E2E_REPARTIDOR ?? 'repartidor@serv.com',
};

/** Nombre comercial de la tienda de E2E_TIENDA, para buscar sus productos en el catálogo. */
export const NOMBRE_TIENDA = process.env.E2E_TIENDA_NOMBRE ?? 'Florería San Valentín';

/** Repartidores de la base de pruebas: el armado de rutas puede asignar cualquiera de ellos. */
export const REPARTIDORES = (process.env.E2E_REPARTIDORES ?? 'repartidor@serv.com,repartidor2@serv.com,repartidor3@serv.com').split(',');

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

/** Punto de entrega del cliente: debe caer dentro de UNA zona activa de la base de pruebas. */
export const PUNTO_ENTREGA = {
  latitude: Number(process.env.E2E_LAT ?? -1.249),
  longitude: Number(process.env.E2E_LNG ?? -78.615),
};

export const estadoSesion = (rol: Rol) => `e2e/.auth/${rol}.json`;

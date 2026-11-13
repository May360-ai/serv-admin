# SERV · Aplicación web

## Cómo ejecutar

Con `Serv` en `http://localhost:4000` y `NEXT_PUBLIC_API_URL=http://localhost:4000` en `.env.local`:

```powershell
cd serv-admin
npm install
npm run dev
```

Panel en `http://localhost:3000`. `npm test` para pruebas. `npm run build` + `npm start` para producción.

## Dónde trabajar

- `src/app` define las URLs y los layouts. Las rutas de tienda y repartidor que muestran despacho comparten la misma pantalla.
- `src/features/despacho` reúne la pantalla de despacho, el tablero, los ajustes manuales, las consultas, el servicio HTTP y el estado de sus filtros.
- `src/components/layout` contiene la navegación por rol y el selector de apariencia. Los controles compartidos viven en `src/components/ui`.
- `src/app/globals.css` define los colores de ambos temas.
- Los demás módulos usan `src/services`, `src/hooks` y `src/store`. La conexión HTTP común vive en `src/lib/api-client.ts`.

## Entregas y chat

En **Mis entregas**, cada parada permite contactar al cliente o a la tienda. El enlace abre el pedido y el interlocutor correctos. En **Chat de pedido** también se puede cambiar de contacto; el historial y los eventos en tiempo real se limitan al remitente y al destinatario.

**Despacho** muestra las entregas atrasadas aunque tengan una ruta asignada. La reprogramación exige una fecha y hora futuras, repartidor y motivo, y conserva el historial. El repartidor puede confirmar entregas atrasadas desde **Mis entregas**.

Antes de actualizar el panel, actualiza la API: necesita `/api/auth/sesion`, `/api/chat/pedidos` y las rutas de reprogramación. Configura `API_URL` si Next.js necesita acceder a la API por una dirección interna diferente de `NEXT_PUBLIC_API_URL`.

Verificación: `npm test`, `npx tsc --noEmit` y `npm run build`.

## Acceso demo en desarrollo

El backend carga los datos base con `npm run seed`. Para crear las cuatro cuentas demo, configura `SERV_DEMO_PASSWORD` en su archivo privado de entorno y ejecuta `npm run seed:demo`. En el frontend, los botones del login aparecen en desarrollo cuando `NEXT_PUBLIC_SERV_DEMO_PASSWORD` en `.env.local` coincide con esa clave. Cualquier persona con acceso a esta web de desarrollo puede usar los cuatro roles, incluido administración. Usa este flujo únicamente en un entorno de demostración.

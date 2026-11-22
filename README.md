# SERV · Aplicación web

## Trabajo con agentes de IA

Lee [CONTEXTO.md](CONTEXTO.md) para conocer el sistema, sus reglas y un mensaje de inicio para tu agente. [AGENTS.md](AGENTS.md) describe los módulos y verificaciones de la web. Si tu herramienta no los carga automáticamente, indícale que lea ambos antes de trabajar. No se requieren chats anteriores ni skills locales de otro integrante.

## Cómo ejecutar

Con `Serv` en `http://localhost:4000` y `NEXT_PUBLIC_API_URL=http://localhost:4000` en `.env.local`:

```powershell
cd serv-admin
npm install
npm run dev
```

Panel en `http://localhost:3000`. `npm test` para pruebas. `npm run build` + `npm start` para producción.

## Dónde trabajar

- `src/app` define las URLs y los layouts. Las rutas de tienda y administración que muestran despacho comparten la misma pantalla. El repartidor no tiene vistas web: trabaja desde la app Android y la web cierra su sesión.
- `src/features/despacho` reúne la pantalla de despacho, el tablero, los ajustes manuales, las consultas, el servicio HTTP y el estado de sus filtros.
- `src/components/layout` contiene la navegación por rol y el selector de apariencia. Los controles compartidos viven en `src/components/ui`.
- `src/app/globals.css` define los colores de ambos temas.
- Los demás módulos usan `src/services`, `src/hooks` y `src/store`. La conexión HTTP común vive en `src/lib/api-client.ts`.

## Entregas y chat

El checkout y Nuevo pedido muestran en el mapa los polígonos de las zonas. El cliente puede usar su GPS o marcar el destino; el servidor determina la zona por ese punto. Una tienda configura sucursales con dirección de retiro, punto en el mapa y zonas que atiende. La API debe actualizarse antes que la web e instalar la migración indicada en el README de la API.

En **Mis entregas**, cada parada permite contactar al cliente o a la tienda. El enlace abre el pedido y el interlocutor correctos. En **Chat de pedido** también se puede cambiar de contacto; el historial y los eventos en tiempo real se limitan al remitente y al destinatario.

**Despacho** muestra las entregas atrasadas aunque tengan una ruta asignada. La reprogramación exige una fecha y hora futuras, repartidor y motivo, y conserva el historial. El repartidor confirma entregas atrasadas desde la app Android.

Antes de actualizar el panel, actualiza la API: necesita `/api/auth/sesion`, `/api/chat/pedidos` y las rutas de reprogramación. Configura `API_URL` si Next.js necesita acceder a la API por una dirección interna diferente de `NEXT_PUBLIC_API_URL`.

Verificación: `npm test`, `npx tsc --noEmit` y `npm run build`.

## Confirmación de entregas

El repartidor confirma entregas desde Android con una ubicación nueva; la API comprueba cercanía, antigüedad y precisión. Despacho ofrece **Confirmaciones de entrega** para autorizar una excepción con motivo y confirmación explícita de recepción, y consultar actor/fecha/motivo de las confirmaciones de las rutas seleccionadas. Completar desde el cambio genérico de estado se retiró para evitar omitir el control. Consulta el README de la API para la migración y los límites configurables.

## Catálogo, perfiles y valoraciones

El catálogo de tienda permite **Editar stock e imagen**. El ajuste exige motivo y compara el stock anterior en la API; si cambió por otra operación, hay que cargar el valor actual y revisarlo. Las imágenes de producto son públicas; las fotos de perfil y comprobantes se leen autenticadas. Cada usuario gestiona su foto desde la barra lateral. Cliente y tienda ven el comprobante en el detalle del pedido.

El catálogo muestra promedio, cantidad y reseñas de producto, con diez reseñas por página desde la API. Solo el cliente que recibió el producto puede guardar o editar su valoración. El detalle de un pedido completado permite valorar a su repartidor; administración consulta el promedio en flota y el repartidor en su perfil.

Catálogo, tiendas y flota presentan doce elementos por página; los listados comunes de pedidos, diez. Es paginación local sobre las respuestas completas, mientras el listado global de administración ya pagina en servidor. El chat recupera los últimos cincuenta mensajes y permite cargar los anteriores por cursor.

Requiere las migraciones `fotos-usuarios-entregas.sql` y `catalogo-stock-resenas.sql` de la API y regenerar Prisma. Consulta su README para contratos y límites de almacenamiento.

## Acceso demo en desarrollo

El backend carga los datos base con `npm run seed`. Para crear las cuatro cuentas demo, configura `SERV_DEMO_PASSWORD` en su archivo privado de entorno y ejecuta `npm run seed:demo`. En el frontend, los botones del login aparecen en desarrollo cuando `NEXT_PUBLIC_SERV_DEMO_PASSWORD` en `.env.local` coincide con esa clave. Cualquier persona con acceso a esta web de desarrollo puede usar los cuatro roles, incluido administración. Usa este flujo únicamente en un entorno de demostración.

## Flujos por rol (22 de noviembre de 2026)

- **Cliente:** el catálogo solo muestra tiendas aprobadas con sucursal activa. El checkout permite reutilizar direcciones, muestra el costo de envío de la zona marcada, exige fecha y hora futuras y envía el método de pago junto con el pedido (efectivo, transferencia o billetera; la tienda confirma el cobro). Los pedidos se consultan en **Mis pedidos**.
- **Tienda:** acepta o rechaza los pedidos pendientes; solo los aceptados entran al despacho. Edita nombre, precio, disponibilidad y stock por variación desde su catálogo. Un aviso indica si la tienda aún no es visible (falta aprobación o sucursal).
- **Administración:** aprueba y suspende tiendas, suspende clientes, edita repartidores, define el costo de envío por zona y ve el despacho global completo (todas las páginas de pedidos sin ruta).

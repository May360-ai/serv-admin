# Contexto de SERV para el equipo y sus agentes

Revisado el 22 de noviembre de 2026 contra el código de los tres repositorios. Esta es una foto del sistema, no una lista de tareas pendientes. Confirma el comportamiento en el código y actualiza esta guía cuando cambie una regla compartida.

## Qué construimos

SERV gestiona pedidos y su entrega: el cliente hace un pedido, la tienda lo prepara y organiza el despacho por fecha y zona, y el repartidor avanza las paradas desde Android. La tienda consulta estados y seguimiento. El proyecto incluye administración de tiendas, zonas y repartidores, chat de pedido, pagos, reprogramaciones e intentos fallidos.

Roles: cliente, proveedor (tienda), repartidor y administración (admin / administrador). La web atiende a cliente, tienda y administración; el repartidor trabaja solo desde Android y la web cierra su sesión. Todos los endpoints HTTP autenticados y la conexión Socket.IO comprueban que la cuenta siga con estado activo; ocultar un botón no protege una operación.

## Repositorios

| Repositorio | Responsabilidad | Tecnologías |
| --- | --- | --- |
| [Serv](https://github.com/JambatU/Serv) | API, autorización, persistencia y reglas de negocio | Node.js, Express 5, Prisma 6, PostgreSQL en Supabase, Socket.IO |
| [serv-admin](https://github.com/May360-ai/serv-admin) | Web con navegación y operaciones por rol | Next.js 16, React 19, TypeScript, React Query, Zustand, Tailwind, Leaflet |
| [serv-movil](https://github.com/NoMerlyn/serv-movil) | App del repartidor | Kotlin, Jetpack Compose, servicio de ubicación, WebView con Leaflet |

Son repositorios Git independientes; no asumas un monorepo ni rutas absolutas de otro integrante. En móvil, la raíz correcta contiene settings.gradle.kts. La versión móvil híbrida fue retirada: no reconstruirla para resolver tareas de Android.

## Flujo y reglas que deben conservarse

1. Fecha de registro y fecha/hora programada son conceptos distintos. El día operativo usa America/Guayaquil.
2. Solo se despachan pedidos aceptados por la tienda (aceptado, agendado o en_progreso); un pedido pendiente espera su aceptación. El despacho automático del día (al aceptar, cuando un repartidor pasa a disponible y cada SERV_DESPACHO_INTERVALO_S segundos, 60 por defecto) solo toma pedidos sin ruta cuya hora programada cae dentro de SERV_DESPACHO_ANTICIPACION_MIN (120 min por defecto; 15–720); el armado manual de la tienda toma todo el día. El armado agrupa por fecha, zona, tienda y sucursal. La sucursal se elige entre las habilitadas que cubren la zona, por distancia en línea recta al destino; los pedidos antiguos sin sucursal la reciben al armar y, si ninguna cubre su zona, se informan como sin sucursal. Un repartidor puede hacer varias salidas el mismo día, pero solo tiene una ruta abierta a la vez (una en armado por fecha y ninguna otra en_ruta al iniciar). Para hoy o fechas pasadas, el repartidor se elige por distancia en línea recta a la sucursal con GPS activo y actualizado en los últimos 45 segundos, sin ruta en armado ese día ni salida en curso; para fechas futuras (> hoy en America/Guayaquil), entre repartidores activos sin ruta abierta en esa fecha, primero quien tiene menos rutas en los siete días que terminan en esa fecha. Una ruta en armado que se queda sin pedidos se cierra (cerrada) para liberar al repartidor. Si no hay candidatos, el pedido queda sin ruta y el armado lo informa; no se usan posiciones antiguas en despachos del día.
3. Un pedido no debe duplicarse en rutas. Las mutaciones de despacho usan transacciones y un bloqueo compartido de PostgreSQL. Preservar esa protección ante solicitudes simultáneas.
4. Las rutas usan estados armando, en_ruta, completada (todas entregadas) y cerrada (con fallos o sin pedidos). Las entregas avanzan de forma secuencial; el backend valida la transición y el repartidor asignado. La tienda (o administración) acepta, agenda, pone en progreso o rechaza/cancela; el cliente solo cancela mientras el pedido sigue pendiente. Al cancelar (bloqueado si ya está en_camino) se restaura el stock, se desvincula/reordena la ruta y se notifica por Socket.IO.
5. Un intento fallido conserva el motivo y permite seguir con la próxima parada. Reprogramar conserva historial, exige fecha/hora futuras, repartidor y motivo, y deja el pedido como agendado (no pendiente: la tienda ya lo aceptó).
6. La tienda solo opera sobre su propio alcance. El stock se descuenta atómicamente al crear el pedido: de la variación si lleva stock propio, si no del producto. Un repartidor solo modifica sus rutas. Las cuentas inactivas pierden acceso a HTTP y Socket.IO. Cada pedido exige fecha y hora futuras dentro del horario de atención configurado por la tienda (sin horarios no se restringe) y registra su pago pendiente en la misma transacción (efectivo, transferencia o billetera; no hay pasarela de tarjetas). Solo la tienda confirma el cobro (`PATCH /api/pagos/:pedido_id/confirmar`). El costo de envío es el de la zona del destino (zonas.costo_envio).
7. Persistir antes de notificar. Socket.IO autentica con JWT y limita eventos por destinatario/tienda; al recuperar conexión hay que consultar de nuevo el estado.
8. El chat se limita a participantes reales del pedido y al interlocutor seleccionado. Nunca emitir conversaciones a todos los usuarios.

## Seguimiento y recorridos: son funciones distintas

- Completar una entrega exige en la API ubicación de hasta 30 segundos, precisión positiva de hasta 50 m y distancia más precisión dentro de SERV_DELIVERY_CONFIRM_RADIUS_M (150 m por defecto; rango 10–500 m). Android pide una lectura posterior al toque y la web solicita GPS nuevo. Los rechazos conservan el estado. La evidencia queda en pedidos.confirmacion_entrega (JSONB, migración confirmacion-entrega.sql). La tienda propia o administración puede completar excepcionalmente la próxima parada en camino con motivo de 10–500 caracteres desde despacho; queda actor/fecha/motivo. El repartidor no puede autorizarla. El cambio genérico de estado no completa ni reabre entregas finalizadas. La evidencia GPS no se expone en el listado del cliente y el GPS reportado no es una prueba antifraude absoluta.

- Al crear pedidos, el cliente confirma un punto manual o GPS en la web (checkout). La zona se determina por un polígono GeoJSON activo y la API vuelve a validarlo; no se admiten fechas programadas pasadas. Cada tienda administra sucursales activas con punto de retiro y una o más zonas de cobertura. El pedido y su ruta conservan la sucursal elegida.
- La cobertura inicial sigue limitada a un radio configurable de 15 km desde -1.249, -78.615 mediante SERV_DELIVERY_RADIUS_KM. La dirección debe caer además en exactamente un polígono activo; al crear o editar zonas se rechaza el solapamiento con polígonos activos existentes (409 ZONA_SOLAPADA). Las zonas históricas sin polígono deben dibujarse en administración antes de que admitan nuevas direcciones.
- Disponibilidad: el repartidor puede activar «Disponible» en Android antes de tener ruta; la app comparte GPS cada diez segundos con servicio en primer plano y puede detenerlo. Despacho solo asigna en el día con señal de hasta 45 segundos. Al avanzar una entrega a en_camino desde Android con disponibilidad activa, el servicio pasa automáticamente del modo disponibilidad al seguimiento de la ruta activa.
- Salida: tras retirar los pedidos en la sucursal, el repartidor pulsa «Iniciar salida» (`POST /api/rutas/:ruta_id/iniciar`); la ruta pasa a en_ruta y Android empieza a compartir la ubicación sin otro paso. Marcar en camino exige la salida iniciada (409 SALIDA_NO_INICIADA) y no se inicia una segunda salida con otra en curso (409 SALIDA_EN_CURSO). El detalle del pedido indica al repartidor si debe cobrar en efectivo y cuánto, o si el pago lo confirma la tienda.
- Seguimiento: en una ruta activa, Android comparte mediante servicio en primer plano. En armando, la previsualización de recorrido incluye el punto de retiro de la sucursal. Despacho y cliente consultan la ubicación de ruta mientras el pedido esté activo en ruta; la API oculta puntos con más de un minuto sin actualizar.
- Recorrido: Android obtiene su ubicación y muestra el trazado por calles con Leaflet, teselas OpenStreetMap y OSRM. Las teselas dibujan el mapa; OSRM calcula tiempos y geometría. La API OSM v0.6 no es un motor de rutas.
- Las coordenadas específicas del pedido prevalecen sobre las de su dirección. Editar un punto de entrega no modifica la dirección reutilizada por otros pedidos.
- La propuesta optimiza las paradas sin iniciar, conserva las iniciadas y la precedencia de horarios. Búsqueda exacta hasta ocho paradas sin iniciar y heurística para más.
- Consultar o proponer no cambia el orden. Aplicar exige confirmación, propuesta firmada de cinco minutos y validación de estados, puntos y orden vigentes dentro de la transacción.
- Los tiempos son estimaciones de conducción sin tráfico en vivo, atención ni espera. No presentar esto como navegación giro a giro o garantía de puntualidad.
- El OSRM público predeterminado es para pruebas académicas no comerciales, con consultas separadas en esta instancia. Para otros despliegues configurar OSRM_BASE_URL y revisar las condiciones del proveedor. Mantener atribución de OpenStreetMap.
- No hay una cola offline de entregas confirmada. No prometer que una acción quedó guardada sin respuesta del servidor.

## Publicación y administración (22 de noviembre de 2026)

- Una tienda nueva queda pendiente de aprobación (proveedores.es_verificado). El catálogo y el listado público solo muestran tiendas aprobadas, con cuenta activa y al menos una sucursal activa; la web avisa a la tienda qué le falta.
- Administración aprueba o retira la aprobación (`PATCH /api/proveedores/:id/aprobacion`), suspende tiendas (`PATCH /api/proveedores/:id/estado`) y clientes (`/api/clientes`), edita repartidores (`PATCH /api/repartidores/:id`) y puede cambiar el estado de pedidos con las mismas transiciones que la tienda.
- La tienda edita nombre, descripción, precio y disponibilidad de sus productos (`PATCH /api/items/:id`), el stock de cada variación con comparación atómica y auditoría, y consulta su catálogo completo en `GET /api/items/mi-tienda`.
- El cliente reutiliza direcciones confirmadas (`GET /api/datos/direcciones`); registrar una dirección idéntica devuelve la existente.
- `prisma/sql/rutas-vacias-reprogramadas.sql` corrige datos anteriores: cierra rutas en armado sin pedidos y pasa a agendado los pedidos reprogramados que quedaron pendientes dentro de una ruta.
- Migración aditiva `prisma/sql/flujos-roles.sql`: quita la unicidad fecha+repartidor de rutas (deja un índice parcial para una ruta en armado por fecha), agrega zonas.costo_envio y marca como aprobadas las tiendas existentes.

## Dónde comprobar contratos

En Serv, comenzar por src/routes y luego sus controladores, servicios y prisma/schema.prisma. La API sirve bajo /api y usa JWT. Para despacho, revisar rutas.routes.js, rutas.controller.js, services/despacho.js y services/optimizacion.js. Verificar cuerpos y respuestas reales antes de cambiar un consumidor.

Operaciones principales bajo /api/rutas:

| Operación | Acceso |
| --- | --- |
| GET /mis-entregas | Repartidor |
| PATCH /:ruta_id/entregas/:pedido_id | Repartidor asignado |
| POST /:ruta_id/entregas/:pedido_id/fallo | Repartidor asignado |
| PUT /:ruta_id/ubicacion | Repartidor asignado |
| GET /:ruta_id/ubicacion | Tienda de la ruta o administración |
| POST /:ruta_id/recorrido y /:ruta_id/optimizar | Repartidor asignado |
| POST /:ruta_id/aplicar-optimizacion | Repartidor asignado |
| PATCH /:ruta_id/pedidos/:pedido_id/ubicacion | Tienda de la ruta o administración |

Al cambiar un contrato, indicar qué repositorios consumidores requieren actualización. No convertir IDs, coordenadas o fechas por suposición: revisar serialización, modelos y pruebas de ambos lados.

## Entorno y pruebas

Lee README.md y AGENTS.md de este repositorio para instalar y verificar. La API usa Supabase; obtener las variables privadas del responsable por un canal seguro. No usar credenciales personales ajenas, copiar .env al chat ni publicar claves. No ejecutar seeds, migraciones o SQL sobre una base compartida como paso automático de instalación: revisar destino, necesidad y efecto primero.

El SQL de evolución está en Serv/prisma/sql y el esquema en Prisma. Una instalación existente puede necesitar esos cambios; no asumir que prisma generate actualiza la base. No usar reset ni borrar datos para corregir discrepancias.

Las pruebas unitarias no sustituyen pruebas de permisos, concurrencia, red y dispositivos cuando la tarea las afecta. Usar datos ficticios separados; nunca confirmar o fallar entregas reales como prueba. Distinguir en la entrega qué se verificó y qué queda pendiente. El mapa se verificó en emulador; eso no equivale a validación en teléfono físico.

## Cómo empezar con cualquier agente

Si tu herramienta no carga AGENTS.md automáticamente, pega este mensaje al iniciar:

> Lee AGENTS.md, CONTEXTO.md y README.md de este repositorio. Revisa el código relacionado antes de editar. Mi tarea es: [describir tarea y resultado esperado]. Identifica contratos afectados en otros repositorios, conserva las reglas de autorización y despacho, implementa el cambio mínimo completo y ejecuta las verificaciones pertinentes. Al finalizar, enumera archivos cambiados, pruebas ejecutadas y limitaciones. No inventes requisitos ni credenciales. Si necesitas documentos académicos que no están en el repositorio, indícalo.

Para repartir tareas, delimitar por módulo y contrato: por ejemplo, API de flota, pantalla web de flota o presentación Android. Coordinar primero si dos tareas cambian el mismo endpoint o esquema. Trabajar en ramas por tarea y revisar el diff antes de integrar.

Esta guía existe en los tres repositorios para que funcione con clones independientes. Cuando cambie una regla compartida, actualizar sus tres copias. No depende del historial de un chat, skills locales ni archivos de otra computadora. Los documentos académicos originales no se incluyen aquí; esta guía describe el código verificado y no reemplaza sus requisitos.

## Fotos, catálogo, pagos y valoraciones (21 de noviembre de 2026)

Android organiza el trabajo en Mapa, Pedidos y Ayuda, con refresco silencioso periódico y cierre de sesión únicamente ante códigos de autenticación de la API (TOKEN_REQUERIDO, TOKEN_INVALIDO, CUENTA_INACTIVA). Oculta las salidas ya terminadas y distingue varias salidas del mismo día por sucursal y número. El detalle muestra cliente, productos, cantidades, referencias e instrucciones; Ayuda permite chatear con la tienda o con el cliente del pedido seleccionado. Las cantidades describen el contenido, no peso ni volumen. Los perfiles admiten una foto propia en web y Android. El repartidor captura un comprobante antes de confirmar: la API lo exige incluso en la excepción de despacho; cliente y tienda lo ven en el detalle. Las pruebas físicas de esta versión Android quedan pendientes por decisión del usuario.

Migraciones aditivas: `fotos-usuarios-entregas.sql`, luego `catalogo-stock-resenas.sql`, regenerar Prisma y reiniciar API. Imágenes binarias de hasta 5 MB, normalizadas a JPEG sin metadatos y hasta 600 KB por foto. Perfil y comprobante requieren autorización; la imagen del producto activo es pública. Los binarios se guardan en tablas BYTEA con RLS y sin acceso directo anon/authenticated; revisar retención y almacenamiento de objetos antes de escalar.

La tienda edita stock e imagen desde su catálogo. Stock exige valor anterior, nuevo entero no negativo y motivo; una comparación atómica rechaza conflictos (409) para no pisar compras simultáneas y registra auditoría. Servicios sin stock físico. El cliente reseña productos recibidos: una valoración editable por producto/cliente, 1–5 y comentario hasta 1000 caracteres. También valora al repartidor de cada pedido completado, conservando la identidad de quien entregó en la evidencia; editar no agrega votos ni sobrescribe la valoración de tienda. Perfil y flota muestran promedio/cantidad.

Paginación de catálogo, tiendas, flota y listados comunes de pedidos en web: recorte local de los datos ya consultados; administración conserva su listado de pedidos paginado en servidor. Android pagina diez pedidos por ruta. Chat pagina 50 mensajes por cursor `antes_de`; reseñas de producto diez por página en servidor. No describir los listados locales como consultas paginadas de base de datos.

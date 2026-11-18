# Contexto de SERV para el equipo y sus agentes

Revisado el 17 de noviembre de 2026 contra el código de los tres repositorios. Esta es una foto del sistema, no una lista de tareas pendientes. Confirma el comportamiento en el código y actualiza esta guía cuando cambie una regla compartida.

## Qué construimos

SERV gestiona pedidos y su entrega: el cliente hace un pedido, la tienda lo prepara y organiza el despacho por fecha y zona, y el repartidor avanza las paradas desde Android. La tienda consulta estados y seguimiento. El proyecto incluye administración de tiendas, zonas y repartidores, chat de pedido, reprogramaciones e intentos fallidos.

Roles: cliente, proveedor (tienda), repartidor y administración. El backend reconoce también el alias admin. La autorización se comprueba en el servidor; ocultar un botón no protege una operación.

## Repositorios

| Repositorio | Responsabilidad | Tecnologías |
| --- | --- | --- |
| [Serv](https://github.com/JambatU/Serv) | API, autorización, persistencia y reglas de negocio | Node.js, Express 5, Prisma 6, PostgreSQL en Supabase, Socket.IO |
| [serv-admin](https://github.com/May360-ai/serv-admin) | Web con navegación y operaciones por rol | Next.js 16, React 19, TypeScript, React Query, Zustand, Tailwind, Leaflet |
| [serv-movil](https://github.com/NoMerlyn/serv-movil) | App del repartidor | Kotlin, Jetpack Compose, servicio de ubicación, WebView con Leaflet |

Son repositorios Git independientes; no asumas un monorepo ni rutas absolutas de otro integrante. En móvil, la raíz correcta contiene settings.gradle.kts. La versión móvil híbrida fue retirada: no reconstruirla para resolver tareas de Android.

## Flujo y reglas que deben conservarse

1. Fecha de registro y fecha/hora programada son conceptos distintos. El día operativo usa America/Guayaquil.
2. El armado agrupa por fecha, zona y tienda, respeta capacidad y disponibilidad de repartidores. Si no puede asignar un pedido, debe quedar pendiente y visible; no inventar repartidores ni asignaciones.
3. Un pedido no debe duplicarse en rutas. Las mutaciones de despacho usan transacciones y un bloqueo compartido de PostgreSQL. Preservar esa protección ante solicitudes simultáneas.
4. Las rutas usan estados armando, en_ruta y cerrada. Las entregas avanzan de forma secuencial; el backend valida la transición y el repartidor asignado.
5. Un intento fallido conserva el motivo y permite seguir con la próxima parada. Reprogramar conserva historial y exige fecha/hora futuras, repartidor y motivo.
6. La tienda solo opera sobre su propio alcance. Un repartidor solo modifica sus rutas. Las cuentas inactivas pierden acceso a sus operaciones.
7. Persistir antes de notificar. Socket.IO autentica con JWT y limita eventos por destinatario/tienda; al recuperar conexión hay que consultar de nuevo el estado.
8. El chat se limita a participantes reales del pedido y al interlocutor seleccionado. Nunca emitir conversaciones a todos los usuarios.

## Seguimiento y recorridos: son funciones distintas

- Completar una entrega exige en la API ubicación de hasta 30 segundos, precisión positiva de hasta 50 m y distancia más precisión dentro de SERV_DELIVERY_CONFIRM_RADIUS_M (150 m por defecto; rango 10–500 m). Android pide una lectura posterior al toque y la web solicita GPS nuevo. Los rechazos conservan el estado. La evidencia queda en pedidos.confirmacion_entrega (JSONB, migración confirmacion-entrega.sql). La tienda propia o administración puede completar excepcionalmente la próxima parada en camino con motivo de 10–500 caracteres desde despacho; queda actor/fecha/motivo. El repartidor no puede autorizarla. El cambio genérico de estado no completa ni reabre entregas finalizadas. La evidencia GPS no se expone en el listado del cliente y el GPS reportado no es una prueba antifraude absoluta.

- Al crear pedidos, el cliente confirma un punto manual o GPS en la web (checkout y Nuevo pedido). La API exige destino propio con coordenadas válidas, ciudad Ambato y zona activa, y copia el punto al pedido. Los históricos no se modifican automáticamente.
- La cobertura inicial es un radio configurable de 15 km desde -1.249, -78.615 mediante SERV_DELIVERY_RADIUS_KM. GET /api/zonas/cobertura publica esa regla para la web. Las zonas no tienen polígonos: este radio no demuestra pertenencia a una zona concreta ni valida semánticamente la dirección.
- Seguimiento: Android comparte GPS mediante un servicio en primer plano con notificación y opción de detener. Despacho consulta la última señal de la ruta; la API oculta puntos con más de un minuto sin actualizar.
- Recorrido: Android obtiene su ubicación y muestra el trazado por calles con Leaflet, teselas OpenStreetMap y OSRM. Las teselas dibujan el mapa; OSRM calcula tiempos y geometría. La API OSM v0.6 no es un motor de rutas.
- Las coordenadas específicas del pedido prevalecen sobre las de su dirección. Editar un punto de entrega no modifica la dirección reutilizada por otros pedidos.
- La propuesta optimiza las paradas sin iniciar, conserva las iniciadas y la precedencia de horarios. Búsqueda exacta hasta ocho paradas sin iniciar y heurística para más.
- Consultar o proponer no cambia el orden. Aplicar exige confirmación, propuesta firmada de cinco minutos y validación de estados, puntos y orden vigentes dentro de la transacción.
- Los tiempos son estimaciones de conducción sin tráfico en vivo, atención ni espera. No presentar esto como navegación giro a giro o garantía de puntualidad.
- El OSRM público predeterminado es para pruebas académicas no comerciales, con consultas separadas en esta instancia. Para otros despliegues configurar OSRM_BASE_URL y revisar las condiciones del proveedor. Mantener atribución de OpenStreetMap.
- No hay una cola offline de entregas confirmada. No prometer que una acción quedó guardada sin respuesta del servidor.

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


## Fotos, catálogo y valoraciones (18 de noviembre de 2026)

Android organiza el trabajo en Mapa, Pedidos y Ayuda. El detalle muestra cliente, productos, cantidades, referencias e instrucciones; Ayuda abre el chat con la tienda que despacha ese pedido. Las cantidades describen el contenido, no peso ni volumen. Los perfiles admiten una foto propia en web y Android. El repartidor captura un comprobante antes de confirmar: la API lo exige incluso en la excepción de despacho; cliente y tienda lo ven en el detalle. Las pruebas físicas de esta versión Android quedan pendientes por decisión del usuario.

Migraciones aditivas: `fotos-usuarios-entregas.sql`, luego `catalogo-stock-resenas.sql`, regenerar Prisma y reiniciar API. Imágenes binarias de hasta 5 MB, normalizadas a JPEG sin metadatos y hasta 600 KB por foto. Perfil y comprobante requieren autorización; la imagen del producto activo es pública. Los binarios se guardan en tablas BYTEA con RLS y sin acceso directo anon/authenticated; revisar retención y almacenamiento de objetos antes de escalar.

La tienda edita stock e imagen desde su catálogo. Stock exige valor anterior, nuevo entero no negativo y motivo; una comparación atómica rechaza conflictos (409) para no pisar compras simultáneas y registra auditoría. Servicios sin stock físico. El cliente reseña productos recibidos: una valoración editable por producto/cliente, 1–5 y comentario hasta 1000 caracteres. También valora al repartidor de cada pedido completado, conservando la identidad de quien entregó en la evidencia; editar no agrega votos ni sobrescribe la valoración de tienda. Perfil y flota muestran promedio/cantidad.

Paginación de catálogo, tiendas, flota y listados comunes de pedidos en web: recorte local de los datos ya consultados; administración conserva su listado de pedidos paginado en servidor. Android pagina diez pedidos por ruta. Chat pagina 50 mensajes por cursor `antes_de`; reseñas de producto diez por página en servidor. No describir los listados locales como consultas paginadas de base de datos.

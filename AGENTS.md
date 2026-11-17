# Instrucciones para agentes: web SERV

Lee [CONTEXTO.md](CONTEXTO.md) y [README.md](README.md). La API y Android están en repositorios independientes.

## Mapa del código

- src/app: URLs, layouts y páginas por rol.
- src/features/despacho: pantalla compartida, tablero, consultas, filtros, mapa de seguimiento y editor de puntos de entrega.
- src/components/ui y src/components/layout: controles compartidos y navegación.
- src/lib/api-client.ts: cliente HTTP común; src/types: contratos.
- src/services, src/hooks y src/store: otros módulos, consultas y estado.
- src/app/globals.css: temas. Mantén contraste, foco, estados y adaptación a móvil.
- test: pruebas con node:test.

## Antes de cambiar

- Lee la documentación de la versión instalada de Next.js indicada abajo antes de editar código.
- Reutiliza componentes y patrones existentes. Usa el cliente HTTP común y conserva manejo de errores y sesión.
- La autorización pertenece a la API. Mantén navegación por rol sin presentarla como protección suficiente.
- Tras mutaciones, invalida o actualiza las consultas correspondientes; al reconectar, recupera el estado del servidor.
- Leaflet requiere navegador: conserva la carga compatible con SSR y la atribución de OpenStreetMap.
- No conviertas coordenadas ausentes en cero ni inventes posiciones. Conserva separación entre punto del pedido y dirección compartida.
- No expongas secretos en variables NEXT_PUBLIC_*, respuestas, logs ni documentación.

## Verificación y entrega

Ejecuta npm test, npx tsc --noEmit, ESLint sobre los archivos afectados y npm run build. Para cambios visuales comprueba escritorio y móvil, teclado y estados de carga, vacío y error. No describas una compilación fallida como exitosa; registra el bloqueo concreto.

Actualiza documentación si cambia un contrato o configuración. Revisa git status y el diff antes de incluir archivos. Usa la rama acordada con el equipo y evita force-push.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

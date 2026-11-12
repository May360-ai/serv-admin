# Fase 4.3 — D10/D12

Base: `47f2ac8fc1a5b22f76a7818f2a64046916c63ca6`. Rama: `fix/errores-filtros-d10-d12`.
Inspección de código y pruebas automatizadas con HTTP simulado. Sin cuentas reales, consultas a Supabase ni cambios de servidor.

## Matriz de hallazgos confirmados

| Archivo(s) | Defecto | Causa confirmada | Comportamiento esperado y corrección limitada |
|---|---|---|---|
| `src/lib/api-client.ts` | D10: mensajes técnicos expuestos; clasificación HTTP perdida | Copiaba `data.error`, `data.mensaje` o el mensaje de Axios a un Error genérico | ErrorHttp conserva status y usa mensajes controlados para red, 401, 403, 404, 5xx y otros estados. Se mantienen redirección 401, excepción de login y cancelación Axios. |
| `src/services/items.service.ts` | D10: categorías fallidas/incorrectas parecían vacías | catch retornaba []; también admitía envoltorios no correspondientes al backend | Propagar fallo; validar arreglo directo de categorías. |
| `src/services/zonas.service.ts` | D10: zonas inválidas llegaban como undefined; categorías inválidas como [] | Lectura sin validar; fallback a [] | Validar `{success:true,data:[...]}`; reutilizar contrato validado de categorías. No cambiar creación de zonas. |
| `src/app/(dashboard)/catalogo/page.tsx` | D10: fallo parecía ausencia de productos o categorías | No consultaba isError | Estados de error independientes con reintento; carga de categorías visible. |
| `src/app/(dashboard)/catalogo/page.tsx` | D12: búsqueda con espacios exteriores perdía coincidencias | No normalizaba espacios del texto | Recortar búsqueda local; conservar parámetros y selección de categorías existentes. |
| `src/app/(dashboard)/tienda/catalogo/page.tsx` | D10: errores/formatos inválidos parecían catálogo vacío; fallback podía mostrar catálogo global | Ignoraba error al resolver proveedor y consultaba /api/items sin proveedor_id | Resolver tienda propia o fallar explícitamente; enviar proveedor_id; rechazar productos ajenos; UI de error/reintento. No cambiar creación de productos. |
| `src/services/proveedores.service.ts`, `src/app/(dashboard)/tienda/configuracion/page.tsx` | D10: error de tienda oculto y posible selección ajena | catch→null y fallback a primera tienda del listado | Propagar errores; validar identidad/propiedad; null solo si listado válido no contiene tienda propia. Mostrar carga/error/ausencia y ocultar formulario sin datos válidos. |
| `src/features/despacho/rutas.service.ts` | D10: respuesta inválida aparecía como rutas vacías | fallback `data || []` sin validar | Validar envoltorio/arreglo/campos de rutas usados por el listado. No alterar elegibilidad ni asignación D05/D11. |
| `src/services/dashboard.service.ts`, `src/app/(dashboard)/dashboard/page.tsx` | D10: errores convertidos en cifras artificiales | catch retornaba ceros y 3 repartidores | Propagar error y validar campos numéricos; mostrar error/reintento en lugar de cifras. No cambiar cálculos, alcance ni contrato del backend. |
| `src/app/(dashboard)/admin/tiendas/page.tsx` | D10 parcial: ocultaba diferencias HTTP | Mensaje genérico para todo error de consulta | Mostrar solo mensajes seguros de ErrorHttp; conservar validación y UI D01; no ofrecer retry de 401/403. |
| `src/hooks/use-pedidos.ts`, `src/services/pedidos.service.ts` | D12: filtrado local disparaba solicitudes por pulsación | Texto/fecha/zona integraban queryKey y queryFn | Separar parámetros HTTP de selección local; conservar caché por usuario/rol y polling D07. Estado proveedor usa API; cliente filtra su arreglo completo. |
| `src/app/(dashboard)/pedidos/page.tsx` | D12: estado real no seleccionable y ausencia de restablecimiento conjunto | Omitía en_progreso; no había acción para limpiar filtros | Añadir opción existente en contrato y restablecer texto/estado/fecha. Conservar restricciones administrativas D04. |
| `src/services/seguimiento.service.ts`, `src/services/proveedores.service.ts` | D10: falsos errores de propiedad con una sesión válida | Login devuelve id numérico; comparar String(cliente_id) contra id sin normalizar rechaza el mismo usuario | Comparar representaciones de texto en ambos lados, aceptando solo la misma identidad. Sin cambiar autenticación ni política de sincronización D07. |

No se confirmó un filtro decorativo en categoría/proveedor del catálogo ni en fecha/zona de rutas: se conserva su contrato existente. No se añadió un selector de proveedor a pedidos ni una búsqueda global.

## Contratos revisados, solo lectura

- `GET /api/items`: público; arreglo directo; admite categoria_id, proveedor_id y es_servicio. Consulta backend restringida a activo=true. No soporta búsqueda textual ni paginación.
- `GET /api/datos/categorias`: arreglo directo de categorías activas.
- `GET /api/proveedores`: arreglo directo con id/usuario_id. `GET /api/proveedores/:id`: objeto directo o 404. La tienda privada se resuelve por identidad verificada de la sesión, sin fallback ajeno.
- `GET /api/zonas`: `{success:true,data:[...]}`, con id convertido a string por controlador.
- `GET /api/rutas`: `{success:true,data:[...]}`; fecha_entrega y zona_id son parámetros reales; el backend aplica alcance por rol.
- Pedidos cliente/proveedor: arreglos completos del rol; el proveedor admite estado. Los filtros locales recalculan data/total/por_pagina/pagina sin simular páginas remotas.
- `GET /api/dashboard/metricas`: existe y requiere administrador; devuelve `{success:true,data:{...}}`. Se conserva autorización; un 403 no se convierte en métricas ficticias.
- Controladores de items, datos, proveedores y dashboard devuelven `error.message` en 500. Es exposición confirmada por lectura de código, no por ejecutar un fallo contra la base compartida. El frontend ya no muestra ese cuerpo.

## Verificación

- `node --test test/errores-filtros.test.cjs`: 29/29 aprobados, incluida identidad numérica del contrato real de login.
- `npm test`: 131/131 aprobados, incluidas las 102 pruebas anteriores sin modificarlas.
- `npx tsc --noEmit`: aprobado.
- `npm run build`: aprobado (24 páginas generadas).
- `git diff --check`: aprobado; sin archivos preparados para commit.
- ESLint focalizado: sin errores nuevos. Persisten dos advertencias previas: useForm.watch en zonas y navegación location.href en el interceptor 401. No se cambió autenticación para eliminarlas.
- Lint global comparado con la rama D07: 15 errores previos en ambas versiones. Advertencias: 12 en base, 11 en esta rama; se quitó únicamente el import Filter sin uso al tocar catálogo. No se corrigió deuda ajena.
- Build conserva aviso de middleware obsoleto de Next.js, distinto de mensajes de las respuestas HTTP. El aviso del compilador sobre useForm.watch es de herramientas de desarrollo; tampoco es un error HTTP de producción.

## Límites y dependencias

Las pruebas usan adaptador Axios, QueryObserver y render estático con datos ficticios. No equivalen a E2E en navegador ni validan usuarios reales. No se afirmaron escrituras/lecturas exitosas en Supabase.

El backend debe evitar enviar errores internos y definir mensajes/códigos públicos estables. Por ahora el frontend muestra mensajes generales por estado HTTP; no presenta el motivo libre del servidor. La exactitud de las fórmulas de métricas backend queda fuera de D10 y no se ha modificado. No se desarrollaron endpoints ni D06/D08/D09.

Los filtros locales operan sobre el arreglo completo recibido para ese rol. Si el backend introduce paginación, habrá que coordinar búsqueda y paginación remotas; no se presume un total global desconocido.

Cambios sin staging ni commit para revisión del Arquitecto GPT. Sin push, merge, rebase ni PR.

## Archivos de la entrega

Modificados (16):

- `src/app/(dashboard)/admin/tiendas/page.tsx`
- `src/app/(dashboard)/catalogo/page.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/pedidos/page.tsx`
- `src/app/(dashboard)/tienda/catalogo/page.tsx`
- `src/app/(dashboard)/tienda/configuracion/page.tsx`
- `src/app/(dashboard)/zonas/page.tsx`
- `src/features/despacho/rutas.service.ts`
- `src/hooks/use-pedidos.ts`
- `src/lib/api-client.ts`
- `src/services/dashboard.service.ts`
- `src/services/items.service.ts`
- `src/services/pedidos.service.ts`
- `src/services/proveedores.service.ts`
- `src/services/seguimiento.service.ts`
- `src/services/zonas.service.ts`

Nuevos (4):

- `src/lib/error-http.ts`
- `src/components/ui/error-consulta.tsx`
- `test/errores-filtros.test.cjs`
- `docs/fase-4.3-d10-d12.md`

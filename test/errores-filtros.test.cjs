/* eslint-disable @typescript-eslint/no-require-imports -- Convención node:test existente. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const axios = require('axios');
const { renderToStaticMarkup } = require('react-dom/server');
const { QueryClient, QueryObserver } = require('@tanstack/react-query');

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (!id.startsWith('@/') && !id.startsWith('.')) return require(id);
      const base = id.startsWith('@/') ? path.resolve(__dirname, '../src', id.slice(2)) : path.resolve(path.dirname(file), id);
      const target = [base + '.ts', base + '.tsx'].find(fs.existsSync); assert.ok(target, id);
      return load(target);
    };
    new Function('require', 'module', 'exports', output)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return name => load(path.resolve(__dirname, '../src', name));
}

const producto = { id: 11, proveedor_id: 8, categoria_id: 2, nombre: 'Rosas', descripcion: 'Ramo rojo',
  precio: '7.00', activo: true, inventario_stock: 5, es_servicio: false, proveedores: { nombre_comercial: 'Florería' } };
const zona = { id: '2', nombre: 'Centro', color: '#336699', capacidad_maxima: 4, activa: true };
const proveedor = { id: 8, usuario_id: 3, nombre_comercial: 'Florería' };
const rawPedido = (id = 10, estado = 'pendiente') => ({ id, proveedor_id: 8, cliente_id: 3, total: '7.00',
  codigo_seguimiento: `QA-${id}`, fecha_creacion: '2026-11-11T18:00:00Z', fecha_programada: '2026-11-13T04:59:00Z',
  estados_pedido: { nombre: estado }, usuarios: { nombre: 'Ana' },
  direcciones: { id: 4, direccion: 'Calle Flores', ciudad: 'Ambato', zona_id: 2 },
});
const ruta = { id: 'r1', nombre: 'Centro', fecha_entrega: '2026-11-12', zona_id: '2', capacidad_maxima: 4, estado: 'armando', pedidos: [] };
const metricas = { pedidos_hoy: 1, pedidos_pendientes: 1, pedidos_en_camino: 0, pedidos_completados: 0,
  rutas_activas: 0, repartidores_disponibles: 0, ingresos_hoy: 0 };
const settle = () => new Promise(resolve => setImmediate(resolve));

function httpSetup(t) {
  const priorWindow = global.window, priorStorage = global.localStorage;
  const removed = [], stored = new Map();
  global.window = { location: { href: '' } };
  global.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value),
    removeItem: key => { removed.push(key); stored.delete(key); } };
  t.after(() => { global.window = priorWindow; global.localStorage = priorStorage; });
  const load = loader(); const { apiClient } = load('lib/api-client.ts');
  let status = 200, body = [producto], network = false, cancelled = false;
  apiClient.defaults.adapter = async config => {
    if (cancelled) throw new axios.CanceledError('cancelada', config);
    if (network) throw new axios.AxiosError('Prisma SQL /private/path token=ficticio', 'ERR_NETWORK', config);
    const response = { status, statusText: '', data: body, headers: {}, config };
    if (status >= 400) throw new axios.AxiosError('Traza SQL ficticia', 'ERR_BAD_RESPONSE', config, undefined, response);
    return response;
  };
  return { load, apiClient, removed, stored, set: (value, data = { error: 'Prisma SELECT /private/path token=ficticio' }) => { status = value; body = data; },
    network: () => { network = true; }, cancel: () => { cancelled = true; } };
}

for (const status of [401, 403, 404, 500]) {
  test(`D10: HTTP ${status} conserva clasificación y no expone cuerpo ni trazas`, async t => {
    const app = httpSetup(t); app.set(status);
    const { ErrorHttp } = app.load('lib/error-http.ts');
    await assert.rejects(app.apiClient.get('/api/items'), error => {
      assert.ok(error instanceof ErrorHttp); assert.equal(error.status, status);
      assert.equal(error.reintentable, status !== 401 && status !== 403);
      const html = renderToStaticMarkup(React.createElement(app.load('components/ui/error-consulta.tsx').ErrorConsulta, { error, reintentar() {} }));
      assert.doesNotMatch(html, /Prisma|SELECT|private|token=|Traza/);
      assert.equal(html.includes('Reintentar'), error.reintentable);
      return true;
    });
    assert.equal(global.window.location.href, status === 401 ? '/login' : '');
    assert.equal(app.removed.length, status === 401 ? 2 : 0);
  });
}

test('D10: error de red es comprensible y distinto de un fallo del servidor', async t => {
  const app = httpSetup(t); app.network();
  await assert.rejects(app.apiClient.get('/api/items'), error => {
    assert.equal(error.status, undefined); assert.match(error.message, /conexión/);
    assert.doesNotMatch(error.message, /Prisma|SQL|token/); return true;
  });
});

test('D10: cancelación de Axios se conserva para no interferir con D07', async t => {
  const app = httpSetup(t); app.cancel();
  await assert.rejects(app.apiClient.get('/api/items'), axios.isCancel);
});

test('D10: login 401 conserva excepción a la redirección y mensaje seguro', async t => {
  const app = httpSetup(t); app.set(401);
  await assert.rejects(app.apiClient.post('/api/auth/login', {}), /Inicia sesión/);
  assert.equal(global.window.location.href, ''); assert.deepEqual(app.removed, []);
});

const servicios = [
  ['catálogo', 'services/items.service.ts', 'itemsService', 'listarCatalogo', [producto], []],
  ['categorías', 'services/items.service.ts', 'itemsService', 'listarCategorias', [{ id: 2, nombre: 'Flores', descripcion: null }], []],
  ['zonas', 'services/zonas.service.ts', 'zonasService', 'listarZonas', { success: true, data: [zona] }, { success: true, data: [] }],
  ['rutas', 'features/despacho/rutas.service.ts', 'rutasService', 'listarRutas', { success: true, data: [ruta] }, { success: true, data: [] }, [{ fecha_entrega: '2026-11-12' }]],
];
for (const [nombre, file, exportado, metodo, datos, vacio, args = []] of servicios) {
  test(`D10: ${nombre} distingue 200 con datos, vacío, respuesta inválida y fallo HTTP`, async t => {
    const app = httpSetup(t); const service = app.load(file)[exportado];
    app.set(200, datos); assert.equal((await service[metodo](...args)).length, 1);
    app.set(200, vacio); assert.deepEqual(await service[metodo](...args), []);
    for (const data of [{}, { data: null }, null, { data: [{}] }, { success: false, data: [] }]) {
      app.set(200, data); await assert.rejects(service[metodo](...args), /inesperada/);
    }
    app.set(500); await assert.rejects(service[metodo](...args), error => error.status === 500);
  });
}

test('D10: métricas no fabrica ceros ni repartidores al fallar o recibir respuesta inválida', async t => {
  const app = httpSetup(t); const service = app.load('services/dashboard.service.ts').dashboardService;
  app.set(200, { success: true, data: metricas }); assert.deepEqual(await service.obtenerMetricas(), metricas);
  app.set(200, {}); await assert.rejects(service.obtenerMetricas(), /inesperada/);
  app.set(404); await assert.rejects(service.obtenerMetricas(), error => error.status === 404);
});

test('D10: tienda propia propaga fallos y no elige la primera tienda ajena', async t => {
  const app = httpSetup(t); const service = app.load('services/proveedores.service.ts').proveedoresService;
  app.set(200, proveedor); assert.equal((await service.obtenerMiTienda(8, '3')).id, 8);
  app.set(200, { ...proveedor, usuario_id: 99 }); await assert.rejects(service.obtenerMiTienda(8, '3'), /no corresponde/);
  app.set(200, [{ ...proveedor, usuario_id: 99 }]); assert.equal(await service.obtenerMiTienda(undefined, '3'), null);
  app.set(200, {}); await assert.rejects(service.obtenerMiTienda(undefined, '3'), /inesperada/);
  app.set(500); await assert.rejects(service.obtenerMiTienda(8, '3'), error => error.status === 500);
});

test('D10: IDs numéricos reales de login y sus formas de texto no producen falsos errores de propiedad', async t => {
  const app = httpSetup(t);
  const tiendas = app.load('services/proveedores.service.ts').proveedoresService;
  const { consultarMisPedidos } = app.load('services/seguimiento.service.ts');
  for (const id of [3, '3']) {
    app.set(200, proveedor); assert.equal((await tiendas.obtenerMiTienda(8, id)).id, 8);
    app.set(200, [proveedor]); assert.equal((await tiendas.obtenerMiTienda(undefined, id)).id, 8);
    app.set(200, [{ ...rawPedido(), subtotal: '7.00', costo_envio: null }]);
    assert.equal((await consultarMisPedidos(id))[0].cliente_id, 3);
    await assert.rejects(consultarMisPedidos(99), /no corresponde/);
  }
});

function pageSetup(name, rol = 'cliente') {
  const states = [], queries = new Map(), captured = new Map(), requests = [];
  let cursor = 0, response = [producto], failure;
  let usuario = { id: '3', rol, proveedor_id: '8' };
  const defaults = { data: [], isSuccess: true, refetch() {} };
  const load = loader({
    react: { ...React, useState: initial => {
      const key = cursor++; if (!(key in states)) states[key] = initial;
      return [states[key], value => { states[key] = value; }];
    }, useEffect() {}, useMemo: fn => fn() },
    '@/store/auth.store': { useAuthStore: selector => selector({ usuario }) },
    '@/store/carrito.store': { useCarritoStore: () => ({ items: [], obtenerTotalItems: () => 0, obtenerTotal: () => 0 }) },
    '@/lib/api-client': { apiClient: { get: async url => { requests.push(url); if (failure) throw failure; return { data: await (typeof response === 'function' ? response(url) : response) }; } } },
    '@tanstack/react-query': { useQuery: options => { captured.set(options.queryKey[0], options); return queries.get(options.queryKey[0]) ?? defaults; },
      useQueryClient: () => ({}), useMutation: () => ({}) },
    'react-hook-form': { useForm: () => ({ register: name => ({ name }), handleSubmit: fn => fn, reset() {}, watch: () => '#336699', formState: { errors: {} } }) },
    'next/link': { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) },
    'next/navigation': { useRouter: () => ({}) },
  });
  const Page = load(name).default;
  function tree() { cursor = 0; return Page(); }
  return { load, states, queries, captured, requests, tree, html: () => renderToStaticMarkup(tree()),
    response: value => { response = value; }, failure: value => { failure = value; }, actor: value => { usuario = value; } };
}

function find(node, predicate) {
  if (!React.isValidElement(node)) return null;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props.children)) { const result = find(child, predicate); if (result) return result; }
  return null;
}

test('D10 UI catálogo: carga, error sin vacío, reintento funcional y recuperación con datos', async t => {
  const app = pageSetup('app/(dashboard)/catalogo/page.tsx'); app.tree();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const observer = new QueryObserver(client, { ...app.captured.get('catalogo-items'), enabled: false });
  const unsubscribe = observer.subscribe(() => {}); t.after(() => { unsubscribe(); client.clear(); });
  function sync() { app.queries.set('catalogo-items', observer.getCurrentResult()); }
  let finish;
  app.response(new Promise(resolve => { finish = resolve; }));
  // El primer estado de carga se verifica sobre el estado real del observador.
  const pending = observer.refetch(); sync(); assert.doesNotMatch(app.html(), /No encontramos productos/);
  finish([producto]); await pending; sync(); assert.match(app.html(), /Rosas/);
  app.failure(new (app.load('lib/error-http.ts').ErrorHttp)(500)); await observer.refetch(); sync();
  assert.match(app.html(), /role="alert"/); assert.doesNotMatch(app.html(), /No encontramos productos|Rosas/);
  app.failure(null); app.response([producto]);
  const errorNode = find(app.tree(), node => node.type.name === 'ErrorConsulta');
  errorNode.props.reintentar(); await settle(); sync(); assert.match(app.html(), /Rosas/);
  app.response([]); await observer.refetch(); sync(); assert.match(app.html(), /No encontramos productos/);
});

for (const [name, key, emptyText] of [
  ['catalogo', 'catalogo-categorias', 'No encontramos productos'],
  ['zonas', 'zonas', 'Sin zonas definidas'],
  ['dashboard', 'dashboard-metricas', 'Disponibles ahora'],
  ['tienda/catalogo', 'items-tienda', 'Tu catálogo está vacío'],
  ['tienda/configuracion', 'mi-tienda', 'Nombre Comercial'],
]) {
  test(`D10 UI ${name}: fallo de consulta se muestra y permite reintentar`, () => {
    const app = pageSetup(`app/(dashboard)/${name}/page.tsx`, name.startsWith('tienda') ? 'proveedor' : 'administrador');
    let retries = 0; const error = new (app.load('lib/error-http.ts').ErrorHttp)(500);
    app.queries.set(key, { isError: true, error, refetch: () => { retries++; } });
    const html = app.html(); assert.match(html, /role="alert"/);
    // Un fallo de categorías no impide mostrar un catálogo de productos legítimamente vacío.
    if (key !== 'catalogo-categorias') assert.ok(!html.includes(emptyText));
    find(app.tree(), node => node.type.name === 'ErrorConsulta').props.reintentar(); assert.equal(retries, 1);
  });
}

test('D10 proveedor: resolver tienda falla cerrado, sin consulta global ni productos ajenos', async () => {
  const app = pageSetup('app/(dashboard)/tienda/catalogo/page.tsx', 'proveedor'); app.tree();
  const query = app.captured.get('items-tienda');
  app.failure(new Error('fallo simulado'));
  await assert.rejects(query.queryFn(), /fallo simulado/); assert.deepEqual(app.requests, ['/api/proveedores/8']);
  app.failure(null); app.response(proveedor);
  // Mismo mock responde tienda válida al resolver; el catálogo recibe un objeto y se rechaza.
  await assert.rejects(query.queryFn(), /catálogo inesperada/);
  assert.equal(app.requests.at(-1), '/api/items?proveedor_id=8');
  app.response(url => url.startsWith('/api/proveedores') ? proveedor : [{ ...producto, proveedor_id: 99 }]);
  await assert.rejects(query.queryFn(), /no corresponde a esta tienda/);
  app.response(url => url.startsWith('/api/proveedores') ? proveedor : [producto]);
  assert.deepEqual(await query.queryFn(), [producto]);
});

for (const rol of ['cliente', 'administrador', 'repartidor']) {
  test(`D10: rol ${rol} no activa catálogo privado ni configuración del proveedor`, () => {
    for (const name of ['tienda/catalogo', 'tienda/configuracion']) {
      const app = pageSetup(`app/(dashboard)/${name}/page.tsx`, rol); assert.match(app.html(), /requiere una sesión de proveedor/);
      const query = app.captured.get(name === 'tienda/catalogo' ? 'items-tienda' : 'mi-tienda'); assert.equal(query.enabled, false);
      assert.deepEqual(app.requests, []);
    }
  });
}

test('D12 catálogo: búsqueda textual con espacios, sin coincidencias, categoría y restablecimiento', () => {
  const app = pageSetup('app/(dashboard)/catalogo/page.tsx'); app.queries.set('catalogo-items', { data: [producto] });
  const buscar = texto => find(app.tree(), node => node.props.placeholder?.startsWith('Buscar por producto')).props.onChange({ target: { value: texto } });
  buscar(' rosas '); assert.match(app.html(), /Rosas/);
  buscar('inexistente'); assert.match(app.html(), /No encontramos productos/);
  buscar('florería'); assert.match(app.html(), /Rosas/);
  app.queries.set('catalogo-categorias', { data: [{ id: 2, nombre: 'Flores' }] });
  find(app.tree(), node => node.type === 'button' && node.props.children === 'Flores').props.onClick();
  app.tree(); assert.deepEqual(app.captured.get('catalogo-items').queryKey, ['catalogo-items', 2]);
  find(app.tree(), node => node.type === 'button' && node.props.children === 'Todas las categorías').props.onClick();
  assert.equal(app.states[1], null);
  buscar(''); assert.match(app.html(), /Rosas/);
});

test('D12: categoría, proveedor y tipo conservan los parámetros reales del catálogo', async () => {
  const requests = [];
  const load = loader({ '@/lib/api-client': { apiClient: { get: async url => { requests.push(url); return { data: [producto] }; } } } });
  const service = load('services/items.service.ts').itemsService;
  await service.listarCatalogo({ categoria_id: 2 });
  await service.listarCatalogo({ proveedor_id: 8 });
  await service.listarCatalogo({ categoria_id: 2, proveedor_id: 8, es_servicio: false });
  await service.listarCatalogo();
  assert.deepEqual(requests, ['/api/items?categoria_id=2', '/api/items?proveedor_id=8',
    '/api/items?categoria_id=2&proveedor_id=8&es_servicio=false', '/api/items?']);
});

test('D12: filtros de pedidos individuales, combinados, vacíos y metadatos del listado completo', async () => {
  const load = loader({ '@/lib/api-client': { apiClient: { get: async () => ({ data: [rawPedido(), rawPedido(11, 'en_progreso')] }) } } });
  const { pedidosService, filtrarPedidos } = load('services/pedidos.service.ts');
  const listado = (await pedidosService.listarPedidosCliente()).data;
  for (const filtros of [{ busqueda: ' ana ' }, { busqueda: 'Ambato' }, { fecha: '2026-11-12' }, { zona_id: '2' }]) {
    assert.equal(filtrarPedidos(listado, filtros).total, 2);
  }
  const result = filtrarPedidos(listado, { busqueda: 'flores', estado: 'en_progreso', fecha: '2026-11-12', zona_id: '2' });
  assert.equal(result.total, 1); assert.equal(result.data[0].id, '11'); assert.equal(result.por_pagina, 1); assert.equal(result.pagina, 1);
  for (const filtros of [{ busqueda: 'sin coincidencias' }, { fecha: '2026-11-13' }, { zona_id: '9' }, { estado: 'completado' }]) {
    assert.equal(filtrarPedidos(listado, filtros).total, 0);
  }
  assert.equal(filtrarPedidos(listado, {}).total, 2); assert.equal(filtrarPedidos([], {}).total, 0);
});

test('D12: escribir o cambiar fecha/zona filtra la caché sin solicitudes nuevas; estado proveedor usa API', async t => {
  let options, usuario = { id: '3', rol: 'proveedor' }; const requests = [];
  const load = loader({
    '@/store/auth.store': { useAuthStore: fn => fn({ usuario }) },
    '@/lib/api-client': { apiClient: { get: async url => { requests.push(url); return { data: [rawPedido(), rawPedido(11, 'en_progreso')] }; } } },
    '@tanstack/react-query': { useQuery: value => { options = value; return {}; } },
  });
  const hooks = load('hooks/use-pedidos.ts');
  const config = filtros => { hooks.useTodosPedidos(filtros); return { ...options, retry: false }; };
  const client = new QueryClient(); const observer = new QueryObserver(client, config({}));
  const unsubscribe = observer.subscribe(() => {}); t.after(() => { unsubscribe(); client.clear(); }); await settle();
  for (const filtros of [{ busqueda: 'a' }, { busqueda: 'ana' }, { fecha: '2026-11-13' }, { zona_id: '9' }, {}]) {
    observer.setOptions(config(filtros)); await settle();
  }
  assert.equal(requests.length, 1); assert.equal(observer.getCurrentResult().data.total, 2);
  observer.setOptions(config({ estado: 'en_progreso' })); await settle();
  assert.equal(requests.at(-1), '/api/pedidos/tienda?estado=en_progreso'); assert.equal(observer.getCurrentResult().data.total, 1);
  usuario = { id: '4', rol: 'cliente' }; observer.setOptions(config({ estado: 'pendiente' })); await settle();
  assert.equal(requests.at(-1), '/api/pedidos/mis-pedidos'); assert.ok(observer.options.queryKey.includes('4'));
  usuario = { id: '5', rol: 'administrador' }; observer.setOptions(config({})); await settle();
  assert.equal(observer.getCurrentResult().isError, true); assert.equal(requests.length, 3);
});

test('D12 UI pedidos: ofrece en_progreso y restablece texto, estado y fecha juntos', () => {
  const app = pageSetup('app/(dashboard)/pedidos/page.tsx', 'proveedor');
  app.states.splice(0, 4, false, 'ana', 'en_progreso', '2026-11-12');
  assert.match(app.html(), /value="en_progreso"/);
  find(app.tree(), node => node.props.children === 'Restablecer filtros').props.onClick();
  assert.deepEqual(app.states.slice(1, 4), ['', '', '']);
});

test('Cierre D10: métricas de una sesión anterior no contaminan el siguiente usuario ni rol', async t => {
  const app = pageSetup('app/(dashboard)/dashboard/page.tsx', 'administrador');
  let finish;
  app.response(new Promise(resolve => { finish = resolve; })); app.tree();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const options = () => { app.tree(); return app.captured.get('dashboard-metricas'); };
  const observer = new QueryObserver(client, options()); const unsubscribe = observer.subscribe(() => {});
  t.after(() => { unsubscribe(); client.clear(); }); await settle();
  app.actor({ id: '4', rol: 'cliente' }); observer.setOptions(options());
  finish({ success: true, data: metricas }); await settle();
  assert.equal(observer.getCurrentResult().data, undefined);
  assert.match(app.html(), /requiere una sesión de administrador/);
  assert.equal(app.requests.length, 1);
  app.actor({ id: '5', rol: 'administrador' }); app.response({ success: true, data: { ...metricas, pedidos_hoy: 9 } });
  observer.setOptions(options()); await settle();
  assert.equal(observer.getCurrentResult().data.pedidos_hoy, 9);
  assert.deepEqual(observer.options.queryKey, ['dashboard-metricas', '5', 'administrador']);
});

test('Integración aislada: login persiste sesión, resuelve proveedor y logout elimina almacenamiento', async t => {
  const app = httpSetup(t);
  const token = 'cabecera.' + Buffer.from(JSON.stringify({ id: 3, proveedor_id: 8 })).toString('base64url') + '.firma-ficticia';
  app.set(200, { token, usuario: { id: 3, nombre: 'QA', rol: 'proveedor' } });
  const auth = app.load('services/auth.service.ts').authService;
  const result = await auth.login({ email: 'qa@example.test', password: 'dato-ficticio' });
  assert.equal(result.usuario.proveedor_id, '8'); assert.equal(auth.getUsuarioActual().id, 3);
  assert.ok(app.stored.has('serv_token')); assert.ok(app.stored.has('serv_usuario'));
  auth.logout(); assert.equal(app.stored.size, 0); assert.equal(global.window.location.href, '/login');
});

test('Integración aislada: middleware navega por rol y deniega vistas ajenas', async t => {
  const originalFetch = global.fetch; t.after(() => { global.fetch = originalFetch; });
  const { NextRequest } = require('next/server'); const { middleware } = loader()('middleware.ts');
  const destinos = { administrador: '/admin/metricas', proveedor: '/tienda/rutas', repartidor: '/entregas', cliente: '/catalogo' };
  for (const [rol, destino] of Object.entries(destinos)) {
    global.fetch = async () => Response.json({ rol_nombre: rol });
    const request = pathname => new NextRequest(`http://localhost${pathname}`, { headers: { cookie: 'serv_token=sesion-ficticia' } });
    assert.ok((await middleware(request('/dashboard'))).headers.get('location').endsWith(destino));
    assert.equal((await middleware(request(destino))).headers.get('x-middleware-next'), '1');
    if (rol !== 'administrador') assert.match((await middleware(request('/admin/metricas'))).headers.get('location'), /unauthorized/);
  }
});

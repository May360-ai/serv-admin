/* eslint-disable @typescript-eslint/no-require-imports -- Convención node:test existente. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { EventEmitter } = require('node:events');
const { QueryClient, QueryObserver, MutationObserver, focusManager, onlineManager } = require('@tanstack/react-query');
const { environmentManager } = require('@tanstack/query-core');

function loader(mocks) {
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
      const target = [base + '.ts', base + '.tsx'].find(fs.existsSync);
      assert.ok(target, id); return load(target);
    };
    new Function('require', 'module', 'exports', output)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return name => load(path.resolve(__dirname, '../src', name));
}

const pedido = (cliente = 3, estado = 'pendiente') => ({
  id: 10, cliente_id: cliente, proveedor_id: 8, total: '16.50', subtotal: '14.00', costo_envio: '2.50',
  estados_pedido: { nombre: estado }, fecha_creacion: '2026-11-11T12:00:00Z',
  fecha_programada: '2026-11-12T17:00:00Z', detalle_pedido: [],
});
const settle = () => new Promise(resolve => setImmediate(resolve));

function setup(t, rol = 'cliente') {
  // La biblioteca instalada permite activar sus temporizadores de cliente sin un navegador real.
  environmentManager.setIsServer(() => false);
  focusManager.setFocused(true); onlineManager.setOnline(true);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false, gcTime: Infinity } } });
  const unsubs = [], requests = [], mensajes = [], invalidaciones = [];
  let actor = { id: '3', rol, proveedor_id: 8 };
  let estado = 'pendiente', fail = false, failPatch = false, payload, options, snapshot;
  let customGet;
  let socketConnections = 0;
  const originalInvalidate = client.invalidateQueries.bind(client);
  client.invalidateQueries = args => { invalidaciones.push(args.queryKey); return originalInvalidate(args); };
  const load = loader({
    '@/store/auth.store': { useAuthStore: selector => selector({ usuario: actor }) },
    '@/lib/api-client': { apiClient: {
      get: async (url, config) => {
        requests.push({ url, signal: config?.signal });
        if (customGet) return customGet(url, config?.signal);
        if (fail) throw new Error('HTTP 503 simulado');
        return { data: payload === undefined ? [pedido(Number(actor?.id), estado)] : payload };
      },
      patch: async () => {
        if (failPatch) throw new Error('HTTP 403 simulado');
        estado = 'cancelado'; return { data: { pedido: pedido(Number(actor?.id), estado) } };
      },
    } },
    'socket.io-client': { io: () => { socketConnections++; throw new Error('D07 no necesita una conexión Socket.IO'); } },
    sonner: { toast: { success: text => mensajes.push(['success', text]), error: text => mensajes.push(['error', text]) } },
    'next/link': { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) },
    '@tanstack/react-query': {
      useQuery: value => { options = value; return snapshot ?? {}; },
      useQueryClient: () => client,
      useMutation: value => { const mutation = new MutationObserver(client, value); return { mutateAsync: body => mutation.mutate(body) }; },
    },
  });
  const hooks = load('hooks/use-pedidos.ts');
  client.mount();
  t.after(() => {
    for (const unsubscribe of unsubs) unsubscribe();
    client.unmount(); client.clear();
    focusManager.setFocused(undefined); onlineManager.setOnline(true);
    environmentManager.setIsServer(() => true);
  });
  function config(name = 'useMisPedidosCliente') { hooks[name](); return options; }
  function observe(name = 'useMisPedidosCliente', opts = config(name)) {
    const observer = new QueryObserver(client, { ...opts, retry: false });
    const unsubscribe = observer.subscribe(result => { snapshot = result; });
    unsubs.push(unsubscribe);
    return { observer, unsubscribe };
  }
  return {
    client, hooks, config, observe, requests, mensajes, invalidaciones,
    external: value => { estado = value; }, readFailure: value => { fail = value; }, patchFailure: value => { failPatch = value; },
    payload: value => { payload = value; }, actor: value => { actor = value; }, get: value => { customGet = value; },
    socketConnections: () => socketConnections,
    html: () => renderToStaticMarkup(React.createElement(load('app/(dashboard)/mis-pedidos/page.tsx').default)),
  };
}

test('D07: campos anulables del contrato no impiden confirmar el estado', async t => {
  const app = setup(t);
  app.payload([{ ...pedido(), fecha_creacion: null, fecha_programada: null, costo_envio: null,
    detalle_pedido: [{ id: 1, cantidad: 1, precio_unitario: '14.00', subtotal: '14.00', items: { nombre: 'Producto', es_servicio: null } }],
  }]);
  const { observer } = app.observe(); await settle();
  assert.equal(observer.getCurrentResult().isSuccess, true);
  assert.equal(observer.getCurrentResult().data[0].estados_pedido.nombre, 'pendiente');
  assert.match(app.html(), /Fecha no informada/);
});

test('D07: estado externo se confirma por polling a los 30 s, sin eventos ni peticiones intermedias', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const app = setup(t); const { observer } = app.observe(); await settle();
  assert.equal(observer.getCurrentResult().data[0].estados_pedido.nombre, 'pendiente');
  app.external('en_camino');
  t.mock.timers.tick(29999); await settle(); assert.equal(app.requests.length, 1);
  t.mock.timers.tick(1); await settle();
  assert.equal(observer.getCurrentResult().data[0].estados_pedido.nombre, 'en_camino');
  assert.equal(app.requests.length, 2);
  assert.equal(app.socketConnections(), 0);
});

test('D07: no consulta en segundo plano y refresca al recuperar foco', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const app = setup(t); const { observer } = app.observe(); await settle();
  focusManager.setFocused(false); app.external('completado');
  t.mock.timers.tick(90000); await settle(); assert.equal(app.requests.length, 1);
  focusManager.setFocused(true); await settle();
  assert.equal(app.requests.length, 2);
  assert.equal(observer.getCurrentResult().data[0].estados_pedido.nombre, 'completado');
});

test('D07: desconexión y reconexión HTTP revalidan el estado sin depender de Socket.IO', async t => {
  const app = setup(t); const { observer } = app.observe(); await settle();
  onlineManager.setOnline(false); app.external('aceptado');
  assert.equal(observer.getCurrentResult().data[0].estados_pedido.nombre, 'pendiente');
  onlineManager.setOnline(true); await settle();
  assert.equal(observer.getCurrentResult().data[0].estados_pedido.nombre, 'aceptado');
  assert.equal(app.requests.length, 2);
});

test('D07: error HTTP conserva estado confirmado, muestra error y detiene polling hasta revalidar', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const app = setup(t); const { observer } = app.observe(); await settle();
  app.external('completado'); app.readFailure(true);
  await observer.refetch();
  assert.equal(observer.getCurrentResult().isError, true);
  assert.equal(observer.getCurrentResult().data[0].estados_pedido.nombre, 'pendiente');
  assert.match(app.html(), /HTTP 503 simulado/);
  assert.match(app.html(), /últimos estados confirmados/);
  assert.match(app.html(), /Reintentar/);
  t.mock.timers.tick(90000); await settle(); assert.equal(app.requests.length, 2);
  app.readFailure(false); await observer.refetch();
  assert.equal(observer.getCurrentResult().data[0].estados_pedido.nombre, 'completado');
});

test('D07: estado ausente y pedido de otro usuario se rechazan, sin inventar pendiente ni reemplazar la caché', async t => {
  const app = setup(t); const { observer } = app.observe(); await settle();
  for (const payload of [[{ ...pedido(), estados_pedido: null }], [pedido(99, 'completado')]]) {
    app.payload(payload); await observer.refetch();
    assert.equal(observer.getCurrentResult().isError, true);
    assert.equal(observer.getCurrentResult().data[0].estados_pedido.nombre, 'pendiente');
    assert.equal(observer.getCurrentResult().data[0].cliente_id, 3);
  }
});

test('D07: fallo inicial no aparece como lista vacía ni como estado inventado', async t => {
  const app = setup(t); app.readFailure(true); app.observe(); await settle();
  assert.match(app.html(), /HTTP 503 simulado/);
  assert.doesNotMatch(app.html(), /No tenés pedidos en curso|Pedido #/);
});

test('D07: dos observadores comparten consulta y polling; desmontar elimina las actualizaciones', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const app = setup(t);
  const a = app.observe(); const b = app.observe(); await settle();
  assert.equal(app.requests.length, 1);
  assert.equal(app.client.getQueryCache().getAll().length, 1);
  t.mock.timers.tick(30000); await settle(); assert.equal(app.requests.length, 2);
  a.unsubscribe(); b.unsubscribe();
  t.mock.timers.tick(90000); await settle(); assert.equal(app.requests.length, 2);
  assert.equal(app.socketConnections(), 0);
});

test('D07: cambio de cliente cancela lectura anterior y no muestra su resultado en la sesión nueva', async t => {
  const app = setup(t); let aborted = false;
  app.get((url, signal) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('Cancelada')); }, { once: true });
  }));
  const { observer } = app.observe(); await settle();
  app.actor({ id: '4', rol: 'cliente' });
  app.get(async () => ({ data: [pedido(4, 'aceptado')] }));
  observer.setOptions({ ...app.config(), retry: false }); await settle();
  assert.equal(aborted, true);
  assert.equal(observer.getCurrentResult().data[0].cliente_id, 4);
  assert.deepEqual(observer.options.queryKey, ['mis-pedidos-cliente', '4', 'cliente']);
});

test('D07: cambiar de sesión a proveedor o cerrar sesión deshabilita Mis pedidos y oculta datos anteriores', async t => {
  const app = setup(t); const { observer } = app.observe(); await settle();
  app.actor({ id: '3', rol: 'proveedor', proveedor_id: 8 });
  observer.setOptions({ ...app.config(), retry: false }); await settle();
  assert.equal(observer.getCurrentResult().data, undefined);
  assert.equal(app.requests.length, 1);
  assert.match(app.html(), /requiere una sesión de cliente/);
  app.actor(null); observer.setOptions({ ...app.config(), retry: false }); await settle();
  assert.equal(app.requests.length, 1);
  assert.match(app.html(), /Cargando sesión/);
});

test('D07: mutación aceptada invalida ambas vistas y confirma el nuevo estado por GET', async t => {
  const app = setup(t); const { observer } = app.observe(); await settle();
  await app.hooks.useCambiarEstado().mutateAsync({ id: '10', body: { estado: 'cancelado' } }); await settle();
  assert.deepEqual(app.invalidaciones, [['pedidos'], ['mis-pedidos-cliente']]);
  assert.equal(observer.getCurrentResult().data[0].estados_pedido.nombre, 'cancelado');
  assert.equal(app.mensajes[0][0], 'success');
});

test('D07: mutación rechazada no invalida como éxito ni modifica el estado mostrado', async t => {
  const app = setup(t); const { observer } = app.observe(); await settle();
  app.patchFailure(true);
  await assert.rejects(app.hooks.useCambiarEstado().mutateAsync({ id: '10', body: { estado: 'cancelado' } }), /HTTP 403/);
  assert.deepEqual(app.invalidaciones, []);
  assert.equal(observer.getCurrentResult().data[0].estados_pedido.nombre, 'pendiente');
  assert.equal(app.mensajes.some(([kind]) => kind === 'success'), false);
});

test('D07: eventos de rutas propios o ajenos no se aplican como estados; se reconsulta HTTP', async t => {
  const app = setup(t); const { observer } = app.observe(); await settle();
  const socket = new EventEmitter();
  // No existe un evento de estados para este flujo: no se abre ni se registra un listener D07.
  for (const cliente_id of [3, 99]) socket.emit('ruta_actualizada', { pedidos: [{ id: 10, cliente_id, estado: 'completado' }] });
  assert.equal(socket.listenerCount('ruta_actualizada'), 0);
  assert.equal(observer.getCurrentResult().data[0].estados_pedido.nombre, 'pendiente');
  assert.equal(app.requests.length, 1);
  app.external('completado'); await observer.refetch();
  assert.equal(observer.getCurrentResult().data[0].estados_pedido.nombre, 'completado');
});

for (const rol of ['cliente', 'proveedor']) {
  test(`D07: listado normalizado de ${rol} también revalida por polling y conserva su endpoint`, async t => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const app = setup(t, rol); const { observer } = app.observe('useTodosPedidos'); await settle();
    app.external('en_camino'); t.mock.timers.tick(30000); await settle();
    assert.equal(observer.getCurrentResult().data.data[0].estado, 'en_camino');
    assert.ok(app.requests.every(r => r.url === (rol === 'cliente' ? '/api/pedidos/mis-pedidos' : '/api/pedidos/tienda')));
  });
}

test('D07: administración no realiza polling de un listado inexistente', t => {
  const app = setup(t, 'administrador'); const config = app.config('useTodosPedidos');
  assert.equal(config.refetchInterval({ state: { status: 'success' } }), false);
  assert.equal(config.refetchOnWindowFocus, false);
  assert.equal(config.refetchOnReconnect, false);
  assert.deepEqual(app.requests, []);
});

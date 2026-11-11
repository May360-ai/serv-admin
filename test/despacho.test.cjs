/* eslint-disable @typescript-eslint/no-require-imports -- Suite CommonJS existente de node:test. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { QueryClient, QueryObserver, MutationObserver } = require('@tanstack/react-query');

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    function localRequire(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (!id.startsWith('@/') && !id.startsWith('.')) return require(id);
      const base = id.startsWith('@/') ? path.resolve(__dirname, '../src', id.slice(2)) : path.resolve(path.dirname(file), id);
      const target = [base + '.ts', base + '.tsx', base + '.js'].find(fs.existsSync);
      assert.ok(target, id);
      return load(target);
    }
    new Function('require', 'module', 'exports', output)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return name => load(path.resolve(__dirname, '../src/features/despacho', name));
}

const ruta = { id: 'ruta-1', nombre: 'Centro', fecha_entrega: '2026-11-12', proveedor_id: 8, zona_id: '2',
  repartidor_id: '1', pedidos: [], capacidad_maxima: 6, estado: 'armando' };
const pedido = { id: '10', cliente_nombre: 'Cliente QA', cliente_telefono: '000', fecha_entrega: '2026-11-12',
  tienda_id: '8', zona_id: '2', estado: 'pendiente', direccion: { calle: 'Prueba', numero: '' },
  ventana_horaria: { desde: '12:00', hasta: '12:00' } };
const activos = [{ id: '1', nombre: 'Actual' }, { id: '2', nombre: 'Libre sin ruta previa' }, { id: '3', nombre: 'Ocupado' }];
const asignaciones = [ruta, { ...ruta, id: 'otra-tienda', proveedor_id: 9, zona_id: '9', repartidor_id: '3' }];
const reglas = loader()('elegibilidad.ts');

test('D05: incluye al activo sin ruta previa y excluye al ocupado en otra tienda o zona', () => {
  assert.deepEqual(reglas.repartidoresElegibles(activos, asignaciones, ruta).map(r => r.id), ['2']);
});
test('D05: una asignación en otra fecha no bloquea; una ruta completada del mismo día sí', () => {
  assert.deepEqual(reglas.repartidoresElegibles(activos, [
    { ...asignaciones[1], fecha_entrega: '2026-11-13' },
  ], ruta).map(r => r.id), ['2', '3']);
  assert.deepEqual(reglas.repartidoresElegibles(activos, [{ ...asignaciones[1], estado: 'completada' }], ruta).map(r => r.id), ['2']);
  assert.deepEqual(reglas.repartidoresElegibles(activos, [], { ...ruta, estado: 'en_ruta' }), []);
});

for (const estado of ['pendiente', 'aceptado']) {
  test(`D11: ruta compatible con capacidad configurable y pedido ${estado}`, () => {
    assert.equal(reglas.esRutaCompatible({ ...pedido, estado }, { ...ruta, pedidos: Array(5).fill(pedido) }), true);
  });
}
for (const [caso, cambioRuta, cambioPedido] of [
  ['llena', { pedidos: Array(6).fill(pedido) }, {}],
  ['zona', { zona_id: '3' }, {}], ['proveedor', { proveedor_id: 9 }, {}],
  ['fecha', { fecha_entrega: '2026-11-13' }, {}], ['estado de ruta', { estado: 'en_ruta' }, {}],
  ['estado de pedido', {}, { estado: 'completado' }], ['pedido asignado', {}, { ruta_id: 'otra' }],
  ['proveedor desconocido', { proveedor_id: undefined }, {}], ['capacidad inválida', { capacidad_maxima: 0 }, {}],
]) {
  test(`D11: no ofrece ruta incompatible por ${caso}`, () => {
    assert.equal(reglas.esRutaCompatible({ ...pedido, ...cambioPedido }, { ...ruta, ...cambioRuta }), false);
  });
}

function setup(t, role = 'administrador') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  const invalidaciones = [], mensajes = [], requests = [];
  let get = async url => ({ data: url.includes('repartidores') ? { data: activos } : { data: asignaciones } });
  let write = async () => ({ data: { success: true, data: ruta } });
  let queryResult = { isPending: false, isFetching: false, isError: false, data: { activos, asignaciones } };
  let mutationResult = { isPending: false, error: null };
  let queryOptions;
  let selection = '';
  let pendingMutation;
  let refetches = 0;
  const refetch = async () => { refetches++; };
  const load = loader({
    // Permite accionar select y formulario sin DOM; las mutaciones usan Query real.
    react: { ...React, useState: () => [selection, value => { selection = value; }] },
    '@/lib/api-client': { apiClient: {
      get: async url => { requests.push(url); return get(url); },
      post: async (url, body) => { requests.push([url, body]); return write(url, body); },
      patch: async (url, body) => { requests.push([url, body]); return write(url, body); },
    } },
    '@/store/auth.store': { useAuthStore: selector => selector({ usuario: { id: '99', rol: role, proveedor_id: 8 } }) },
    sonner: { toast: { success: text => mensajes.push(['success', text]), error: text => mensajes.push(['error', text]) } },
    '@tanstack/react-query': {
      useQueryClient: () => ({ invalidateQueries: options => { invalidaciones.push(options.queryKey); return Promise.resolve(); } }),
      useQuery: options => { queryOptions = options; return { refetch, ...queryResult }; },
      useMutation: options => {
        const observer = new MutationObserver(client, options);
        const unsubscribe = observer.subscribe(result => { mutationResult = result; });
        t.after(unsubscribe);
        return { ...mutationResult,
          reset: () => { mutationResult = { isPending: false, error: null }; },
          mutate: input => { pendingMutation = observer.mutate(input); void pendingMutation.catch(() => {}); },
          mutateAsync: input => observer.mutate(input),
        };
      },
    },
  });
  t.after(() => client.clear());
  const hooks = load('use-rutas.ts');
  const Modal = load('modal-ajuste-ruta.tsx').ModalAjusteRuta;
  const Panel = load('panel-pedidos-libres.tsx').PanelPedidosLibres;
  return {
    client, hooks, requests, invalidaciones, mensajes,
    query: () => queryOptions,
    setGet: fn => { get = fn; }, setWrite: fn => { write = fn; },
    setQuery: value => { queryResult = value; }, setMutation: value => { mutationResult = value; },
    waitMutation: () => pendingMutation,
    refetches: () => refetches,
    tree: (extra = {}) => Modal({ ruta, open: true, onOpenChange: () => {}, ...extra }),
    modal: (extra = {}) => renderToStaticMarkup(React.createElement(Modal, { ruta, open: true, onOpenChange: () => {}, ...extra })),
    panel: (extra = {}) => renderToStaticMarkup(React.createElement(Panel, {
      pedidos: [pedido], rutas: [ruta], isLoading: false, isLoadingRutas: false, errorRutas: null,
      onReintentarRutas: () => {}, ...extra,
    })),
  };
}

function findElement(node, predicate) {
  if (!React.isValidElement(node)) return null;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

test('D05: consulta activos y asignaciones de todas las zonas para la fecha elegida', async t => {
  const app = setup(t);
  app.hooks.useDisponibilidadRepartidores(ruta.fecha_entrega, true);
  assert.equal(app.query().enabled, true);
  const result = await app.query().queryFn();
  assert.deepEqual(app.requests, ['/api/rutas/repartidores', '/api/rutas?fecha_entrega=2026-11-12']);
  assert.deepEqual(result.activos.map(r => r.id), ['1', '2', '3']);
  assert.match(app.modal(), /Libre sin ruta previa/);
  assert.doesNotMatch(app.modal(), /<option[^>]*value="3"/);
});

test('D05: proveedor consulta activos y selecciona sin consultar asignaciones globales', async t => {
  const app = setup(t, 'proveedor');
  app.hooks.useDisponibilidadRepartidores(ruta.fecha_entrega, true);
  assert.equal(app.query().enabled, true);
  const result = await app.query().queryFn();
  assert.deepEqual(app.requests, ['/api/rutas/repartidores']);
  assert.deepEqual(result.asignaciones, []);
  app.setQuery({ data: result, isPending: false, isFetching: false, isError: false });
  assert.match(app.modal(), /disponibilidad para esta fecha se verifica al confirmar/);
  assert.doesNotMatch(app.modal(), /Libre el|otra-tienda/);
  const select = findElement(app.tree(), node => node.props['data-cy'] === 'select-repartidor-ajuste');
  assert.equal(select.props.disabled, false);
  select.props.onChange({ target: { value: '2' } });
  assert.equal(findElement(app.tree(), node => node.props['data-cy'] === 'btn-confirmar-ajuste-ruta').props.disabled, false);
});

test('D05 proveedor: seleccionar y confirmar envía PATCH; respuesta 200 actualiza y cierra', async t => {
  const app = setup(t, 'proveedor'); let closed = false;
  app.setWrite(async (url, body) => {
    assert.equal(url, `/api/rutas/${ruta.id}/repartidor`);
    return { status: 200, data: { success: true, data: { ...ruta, repartidor_id: body.repartidor_id } } };
  });
  const props = { onOpenChange: open => { closed = !open; } };
  findElement(app.tree(props), node => node.props['data-cy'] === 'select-repartidor-ajuste').props.onChange({ target: { value: '2' } });
  findElement(app.tree(props), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await app.waitMutation();
  assert.deepEqual(app.requests, [[`/api/rutas/${ruta.id}/repartidor`, { repartidor_id: '2' }]]);
  assert.deepEqual(app.invalidaciones, [['rutas'], ['repartidores-despacho']]);
  assert.equal(closed, true);
  assert.equal(app.mensajes[0][0], 'success');
});

for (const [caso, cambio] of [
  ['ajena', { proveedor_id: 9 }], ['sin propietario conocido', { proveedor_id: undefined }],
  ['ya salida', { estado: 'en_ruta' }],
]) {
  test(`D05 proveedor: no envía reasignación de ruta ${caso}`, t => {
    const app = setup(t, 'proveedor');
    const props = { ruta: { ...ruta, ...cambio } };
    assert.match(app.modal(props), /role="alert"/);
    assert.equal(findElement(app.tree(props), node => node.props['data-cy'] === 'btn-confirmar-ajuste-ruta').props.disabled, true);
    findElement(app.tree(props), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.deepEqual(app.requests, []);
    assert.equal(app.mensajes.some(([kind]) => kind === 'success'), false);
  });
}

for (const [caso, message] of [
  ['ocupado o inactivo', 'Repartidor no disponible'], ['ruta ajena al confirmar', 'Ruta no encontrada'],
  ['ruta salida al confirmar', 'La ruta ya salió'], ['red', 'No se pudo conectar con SERV'],
]) {
  test(`D05 proveedor: rechazo por ${caso} visible, sin éxito, permite actualizar y reseleccionar`, async t => {
    const app = setup(t, 'proveedor'); let closed = false;
    app.setWrite(async () => { throw new Error(message); });
    const props = { onOpenChange: open => { closed = !open; } };
    findElement(app.tree(props), node => node.props['data-cy'] === 'select-repartidor-ajuste').props.onChange({ target: { value: '2' } });
    findElement(app.tree(props), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    await assert.rejects(app.waitMutation(), { message });
    assert.equal(closed, false);
    assert.equal(app.mensajes.some(([kind]) => kind === 'success'), false);
    assert.match(app.modal(props), /role="alert"/);
    assert.ok(app.modal(props).includes(message));
    findElement(app.tree(props), node => node.props.children === 'Actualizar candidatos').props.onClick();
    assert.equal(app.refetches(), 1);
    assert.equal(findElement(app.tree(props), node => node.props['data-cy'] === 'select-repartidor-ajuste').props.value, '');
    assert.equal(findElement(app.tree(props), node => node.props['data-cy'] === 'btn-confirmar-ajuste-ruta').props.disabled, true);
    findElement(app.tree(props), node => node.props['data-cy'] === 'select-repartidor-ajuste').props.onChange({ target: { value: '3' } });
    assert.equal(findElement(app.tree(props), node => node.props['data-cy'] === 'btn-confirmar-ajuste-ruta').props.disabled, false);
  });
}

test('D05 proveedor: error de consulta permite reintentar sin solicitar asignaciones privadas', async t => {
  const app = setup(t, 'proveedor'); let fail = true;
  app.hooks.useDisponibilidadRepartidores(ruta.fecha_entrega, true);
  app.setGet(async url => {
    assert.equal(url, '/api/rutas/repartidores');
    if (fail) throw new Error('Error de red simulado');
    return { data: { data: activos } };
  });
  const observer = new QueryObserver(app.client, { ...app.query(), enabled: false });
  const unsubscribe = observer.subscribe(result => app.setQuery(result));
  t.after(() => { unsubscribe(); observer.destroy(); });
  await observer.refetch();
  app.setQuery(observer.getCurrentResult());
  assert.match(app.modal(), /Error de red simulado/);
  fail = false;
  findElement(app.tree(), node => node.props.children === 'Reintentar').props.onClick();
  await observer.refetch();
  app.setQuery(observer.getCurrentResult());
  assert.match(app.modal(), /Libre sin ruta previa/);
  assert.doesNotMatch(app.modal(), /role="alert"|Libre el/);
  assert.ok(app.requests.every(url => url === '/api/rutas/repartidores'));
});

test('D05: consulta real simulada distingue carga, error, recuperación y ausencia de candidatos', async t => {
  const app = setup(t);
  app.hooks.useDisponibilidadRepartidores(ruta.fecha_entrega, true);
  let fail = true;
  app.setGet(async url => {
    if (fail) throw new Error('HTTP 503 simulado');
    return { data: { data: url.includes('repartidores') ? [] : asignaciones } };
  });
  const observer = new QueryObserver(app.client, { ...app.query(), enabled: false });
  const unsubscribe = observer.subscribe(result => app.setQuery(result));
  t.after(() => { unsubscribe(); observer.destroy(); });
  const pending = observer.refetch();
  app.setQuery(observer.getCurrentResult());
  assert.match(app.modal(), /Consultando repartidores/);
  await pending;
  app.setQuery(observer.getCurrentResult());
  assert.match(app.modal(), /No se pudieron consultar los candidatos/);
  assert.match(app.modal(), /Reintentar/);
  assert.doesNotMatch(app.modal(), /No hay otros repartidores/);
  fail = false;
  await observer.refetch();
  app.setQuery(observer.getCurrentResult());
  assert.match(app.modal(), /No hay otros repartidores activos libres/);
});

test('D05: respuestas inesperadas no se interpretan como disponibilidad libre', async t => {
  const app = setup(t);
  app.hooks.useDisponibilidadRepartidores(ruta.fecha_entrega, true);
  for (const data of [null, [], { data: [{}] }]) {
    app.setGet(async () => ({ data }));
    await assert.rejects(app.query().queryFn(), /Respuesta .* inesperada/);
  }
});

test('D11: panel distingue carga/error de rutas y ausencia de opciones compatibles', t => {
  const app = setup(t);
  assert.match(app.panel(), /Asignar a:/);
  assert.doesNotMatch(app.panel({ isLoadingRutas: true }), /Asignar a:|No hay rutas compatibles/);
  assert.match(app.panel({ errorRutas: new Error('HTTP 500') }), /No se pudieron cargar las rutas/);
  assert.match(app.panel({ errorRutas: new Error('HTTP 500') }), /Reintentar/);
  assert.doesNotMatch(app.panel({ errorRutas: new Error('HTTP 500') }), /Asignar a:|No hay rutas compatibles/);
  assert.match(app.panel({ rutas: [{ ...ruta, zona_id: 'otra' }] }), /No hay rutas compatibles/);
});

test('D05: reasignación exitosa actualiza rutas y candidatos y cierra el modal', async t => {
  const app = setup(t); let closed = false;
  const mutation = app.hooks.useReasignarRepartidor(() => { closed = true; });
  await mutation.mutateAsync({ rutaId: ruta.id, repartidorId: '2' });
  assert.deepEqual(app.requests, [[`/api/rutas/${ruta.id}/repartidor`, { repartidor_id: '2' }]]);
  assert.deepEqual(app.invalidaciones, [['rutas'], ['repartidores-despacho']]);
  assert.equal(closed, true);
  assert.equal(app.mensajes[0][0], 'success');
});

test('D11: asignación exitosa actualiza tanto rutas como pedidos', async t => {
  const app = setup(t);
  await app.hooks.useAgregarPedidoARuta().mutateAsync({ ruta_id: ruta.id, pedido_id: pedido.id });
  assert.deepEqual(app.requests, [['/api/rutas/asignar-pedido', { ruta_id: ruta.id, pedido_id: pedido.id }]]);
  assert.deepEqual(app.invalidaciones, [['rutas'], ['pedidos']]);
  assert.equal(app.mensajes[0][0], 'success');
});

for (const [caso, message] of [['servidor', 'No se pudo guardar el cambio en despacho'], ['concurrencia', 'Pedido ya asignado o ruta llena']]) {
  test(`D11: error de ${caso} visible y sin éxito falso`, async t => {
    const app = setup(t); const error = new Error(message);
    app.setWrite(async () => { throw error; });
    await assert.rejects(app.hooks.useAgregarPedidoARuta().mutateAsync({ ruta_id: ruta.id, pedido_id: pedido.id }));
    assert.equal(app.mensajes.some(([kind]) => kind === 'success'), false);
    assert.match(app.mensajes[0][1], caso === 'concurrencia' ? /Conflicto de asignación/ : /No se pudo guardar/);
    app.setMutation({ error, isPending: false });
    assert.match(app.panel(), /role="alert"/);
    assert.match(app.panel(), caso === 'concurrencia' ? /Conflicto de asignación/ : /No se pudo guardar/);
  });
}

test('D05: conflicto de disponibilidad no cierra modal ni muestra éxito', async t => {
  const app = setup(t); let closed = false;
  const error = new Error('Repartidor no disponible');
  app.setWrite(async () => { throw error; });
  await assert.rejects(app.hooks.useReasignarRepartidor(() => { closed = true; }).mutateAsync({ rutaId: ruta.id, repartidorId: '2' }));
  assert.equal(closed, false);
  assert.equal(app.mensajes.some(([kind]) => kind === 'success'), false);
  assert.deepEqual(app.invalidaciones, [['rutas'], ['repartidores-despacho']]);
  app.setMutation({ error, isPending: false });
  assert.match(app.modal(), /Conflicto de asignación/);
});

test('D05: un registro explícitamente inactivo se rechaza y no llega al selector', async t => {
  const app = setup(t);
  app.setGet(async () => ({ data: { data: [{ id: 4, nombre: 'Inactivo', estado: 'inactivo' }] } }));
  app.hooks.useDisponibilidadRepartidores(ruta.fecha_entrega, true);
  await assert.rejects(app.query().queryFn(), /Respuesta de repartidores inesperada/);
});

/* eslint-disable @typescript-eslint/no-require-imports -- Convención node:test existente. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { QueryClient, QueryObserver } = require('@tanstack/react-query');

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const localRequire = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (!id.startsWith('@/') && !id.startsWith('.')) return require(id);
      const base = id.startsWith('@/') ? path.resolve(__dirname, '../src', id.slice(2)) : path.resolve(path.dirname(file), id);
      const target = [base + '.ts', base + '.tsx'].find(fs.existsSync); assert.ok(target, id); return load(target);
    };
    new Function('require', 'module', 'exports', output)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return name => load(path.resolve(__dirname, '../src', name));
}
const row = id => ({ id, cliente_id: 3, proveedor_id: 8, codigo_seguimiento: null,
  estados_pedido: { nombre: 'pendiente' }, fecha_creacion: '2026-11-12T16:00:00Z', fecha_programada: null,
  total: '12.50', ruta_id: null, usuarios: { nombre: 'Cliente QA', apellido: null },
  proveedores: { nombre_comercial: 'Tienda QA' }, direcciones: null });
const envelope = (data = [row(101)], page = 1, page_size = 20, total = data.length) =>
  ({ success: true, data, meta: { page, page_size, total, total_pages: Math.ceil(total / page_size) } });
const settle = () => new Promise(resolve => setImmediate(resolve));
const detail = (id = 101) => ({ id, cliente_id: 3, codigo_seguimiento: null,
  estados_pedido: { nombre: 'pendiente' }, fecha_creacion: '2026-11-12T16:00:00Z', fecha_programada: null, fecha_entrega_final: null,
  instrucciones_especiales: null, orden_en_ruta: null, subtotal: '10.00', costo_envio: '2.50', impuesto: null, descuento: null, total: '12.50',
  proveedores: { id: 8, nombre_comercial: 'Tienda QA' }, direcciones: null, ruta: null,
  detalle_pedido: [{ id: 1, cantidad: 2, precio_unitario: '5.00', subtotal: '10.00',
    items: { id: 7, nombre: 'Producto QA', es_servicio: false }, variaciones_item: null }],
});

function setup(t, rol = 'administrador') {
  let actor = { id: '1', rol }, options, observer, response, failure, pending, cursor = 0;
  const states = [], requests = [];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const load = loader({
    react: { ...React, useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial;
      return [states[i], value => { states[i] = value; }]; } },
    '@/store/auth.store': { useAuthStore: fn => fn({ usuario: actor }) },
    '@/lib/api-client': { apiClient: { get: async (url, config) => {
      requests.push({ url, signal: config?.signal }); if (pending) return pending(url, config?.signal);
      if (failure) throw failure; const query = new URL(url, 'http://qa.invalid').searchParams;
      const page = Number(query.get('page') ?? 1), size = Number(query.get('page_size') ?? 20);
      const cantidad = Math.max(0, Math.min(size, 21 - (page - 1) * size));
      return { data: response ?? envelope(Array.from({ length: cantidad }, (_, i) => row(101 + (page - 1) * size + i)), page, size, 21) };
    } } },
    '@tanstack/react-query': { useQuery: value => { options = value; return observer?.getCurrentResult() ?? { isLoading: true }; } },
  });
  const hooks = load('hooks/use-consultas-pedidos.ts');
  const Page = load('components/pedidos/pedidos-administracion.tsx').PedidosAdministracion;
  const Detalle = load('components/pedidos/detalle-pedido.tsx').DetallePedido;
  function tree() { cursor = 0; return Page(); }
  let unsubscribe;
  t.after(() => { unsubscribe?.(); observer?.destroy(); client.clear(); });
  return { load, requests, states, client, hooks, tree, options: () => options,
    html: () => renderToStaticMarkup(tree()), actor: value => { actor = value; }, response: value => { response = value; },
    failure: value => { failure = value; }, pending: value => { pending = value; },
    config: filtros => { hooks.usePedidosAdministracion(filtros); return { ...options, retry: false }; },
    start: () => { tree(); observer = new QueryObserver(client, { ...options, retry: false }); unsubscribe = observer.subscribe(() => {}); return observer; },
    sync: () => { tree(); observer.setOptions({ ...options, retry: false }); }, observer: () => observer,
    detailTree: id => Detalle({ pedidoId: id }), detailHtml: id => renderToStaticMarkup(Detalle({ pedidoId: id })),
    configDetail: id => { hooks.useDetallePedido(id); return { ...options, retry: false }; },
    startDetail: id => { Detalle({ pedidoId: id }); observer = new QueryObserver(client, { ...options, retry: false }); unsubscribe = observer.subscribe(() => {}); return observer; },
    syncDetail: id => { Detalle({ pedidoId: id }); observer.setOptions({ ...options, retry: false }); },
  };
}
function find(node, predicate) {
  if (!React.isValidElement(node)) return null; if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props.children)) { const found = find(child, predicate); if (found) return found; }
  return null;
}

test('5.1 web: consume contrato real, total remoto y campos nulos sin inventar programación/ruta', async t => {
  const app = setup(t); app.response(envelope()); app.start(); await settle();
  assert.match(app.html(), /Cliente QA|Tienda QA/); assert.match(app.html(), /Sin programación/);
  assert.match(app.html(), /1 pedido\(s\) en total/); assert.equal(app.requests[0].url, '/api/pedidos?page=1&page_size=20');
});
test('5.1 web: vacío legítimo no es error', async t => {
  const app = setup(t); app.response(envelope([])); app.start(); await settle();
  assert.match(app.html(), /Sin pedidos para mostrar/); assert.doesNotMatch(app.html(), /role="alert"/);
});
test('Cierre 5.1: fechas del listado usan Guayaquil aunque el navegador esté en UTC', async t => {
  const anterior = process.env.TZ; process.env.TZ = 'UTC';
  t.after(() => { if (anterior === undefined) delete process.env.TZ; else process.env.TZ = anterior; });
  const app = setup(t);
  app.response(envelope([{ ...row(101), fecha_creacion: '2026-11-13T04:59:59Z', fecha_programada: '2026-11-14T04:59:59Z' }]));
  app.start(); await settle(); const html = app.html();
  assert.ok(html.includes('12/11/2026'), 'La creación corresponde al día 12 en Guayaquil');
  assert.ok(html.includes('13/11/2026'), 'La programación corresponde al día 13 en Guayaquil');
  assert.ok(!html.includes('14/11/2026'), 'No usar el día UTC para la programación');
});
for (const rol of ['cliente', 'proveedor', 'repartidor', 'admin']) {
  test(`5.1 web: ${rol} no consulta global aunque se invoque queryFn directamente`, async t => {
    const app = setup(t, rol); const config = app.config({}); assert.equal(config.enabled, false);
    assert.throws(() => config.queryFn(), /requiere una sesión de administrador/);
    assert.deepEqual(app.requests, []); assert.match(app.html(), /requiere una sesión de administrador/);
  });
}
test('5.1 web: respuesta inválida, duplicados y metadatos incoherentes no se convierten en vacío', async t => {
  const app = setup(t); const service = app.load('services/pedidos-consultas.service.ts');
  for (const value of [[], {}, { success: false, data: [] }, envelope([{}]), envelope([], 1, 20, 1),
    { ...envelope(), meta: { page: 1, page_size: 20, total: 1, total_pages: 9 } }, envelope([row(1), row(1)])]) {
    app.response(value); await assert.rejects(service.consultarPedidosAdministracion({}), /inesperada|inconsistente/);
  }
});
test('5.1 web: formulario aplica filtros reales, no consulta por pulsación y restablece página', async t => {
  const app = setup(t); app.response(envelope([])); app.start(); await settle();
  const change = (label, value) => { find(app.tree(), n => n.props['aria-label'] === label).props.onChange({ target: { value } }); app.sync(); };
  change('Proveedor (ID)', '8'); change('Zona (ID)', '2'); change('Estado', 'pendiente');
  change('Creado desde', '2026-11-12'); change('Creado hasta', '2026-11-12'); await settle();
  assert.equal(app.requests.length, 1);
  find(app.tree(), n => n.type === 'form').props.onSubmit({ preventDefault() {} }); app.sync(); await settle();
  const query = new URL(app.requests.at(-1).url, 'http://qa.invalid').searchParams;
  for (const [key, value] of Object.entries({ proveedor_id: '8', zona_id: '2', estado: 'pendiente', fecha_desde: '2026-11-12', fecha_hasta: '2026-11-12' })) assert.equal(query.get(key), value);
  find(app.tree(), n => n.props.children === 'Restablecer filtros').props.onClick(); app.sync(); await settle();
  assert.equal(app.options().queryKey.at(-1).proveedor_id, undefined);
});
test('5.1 web: paginación real cambia page y page_size y conserva total global', async t => {
  const app = setup(t); app.start(); await settle();
  assert.equal(find(app.tree(), n => n.props.children === 'Siguiente').props.disabled, false);
  find(app.tree(), n => n.props.children === 'Siguiente').props.onClick(); app.sync(); await settle();
  assert.ok(app.requests.at(-1).url.includes('page=2')); assert.match(app.html(), /PED-121/); assert.match(app.html(), /21 pedido\(s\)/);
  assert.equal(find(app.tree(), n => n.props.children === 'Siguiente').props.disabled, true);
  find(app.tree(), n => n.props['aria-label'] === 'Por página').props.onChange({ target: { value: '50' } }); app.response(envelope([], 1, 50)); app.sync(); await settle();
  assert.equal(app.options().queryKey.at(-1).page, 1); assert.ok(app.requests.at(-1).url.includes('page_size=50'));
});
test('5.1 web: error seguro visible, carga inicial y reintento funcional', async t => {
  const app = setup(t); const { ErrorHttp } = app.load('lib/error-http.ts'); app.failure(new ErrorHttp(500));
  app.start(); assert.match(app.html(), /Cargando pedidos/); await settle();
  assert.match(app.html(), /servidor no pudo/); assert.doesNotMatch(app.html(), /Sin pedidos para mostrar|Prisma|SQL/);
  app.failure(null); app.response(envelope()); find(app.tree(), n => n.type.name === 'ErrorConsulta').props.reintentar(); await settle();
  assert.match(app.html(), /Cliente QA/);
});
test('5.1 web: cambiar de sesión cancela GET anterior y no muestra sus datos', async t => {
  const app = setup(t); let aborted = false;
  app.pending((url, signal) => new Promise((resolve, reject) => { void resolve;
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('cancelada')); }, { once: true });
  }));
  const observer = new QueryObserver(app.client, app.config({})); const unsubscribe = observer.subscribe(() => {}); t.after(unsubscribe); await settle();
  app.actor({ id: '2', rol: 'cliente' }); observer.setOptions(app.config({})); await settle();
  assert.equal(aborted, true); assert.equal(observer.getCurrentResult().data, undefined); assert.equal(app.requests.length, 1);
});

test('5.2 web: consulta por ID, carga y detalle completo con opcionales nulos', async t => {
  const app = setup(t); app.response({ success: true, data: detail() }); app.startDetail('101');
  assert.match(app.detailHtml('101'), /Cargando detalle/); await settle();
  assert.equal(app.requests[0].url, '/api/pedidos/101');
  const html = app.detailHtml('101'); assert.match(html, /Producto QA/); assert.match(html, /Sin dirección registrada/);
  assert.match(html, /Sin ruta asignada/); assert.match(html, /Total/); assert.match(html, /No informad/);
});
test('5.2 web: muestra dirección, programación, zona, ruta, variación y entrega confirmada reales', async t => {
  const app = setup(t); const pedido = detail();
  app.response({ success: true, data: { ...pedido,
    fecha_programada: '2026-11-12T17:00:00Z', fecha_entrega_final: '2026-11-12T18:00:00Z', orden_en_ruta: 1,
    instrucciones_especiales: 'Instrucción QA',
    direcciones: { id: 9, nombre_ubicacion: 'Casa QA', direccion: 'Calle QA', ciudad: 'Ciudad QA', referencia: 'Puerta QA', zona: { id: 2, nombre: 'Zona QA' } },
    ruta: { id: 'ruta-qa', repartidor_id: 5, fecha_entrega: '2026-11-12', estado: 'completada' },
    detalle_pedido: [{ ...pedido.detalle_pedido[0], variaciones_item: { id: 4, nombre_variacion: 'Con envoltorio QA' } }],
  } });
  app.startDetail('101'); await settle(); const html = app.detailHtml('101');
  for (const text of ['Calle QA', 'Ciudad QA', 'Puerta QA', 'Zona QA', 'ruta-qa', 'Con envoltorio QA', 'Instrucción QA', 'Parada: 1']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Sin ruta asignada|Sin dirección registrada|Programación: No informada/);
});
for (const [status, text] of [[404, 'Pedido inexistente o no disponible'], [403, 'Acceso denegado'], [500, 'servidor no pudo']]) {
  test(`5.2 web: error ${status} tiene estado explícito y nunca muestra datos anteriores`, async t => {
    const app = setup(t); app.failure(new (app.load('lib/error-http.ts').ErrorHttp)(status)); app.startDetail('101'); await settle();
    assert.match(app.detailHtml('101'), new RegExp(text)); assert.doesNotMatch(app.detailHtml('101'), /Producto QA|Prisma|SQL/);
    if (status === 500) {
      app.failure(null); app.response({ success: true, data: detail() });
      find(app.detailTree('101'), n => n.type.name === 'ErrorConsulta').props.reintentar(); await settle();
      assert.match(app.detailHtml('101'), /Producto QA/);
    }
  });
}
test('5.2 web: formato/ID de respuesta incorrectos y campos obligatorios no producen datos inventados', async t => {
  const app = setup(t); const service = app.load('services/pedidos-consultas.service.ts');
  for (const data of [{}, { success: true, data: detail(102) }, { success: true, data: { ...detail(), estados_pedido: null } },
    { success: true, data: { ...detail(), total: undefined } }, { success: true, data: { ...detail(), cliente_id: undefined } }]) {
    app.response(data); await assert.rejects(service.consultarDetallePedido('101', 'administrador'), /inesperada|incompleta/);
  }
});
test('5.2 web: ID inválido no provoca GET y rol no autorizado no obtiene detalle', async t => {
  const app = setup(t);
  for (const id of ['0', '01', '1.2', '-1', '1x', '2147483648']) {
    assert.equal(app.configDetail(id).enabled, false);
    await assert.rejects(app.configDetail(id).queryFn(), /Identificador/);
    assert.match(app.detailHtml(id), /Identificador/);
  }
  app.actor({ id: '1', rol: 'admin' }); assert.equal(app.configDetail('101').enabled, false);
  await assert.rejects(app.configDetail('101').queryFn(), /sesión no permite/); assert.deepEqual(app.requests, []);
});
test('5.2 web: sesión cliente distinta rechaza respuesta ajena incluso con HTTP 200', async t => {
  const app = setup(t, 'cliente'); app.actor({ id: 4, rol: 'cliente' }); app.response({ success: true, data: detail() });
  await assert.rejects(app.configDetail('101').queryFn(), /no corresponde a esta sesión/);
});
test('5.2 web: repartidor no conserva ni muestra importes y valida asignación actual', async t => {
  const app = setup(t, 'repartidor'); app.actor({ id: '5', rol: 'repartidor' });
  app.response({ success: true, data: { ...detail(), ruta: { id: 'ruta-qa', repartidor_id: 5, estado: 'armando', fecha_entrega: '2026-11-12' } } });
  const observer = app.startDetail('101'); await settle(); assert.equal(observer.getCurrentResult().isSuccess, true);
  assert.equal(observer.getCurrentResult().data.total, undefined); assert.equal(observer.getCurrentResult().data.cliente_id, undefined);
  assert.doesNotMatch(app.detailHtml('101'), /Importes|Unitario|Subtotal|Total/);
  app.actor({ id: '6', rol: 'repartidor' }); app.syncDetail('101'); await settle();
  assert.equal(observer.getCurrentResult().isError, true); assert.doesNotMatch(app.detailHtml('101'), /Producto QA/);
});
test('5.2 web: proveedor valida identidad de tienda y no mantiene cliente_id', async t => {
  const app = setup(t, 'proveedor'); app.actor({ id: '4', rol: 'proveedor', proveedor_id: 8 }); app.response({ success: true, data: detail() });
  const result = await app.configDetail('101').queryFn(); assert.equal(result.cliente_id, undefined);
  app.actor({ id: '4', rol: 'proveedor', proveedor_id: 9 });
  await assert.rejects(app.configDetail('101').queryFn(), /no corresponde a esta sesión/);
});
test('5.2 web: cambio de usuario o ID cancela la respuesta anterior y aísla la caché', async t => {
  const app = setup(t); let aborted = false;
  app.pending((url, signal) => new Promise((resolve, reject) => { void resolve;
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('cancelada')); }, { once: true });
  }));
  const observer = app.startDetail('101'); await settle();
  app.actor({ id: '2', rol: 'administrador' }); app.pending(null); app.response({ success: true, data: detail(102) }); app.syncDetail('102');
  assert.equal(observer.getCurrentResult().data, undefined); await settle(); assert.equal(aborted, true);
  assert.deepEqual(observer.options.queryKey, ['pedidos', 'detalle', '2', 'administrador', '102']);
  assert.equal(observer.getCurrentResult().data.id, 102);
  app.actor(null); app.syncDetail('102'); await settle(); assert.match(app.detailHtml('102'), /Cargando sesión/);
  assert.equal(observer.getCurrentResult().data, undefined);
});
test('5.2 web: navegación al detalle desde administración, tabla autorizada y mis pedidos', async t => {
  const app = setup(t); app.response(envelope()); app.start(); await settle(); assert.match(app.html(), /href="\/pedidos\/101"/);
  // Además se renderizan las vistas reales con hooks HTTP simulados para comprobar sus enlaces.
  const load = loader({
    '@/store/auth.store': { useAuthStore: fn => fn({ usuario: { id: '3', rol: 'cliente' } }) },
    '@/hooks/use-pedidos': { useMisPedidosCliente: () => ({ data: [{ ...detail(), total: '12.50' }] }), useCambiarEstado: () => ({}) },
    'next/link': { __esModule: true, default: ({ href, children, className }) => React.createElement('a', { href, className }, children) },
  });
  const Page = load('app/(dashboard)/mis-pedidos/page.tsx').default;
  assert.match(renderToStaticMarkup(React.createElement(Page)), /href="\/pedidos\/101"/);
  const { TablaPedidos } = load('components/pedidos/tabla-pedidos.tsx');
  const pedido = { id: '101', numero_pedido: 'PED-101', cliente_nombre: 'Cliente QA', cliente_telefono: '', estado: 'pendiente',
    fecha_entrega: '', ventana_horaria: { desde: '2026-11-12T16:00:00Z', hasta: '2026-11-12T16:00:00Z' },
    direccion: { calle: 'Calle QA', numero: '', ciudad: 'QA' }, monto_total: 12.5, pago_confirmado: false };
  assert.match(renderToStaticMarkup(React.createElement(TablaPedidos, { pedidos: [pedido], isLoading: false })), /href="\/pedidos\/101"/);
});

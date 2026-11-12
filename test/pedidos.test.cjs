/* eslint-disable @typescript-eslint/no-require-imports -- Convención CommonJS de la suite node:test. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { QueryClient, MutationObserver } = require('@tanstack/react-query');

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
      const target = [base + '.ts', base + '.tsx'].find(fs.existsSync);
      assert.ok(target, id);
      return load(target);
    }
    new Function('require', 'module', 'exports', output)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return name => load(path.resolve(__dirname, '../src', name));
}

const item = { id: 11, proveedor_id: 8, nombre: 'Producto QA', activo: true, inventario_stock: 5,
  es_servicio: false, requiere_agendamiento: false, precio: '7.00', proveedores: { nombre_comercial: 'Tienda QA' } };
const usuario = { id: '3', rol: 'cliente', nombre: 'Cliente QA' };
const datos = { proveedor_id: 8, items_comprados: [{ item_id: 11, cantidad: 2 }],
  fecha_entrega: '2026-11-12', hora_entrega: '23:59',
  direccion: { nombre_ubicacion: 'Casa', direccion: 'Calle Prueba 42', ciudad: 'Ambato', zona_id: 2, referencia: 'Puerta azul' },
  instrucciones_especiales: 'Llamar al llegar' };
const raw = { id: 10, proveedor_id: 8, cliente_id: 3, total: '16.50',
  fecha_creacion: '2026-11-11T18:00:00.000Z', fecha_programada: '2026-11-13T04:59:00.000Z',
  estados_pedido: { nombre: 'pendiente' }, usuarios: { nombre: 'Cliente QA', telefono: '000' },
  direcciones: { id: 9, direccion: 'Calle Prueba 42', ciudad: 'Ambato', zona_id: 2, latitud: null, longitud: null } };

function apiSetup() {
  const requests = [];
  let get = async () => ({ data: [raw] });
  let post = async url => ({ data: url === '/api/datos/direcciones' ? { id: 9 } : { pedido: raw } });
  const load = loader({ '@/lib/api-client': { apiClient: {
    get: async url => { requests.push(['GET', url]); return get(url); },
    post: async (url, body) => { requests.push(['POST', url, body]); return post(url, body); },
  } } });
  return { load, requests, setGet: fn => { get = fn; }, setPost: fn => { post = fn; }, ...load('services/pedidos.service.ts') };
}

const contrato = loader()('services/pedidos-contrato.ts');
for (const [fecha, hora, iso] of [
  ['2026-11-12', '23:59', '2026-11-13T04:59:00.000Z'],
  ['2026-11-12', '00:01', '2026-11-12T05:01:00.000Z'],
  ['2028-02-29', '00:00', '2028-02-29T05:00:00.000Z'],
]) {
  test(`D03: ${fecha} ${hora} Guayaquil conserva el instante en UTC`, () => assert.equal(contrato.programarEntrega(fecha, hora), iso));
}
for (const [fecha, hora] of [['2026-02-29', '12:00'], ['2026-04-31', '12:00'], ['2026-11-12', '24:00'], ['', '12:00']]) {
  test(`D03: rechaza programación inválida ${fecha} ${hora}`, () => assert.throws(() => contrato.programarEntrega(fecha, hora)));
}

test('D02/D03: payload real conserva dirección, zona, productos y horario; sin precios ni cliente arbitrario', async () => {
  const app = apiSetup();
  const result = await app.crearRegistroPedido()(datos, usuario, [item]);
  assert.deepEqual(app.requests, [
    ['POST', '/api/datos/direcciones', { ...datos.direccion, es_principal: false }],
    ['POST', '/api/pedidos', { proveedor_id: 8, direccion_id: 9, items_comprados: datos.items_comprados,
      fecha_programada: '2026-11-13T04:59:00.000Z', instrucciones_especiales: datos.instrucciones_especiales }],
  ]);
  assert.equal(result.fecha_entrega, '2026-11-12');
  assert.equal(result.ventana_horaria.desde, '23:59');
  assert.equal(result.monto_total, 16.5);
  assert.equal(result.direccion.latitud, undefined);
  assert.equal(result.direccion.longitud, undefined);
});

for (const [caso, cambios] of [
  ['sin productos', { items_comprados: [] }],
  ['cantidad cero', { items_comprados: [{ item_id: 11, cantidad: 0 }] }],
  ['cantidad fraccionaria', { items_comprados: [{ item_id: 11, cantidad: 1.5 }] }],
  ['producto desconocido', { items_comprados: [{ item_id: 99, cantidad: 1 }] }],
  ['proveedor incorrecto', { proveedor_id: 9 }],
  ['stock insuficiente', { items_comprados: [{ item_id: 11, cantidad: 6 }] }],
  ['ciudad vacía', { direccion: { ...datos.direccion, ciudad: ' ' } }],
  ['dirección vacía', { direccion: { ...datos.direccion, direccion: '' } }],
  ['zona vacía', { direccion: { ...datos.direccion, zona_id: 0 } }],
]) {
  test(`D02/D03: rechaza ${caso} antes de crear dirección o pedido`, async () => {
    const app = apiSetup();
    await assert.rejects(app.crearRegistroPedido()({ ...datos, ...cambios }, usuario, [item]));
    assert.deepEqual(app.requests, []);
  });
}
for (const rol of ['proveedor', 'administrador', 'repartidor', undefined]) {
  test(`D02: rol ${rol} no puede crear en nombre del cliente`, async () => {
    const app = apiSetup();
    await assert.rejects(app.crearRegistroPedido()(datos, rol ? { ...usuario, rol } : null, [item]), /Solo el cliente/);
    assert.deepEqual(app.requests, []);
  });
}
test('D03: conserva coordenadas cero si fueron proporcionadas', async () => {
  const app = apiSetup();
  await app.crearRegistroPedido()({ ...datos, direccion: { ...datos.direccion, latitud: 0, longitud: 0 } }, usuario, [item]);
  assert.equal(app.requests[0][2].latitud, 0);
  assert.equal(app.requests[0][2].longitud, 0);
});
test('D03: error después de registrar dirección conserva ID y no duplica dirección al reintentar', async () => {
  const app = apiSetup(); let fail = true;
  app.setPost(async url => {
    if (url === '/api/datos/direcciones') return { data: { id: 9 } };
    if (fail) throw new Error('Stock insuficiente comunicado por API');
    return { data: { pedido: raw } };
  });
  const registrar = app.crearRegistroPedido();
  await assert.rejects(registrar(datos, usuario, [item]), /Stock insuficiente/);
  fail = false;
  await registrar(datos, usuario, [item]);
  assert.equal(app.requests.filter(([, url]) => url === '/api/datos/direcciones').length, 1);
  assert.equal(app.requests.filter(([, url]) => url === '/api/pedidos').length, 2);
});
test('D03: error de dirección detiene el flujo, sin ignorar la excepción', async () => {
  const app = apiSetup(); app.setPost(async () => { throw new Error('Dirección rechazada'); });
  await assert.rejects(app.crearRegistroPedido()(datos, usuario, [item]), /Dirección rechazada/);
  assert.equal(app.requests.length, 1);
});
test('D02/D03: respuesta 2xx inesperada no anuncia éxito ni repite ciegamente una operación confirmable', async () => {
  const app = apiSetup();
  app.setPost(async url => ({ data: url === '/api/datos/direcciones' ? { id: 9 } : {} }));
  const registrar = app.crearRegistroPedido();
  await assert.rejects(registrar(datos, usuario, [item]), /inesperada/);
  await assert.rejects(registrar(datos, usuario, [item]), /Revisa Mis pedidos/);
  assert.equal(app.requests.length, 2);
});

for (const [rol, endpoint] of [['cliente', '/api/pedidos/mis-pedidos'], ['proveedor', '/api/pedidos/tienda']]) {
  test(`D04: ${rol} usa exclusivamente su contrato autorizado`, async () => {
    const app = apiSetup();
    assert.equal((await app.pedidosService.listarPedidosPorRol(rol)).total, 1);
    assert.deepEqual(app.requests, [['GET', endpoint]]);
  });
}
test('D04: administrador no ejecuta consulta global ficticia ni fallback de tienda', () => {
  const app = apiSetup();
  assert.throws(() => app.pedidosService.listarPedidosPorRol('administrador'), /no ofrece un listado global/);
  assert.deepEqual(app.requests, []);
  assert.equal(app.pedidosService.obtenerPedido, undefined);
  assert.equal(app.pedidosService.listarTodosPedidos, undefined);
});
test('D04: filtros locales respetan fecha Guayaquil, zona y búsqueda; estado usa parámetro real', async () => {
  const app = apiSetup();
  const filtros = { estado: 'pendiente', fecha: '2026-11-12', zona_id: '2', busqueda: 'Prueba 42' };
  assert.equal((await app.pedidosService.listarPedidosTienda(filtros)).total, 1);
  assert.deepEqual(app.requests, [['GET', '/api/pedidos/tienda?estado=pendiente']]);
  assert.equal((await app.pedidosService.listarPedidosCliente({ fecha: '2026-11-13' })).total, 0);
});
test('D04: arreglo vacío es válido; forma inesperada y HTTP fallido se propagan sin fallback', async () => {
  const app = apiSetup();
  app.setGet(async () => ({ data: [] }));
  assert.equal((await app.pedidosService.listarPedidosCliente()).total, 0);
  for (const data of [null, {}, { data: [raw] }, [{}]]) {
    app.setGet(async () => ({ data }));
    await assert.rejects(app.pedidosService.listarPedidosCliente(), /Respuesta de pedidos inesperada/);
  }
  app.requests.length = 0;
  const failure = new Error('No tienes permisos (HTTP 403 simulado)');
  app.setGet(async () => { throw failure; });
  await assert.rejects(app.pedidosService.listarPedidosTienda(), error => error === failure);
  assert.deepEqual(app.requests, [['GET', '/api/pedidos/tienda']]);
});

function find(node, predicate) {
  if (!React.isValidElement(node)) return null;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const found = find(child, predicate); if (found) return found;
  }
  return null;
}

function uiSetup(t, rol = 'cliente') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  const requests = [], messages = [], invalidations = [], navigation = [];
  let formValues = structuredClone(datos), formErrors = {}, resets = 0, cleared = false;
  let mutationResult = {}, queryResult = { data: { data: [], total: 0 }, isLoading: false, isError: false };
  let pending, memo, queryOptions, fail = false, cursor = 0;
  const state = [];
  const actor = { ...usuario, rol };
  const load = loader({
    react: { ...React, useMemo: factory => memo ?? (memo = factory()), useState: initial => {
      const index = cursor++; if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], value => { state[index] = value; }];
    } },
    '@/store/auth.store': { useAuthStore: selector => selector({ usuario: actor }) },
    '@/lib/api-client': { apiClient: {
      get: async url => { requests.push(['GET', url]);
        if (url.startsWith('/api/pedidos?')) return { data: { success: true, data: [{ ...raw, codigo_seguimiento: null, ruta_id: null,
          usuarios: { nombre: 'Cliente QA', apellido: null }, proveedores: { nombre_comercial: 'Tienda QA' } }],
          meta: { page: 1, page_size: 20, total: 1, total_pages: 1 } } };
        return { data: url.startsWith('/api/pedidos/') ? [raw] : [item] }; },
      post: async (url, body) => { requests.push(['POST', url, body]);
        if (url === '/api/datos/direcciones') return { data: { id: 9 } };
        if (fail) throw new Error('Stock insuficiente de API');
        return { data: { pedido: raw } };
      },
    } },
    sonner: { toast: { success: text => messages.push(['success', text]), error: text => messages.push(['error', text]) } },
    'next/navigation': { useRouter: () => ({ push: url => navigation.push(url) }) },
    'next/link': { __esModule: true, default: ({ children, href }) => React.createElement('a', { href }, children) },
    '@/store/carrito.store': { useCarritoStore: () => ({ items: [{ item_id: 11, proveedor_id: 8, cantidad: 2, nombre: 'Producto QA', precio: 7 }], proveedor_id: 8,
      nombre_tienda: 'Tienda QA', vaciarCarrito: () => { cleared = true; }, removerItem() {}, actualizarCantidad() {},
      obtenerSubtotal: () => 14, obtenerCostoEnvio: () => 2.5, obtenerTotal: () => 16.5,
    }) },
    'react-hook-form': {
      useForm: options => ({ control: {}, register: name => ({ name }), reset: () => { resets++; }, formState: { errors: formErrors },
        handleSubmit: callback => async event => {
          event.preventDefault(); const result = await options.resolver(formValues, {}, { fields: {}, shouldUseNativeValidation: false });
          formErrors = result.errors; if (!Object.keys(result.errors).length) callback(result.values);
        },
      }),
      useWatch: () => formValues.proveedor_id,
      useFieldArray: () => ({ fields: formValues.items_comprados.map((line, i) => ({ ...line, id: String(i) })), append() {}, remove() {}, replace() {} }),
    },
    '@tanstack/react-query': {
      useQueryClient: () => ({ invalidateQueries: ({ queryKey }) => { invalidations.push(queryKey); return Promise.resolve(); } }),
      useQuery: options => {
        if (options.queryKey[0] === 'zonas') return { data: [{ id: '2', nombre: 'Centro', activa: true }] };
        if (options.queryKey[0] === 'catalogo-items') return { data: [item] };
        queryOptions = options; return { refetch() {}, ...queryResult };
      },
      useMutation: options => {
        const observer = new MutationObserver(client, options);
        t.after(observer.subscribe(result => { mutationResult = result; }));
        return { ...mutationResult, mutate: (body, callbacks) => { pending = observer.mutate(body, callbacks); void pending.catch(() => {}); } };
      },
    },
  });
  t.after(() => client.clear());
  const Modal = load('components/pedidos/modal-nuevo-pedido.tsx').ModalNuevoPedido;
  const Page = load('app/(dashboard)/pedidos/page.tsx').default;
  const Checkout = load('app/(dashboard)/checkout/page.tsx').default;
  return {
    requests, messages, invalidations, navigation, query: () => queryOptions,
    ContratoPedidosError: load('services/pedidos-contrato.ts').ContratoPedidosError,
    fail: value => { fail = value; }, values: () => formValues, resets: () => resets, cleared: () => cleared,
    setValues: value => { formValues = value; }, setQuery: value => { queryResult = value; }, wait: () => pending,
    modalTree: () => { cursor = 0; return Modal({ open: true, onOpenChange() {} }); },
    modalHtml: () => { cursor = 0; return renderToStaticMarkup(React.createElement(Modal, { open: true, onOpenChange() {} })); },
    pageHtml: () => { cursor = 0; return renderToStaticMarkup(React.createElement(Page)); },
    checkoutTree: () => { cursor = 0; return Checkout(); },
  };
}

test('D02 UI: fallo HTTP conserva formulario; éxito invalida pedidos y reinicia solo después de confirmar', async t => {
  const app = uiSetup(t); app.fail(true);
  await find(app.modalTree(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await assert.rejects(app.wait(), /Stock insuficiente/);
  assert.equal(app.resets(), 0);
  assert.deepEqual(app.values(), datos);
  assert.match(app.modalHtml(), /Stock insuficiente de API/);
  assert.equal(app.messages.some(([kind]) => kind === 'success'), false);
  app.fail(false);
  await find(app.modalTree(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await app.wait();
  assert.equal(app.resets(), 1);
  assert.deepEqual(app.invalidations, [['pedidos'], ['mis-pedidos-cliente']]);
  assert.equal(app.requests.filter(([, url]) => url === '/api/datos/direcciones').length, 1);
});
test('D02 UI: productos vacíos no generan solicitud y proveedor no recibe formulario de creación', async t => {
  const app = uiSetup(t); app.setValues({ ...datos, items_comprados: [] });
  await find(app.modalTree(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(app.requests, []);
  assert.match(app.modalHtml(), /Selecciona al menos un producto/);
  const provider = uiSetup(t, 'proveedor');
  assert.match(provider.modalHtml(), /no está disponible para tu rol/);
  assert.equal(find(provider.modalTree(), node => node.type === 'form'), null);
});
test('D04 UI: error HTTP y contrato global faltante se distinguen del estado vacío', t => {
  const app = uiSetup(t);
  assert.match(app.pageHtml(), /Sin pedidos para mostrar/);
  app.setQuery({ isLoading: false, isError: true, error: new Error('HTTP 403: sin permisos') });
  assert.match(app.pageHtml(), /HTTP 403: sin permisos/);
  assert.match(app.pageHtml(), /Reintentar/);
  assert.doesNotMatch(app.pageHtml(), /Sin pedidos para mostrar/);
  const admin = uiSetup(t, 'administrador');
  admin.setQuery({ isLoading: false, isError: true, error: new admin.ContratoPedidosError('Sin contrato global') });
  assert.match(admin.pageHtml(), /Sin contrato global/);
  assert.doesNotMatch(admin.pageHtml(), /Reintentar|Sin pedidos para mostrar/);
});

for (const [rol, endpoint] of [['cliente', '/api/pedidos/mis-pedidos'], ['proveedor', '/api/pedidos/tienda']]) {
  test(`D04 hook: la pantalla ${rol} elige la consulta autorizada y separa su caché`, async t => {
    const app = uiSetup(t, rol);
    app.pageHtml();
    assert.ok(app.query().queryKey.includes(rol));
    assert.equal((await app.query().queryFn()).total, 1);
    assert.deepEqual(app.requests, [['GET', endpoint]]);
  });
}
test('D04/5.1 hook: administración consume contrato global real sin fallback de tienda', async t => {
  const app = uiSetup(t, 'administrador');
  app.pageHtml();
  assert.equal((await app.query().queryFn()).meta.total, 1);
  assert.equal(app.query().retry(0, new app.ContratoPedidosError('Sin contrato')), false);
  assert.deepEqual(app.requests, [['GET', '/api/pedidos?page=1&page_size=20']]);
});
test('Regresión checkout: conserva UI y carrito al fallar; comparte dirección confirmada y payload correcto al reintentar', async t => {
  const app = uiSetup(t);
  for (const [id, value] of [['calle', 'Calle Prueba 42'], ['ciudad', 'Ambato'], ['zona', '2'], ['fecha_entrega', '2026-11-12'], ['hora_entrega', '23:59']]) {
    find(app.checkoutTree(), node => node.props.id === id).props.onChange({ target: { value } });
  }
  app.fail(true);
  await find(app.checkoutTree(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(app.cleared(), false);
  assert.deepEqual(app.navigation, []);
  assert.equal(app.messages.some(([kind]) => kind === 'success'), false);
  app.fail(false);
  await find(app.checkoutTree(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(app.cleared(), true);
  assert.deepEqual(app.navigation, ['/mis-pedidos']);
  assert.equal(app.requests.filter(([, url]) => url === '/api/datos/direcciones').length, 1);
  assert.equal(app.requests.filter(([, url]) => url === '/api/pedidos').at(-1)[2].fecha_programada, '2026-11-13T04:59:00.000Z');
});

test('Cierre: volver de dirección A a B y a A reutiliza ambas confirmaciones sin duplicarlas', async () => {
  const app = apiSetup(); let id = 9;
  app.setPost(async url => {
    if (url === '/api/datos/direcciones') return { data: { id: id++ } };
    throw new Error('Stock insuficiente');
  });
  const registrar = app.crearRegistroPedido();
  for (const direccion of [datos.direccion, { ...datos.direccion, direccion: 'Otra calle 99' }, datos.direccion]) {
    await assert.rejects(registrar({ ...datos, direccion }, usuario, [item]), /Stock insuficiente/);
  }
  assert.equal(app.requests.filter(([, url]) => url === '/api/datos/direcciones').length, 2);
  assert.deepEqual(app.requests.filter(([, url]) => url === '/api/pedidos').map(([, , body]) => body.direccion_id), [9, 10, 9]);
});

test('Cierre: envíos simultáneos del mismo formulario no duplican dirección ni pedido', async () => {
  const app = apiSetup(); const resoluciones = [];
  app.setPost(async url => url === '/api/datos/direcciones'
    ? new Promise(resolve => { resoluciones.push(resolve); })
    : { data: { pedido: raw } });
  const registrar = app.crearRegistroPedido();
  const primera = registrar(datos, usuario, [item]);
  const segunda = registrar(datos, usuario, [item]);
  const resultados = Promise.allSettled([primera, segunda]);
  for (const resolver of resoluciones) resolver({ data: { id: 9 } });
  const [resultadoPrimera, resultadoSegunda] = await resultados;
  assert.equal(resultadoPrimera.status, 'fulfilled');
  assert.equal(resultadoSegunda.status, 'rejected');
  assert.match(resultadoSegunda.reason.message, /en curso/);
  assert.equal(app.requests.filter(([, url]) => url === '/api/datos/direcciones').length, 1);
  assert.equal(app.requests.filter(([, url]) => url === '/api/pedidos').length, 1);
});

test('Cierre: cambiar fecha o productos no duplica dirección; cambiar zona o cliente exige otra confirmación', async () => {
  const app = apiSetup();
  const registrar = app.crearRegistroPedido();
  await registrar(datos, usuario, [item]);
  await registrar({ ...datos, hora_entrega: '10:00', items_comprados: [{ item_id: 11, cantidad: 1 }] }, usuario, [item]);
  assert.equal(app.requests.filter(([, url]) => url === '/api/datos/direcciones').length, 1);
  await registrar({ ...datos, direccion: { ...datos.direccion, zona_id: 3 } }, usuario, [item]);
  await registrar(datos, { ...usuario, id: '4' }, [item]);
  assert.equal(app.requests.filter(([, url]) => url === '/api/datos/direcciones').length, 3);
});

test('Cierre: error de dirección sin confirmación permite reintentar y conserva los datos nuevos', async () => {
  const app = apiSetup(); let fail = true;
  app.setPost(async url => {
    if (fail) throw new Error('Dirección no registrada');
    return { data: url === '/api/datos/direcciones' ? { id: 12 } : { pedido: raw } };
  });
  const registrar = app.crearRegistroPedido();
  await assert.rejects(registrar(datos, usuario, [item]), /no registrada/);
  fail = false;
  const corregido = { ...datos, direccion: { ...datos.direccion, ciudad: 'Quito', referencia: 'Nueva referencia' } };
  await registrar(corregido, usuario, [item]);
  assert.equal(app.requests[1][2].ciudad, 'Quito');
  assert.equal(app.requests[1][2].referencia, 'Nueva referencia');
  assert.equal(app.requests[2][2].direccion_id, 12);
});

for (const rol of ['proveedor', 'administrador', 'admin', 'repartidor']) {
  test(`Cierre UI: ${rol} no recibe formulario ni acción de creación imposible`, t => {
    const app = uiSetup(t, rol);
    assert.equal(find(app.modalTree(), node => node.type === 'form'), null);
    assert.doesNotMatch(app.pageHtml(), /data-cy="btn-nuevo-pedido"/);
    assert.deepEqual(app.requests, []);
  });
}

test('Cierre permisos: el middleware permite checkout únicamente al cliente', async () => {
  const { NextRequest } = require('next/server');
  const middleware = loader()('middleware.ts').middleware;
  const original = global.fetch;
  try {
    for (const rol_nombre of ['cliente', 'proveedor', 'administrador', 'repartidor']) {
      global.fetch = async () => Response.json({ rol_nombre });
      const req = new NextRequest('http://localhost/checkout', { headers: { cookie: 'serv_token=jwt-simulado' } });
      const res = await middleware(req);
      if (rol_nombre === 'cliente') assert.equal(res.headers.get('x-middleware-next'), '1');
      else assert.match(res.headers.get('location'), /unauthorized/);
    }
  } finally { global.fetch = original; }
});

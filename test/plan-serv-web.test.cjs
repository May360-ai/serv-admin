/* eslint-disable @typescript-eslint/no-require-imports -- Convención node:test existente. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} };
    cache.set(file, loaded);
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (!id.startsWith('@/') && !id.startsWith('.')) return require(id);
      const base = id.startsWith('@/') ? path.resolve(__dirname, '../src', id.slice(2)) : path.resolve(path.dirname(file), id);
      const target = [base + '.ts', base + '.tsx'].find(fs.existsSync);
      assert.ok(target, id);
      return load(target);
    };
    new Function('require', 'module', 'exports', output)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return name => load(path.resolve(__dirname, '../src', name));
}

test('itemsService: listarCatalogo({ nombre }) y obtenerPorId(id) respetan el contrato', async () => {
  const requests = [];
  const producto = {
    id: 11,
    proveedor_id: 8,
    categoria_id: 2,
    nombre: 'Rosas',
    codigo: 'ROS-11',
    descripcion: 'Ramo rojo',
    precio: '7.00',
    peso_kg: '0.5',
    activo: true,
    inventario_stock: 5,
    es_servicio: false,
  };
  let responseData = [producto];
  const load = loader({
    '@/lib/api-client': {
      apiClient: {
        get: async url => {
          requests.push(url);
          return { data: responseData };
        },
      },
    },
  });
  const { itemsService } = load('services/items.service.ts');

  await itemsService.listarCatalogo();
  await itemsService.listarCatalogo({ nombre: ' Rosas ' });
  assert.deepEqual(requests, ['/api/items?', '/api/items?nombre=Rosas']);

  responseData = producto;
  const detalle = await itemsService.obtenerPorId(11);
  assert.equal(requests.at(-1), '/api/items/11');
  assert.equal(detalle.codigo, 'ROS-11');

  responseData = {};
  await assert.rejects(itemsService.obtenerPorId(11), /inesperada/);
});

test('ErrorHttp: traduce todos los códigos nuevos del plan SERV_DOC_001', () => {
  const { ErrorHttp } = loader()('lib/error-http.ts');
  for (const [status, codigo, pattern] of [
    [400, 'CEDULA_INVALIDA', /módulo 10/],
    [400, 'DATOS_INCOMPLETOS', /incompletos/],
    [400, 'DIMENSIONES_INVALIDAS', /peso y las dimensiones/],
    [400, 'CAPACIDAD_INVALIDA', /entre 1 y 20/],
    [401, 'PASSWORD_ACTUAL_INCORRECTO', /contraseña actual/],
    [409, 'CEDULA_DUPLICADA', /cédula ya está registrada/],
    [409, 'TELEFONO_DUPLICADO', /teléfono ya está registrado/],
    [409, 'CLIENTE_CON_PEDIDOS_ACTIVOS', /pedidos pendientes o en ruta/],
    [409, 'PRODUCTO_DUPLICADO', /nombre o código/],
    [409, 'PRODUCTO_EN_PEDIDO_ACTIVO', /pedidos activos/],
  ]) {
    const err = new ErrorHttp(status, codigo);
    assert.match(err.message, pattern);
  }
});

test('AdminClientesPage: incluye búsqueda por teléfono y filtro por zona', () => {
  const load = loader({
    react: {
      ...React,
      useState: initial => [initial, () => {}],
      useMemo: fn => fn(),
    },
    '@/store/auth.store': { useAuthStore: selector => selector({ usuario: { id: '1', rol: 'administrador' } }) },
    '@/lib/api-client': { apiClient: { get: async () => ({ data: { data: [] } }) } },
    '@tanstack/react-query': {
      useQuery: ({ queryKey }) => {
        if (queryKey[0] === 'zonas-filtro-clientes') return { data: [{ id: '2', nombre: 'Ficoa' }], isSuccess: true };
        return { data: [], isSuccess: true, refetch() {} };
      },
      useQueryClient: () => ({}),
      useMutation: () => ({ isPending: false, isError: false }),
    },
  });
  const Page = load('app/(dashboard)/admin/clientes/page.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.match(html, /Nombre, apellido, correo o teléfono/);
  assert.match(html, /Filtrar por zona/);
  assert.match(html, /Todas las zonas/);
  assert.match(html, /Ficoa/);
});

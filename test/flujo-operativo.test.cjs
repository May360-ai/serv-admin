/* eslint-disable @typescript-eslint/no-require-imports -- Suite CommonJS existente de node:test. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loader() {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} };
    cache.set(file, loaded);
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2017,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    function localRequire(id) {
      if (!id.startsWith('@/') && !id.startsWith('.')) return require(id);
      const base = id.startsWith('@/')
        ? path.resolve(__dirname, '../src', id.slice(2))
        : path.resolve(path.dirname(file), id);
      const target = [base + '.ts', base + '.tsx', base + '.js'].find(fs.existsSync);
      assert.ok(target, id);
      return load(target);
    }
    new Function('require', 'module', 'exports', output)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return (rel) => load(path.resolve(__dirname, '../src', rel));
}

const loadSrc = loader();
const { esAdministrador } = loadSrc('types/auth.ts');
const { esRutaCompatible } = loadSrc('features/despacho/elegibilidad.ts');
const { ErrorHttp } = loadSrc('lib/error-http.ts');
const { useCarritoStore } = loadSrc('store/carrito.store.ts');

test('esAdministrador acepta admin y administrador únicamente', () => {
  assert.equal(esAdministrador('admin'), true);
  assert.equal(esAdministrador('administrador'), true);
  for (const rol of ['proveedor', 'cliente', 'repartidor', '', undefined, null]) {
    assert.equal(esAdministrador(rol), false);
  }
});

test('esRutaCompatible acepta agendado y en_progreso y valida sucursal', () => {
  const ruta = {
    id: 'ruta-1',
    nombre: 'Centro',
    fecha_entrega: '2026-11-22',
    proveedor_id: 8,
    zona_id: '2',
    repartidor_id: '1',
    repartidor: { id: '1', nombre: 'Repartidor', estado: 'disponible' },
    sucursal: { id: '5', nombre: 'Matriz', direccion: 'Av. Principal' },
    pedidos: [],
    capacidad_maxima: 6,
    estado: 'armando',
  };
  const basePedido = {
    id: '10',
    cliente_nombre: 'Cliente',
    cliente_telefono: '000',
    fecha_entrega: '2026-11-22',
    tienda_id: '8',
    sucursal_id: '5',
    zona_id: '2',
    estado: 'agendado',
    direccion: { calle: 'Av. Cevallos', numero: '' },
    ventana_horaria: { desde: '12:00', hasta: '12:00' },
  };
  assert.equal(esRutaCompatible(basePedido, ruta), true);
  assert.equal(esRutaCompatible({ ...basePedido, estado: 'en_progreso' }, ruta), true);
  assert.equal(esRutaCompatible({ ...basePedido, sucursal_id: '9' }, ruta), false);
});

test('ErrorHttp mapea códigos 4xx de la lista blanca y oculta cuerpos desconocidos o 5xx', () => {
  assert.match(new ErrorHttp(409, 'ZONA_SOLAPADA').message, /superpone/i);
  assert.match(new ErrorHttp(409, 'PEDIDO_EN_CAMINO').message, /en camino/i);
  assert.match(new ErrorHttp(400, 'FECHA_PASADA').message, /hoy o una fecha futura/i);
  assert.match(new ErrorHttp(403, 'CUENTA_INACTIVA').message, /inactiva/i);
  assert.match(new ErrorHttp(409, 'EMAIL_DUPLICADO').message, /registrado/i);
  assert.match(new ErrorHttp(400, 'SQL_RAW_SECRET').message, /Revisa los datos/i);
  assert.doesNotMatch(new ErrorHttp(400, 'SQL_RAW_SECRET').message, /SQL_RAW_SECRET/);
  assert.match(new ErrorHttp(500, 'ZONA_SOLAPADA').message, /El servidor no pudo/i);
});

test('useCarritoStore separa variaciones por variacion_item_id y limita al stock', () => {
  const store = useCarritoStore.getState();
  store.vaciarCarrito();
  store.agregarItem(
    {
      item_id: 1,
      variacion_item_id: 10,
      variacion_nombre: 'Grande',
      nombre: 'Ramo',
      precio: 20,
      proveedor_id: 5,
      inventario_stock: 3,
    },
    2
  );
  store.agregarItem(
    {
      item_id: 1,
      variacion_item_id: 11,
      variacion_nombre: 'Pequeño',
      nombre: 'Ramo',
      precio: 12,
      proveedor_id: 5,
      inventario_stock: 5,
    },
    1
  );
  assert.equal(useCarritoStore.getState().items.length, 2);

  useCarritoStore.getState().agregarItem(
    {
      item_id: 1,
      variacion_item_id: 10,
      variacion_nombre: 'Grande',
      nombre: 'Ramo',
      precio: 20,
      proveedor_id: 5,
      inventario_stock: 3,
    },
    5
  );
  const var10 = useCarritoStore.getState().items.find((i) => i.variacion_item_id === 10);
  assert.equal(var10?.cantidad, 3);

  useCarritoStore.getState().removerItem(1, 10);
  assert.equal(useCarritoStore.getState().items.length, 1);
  assert.equal(useCarritoStore.getState().items[0]?.variacion_item_id, 11);
  useCarritoStore.getState().vaciarCarrito();
});

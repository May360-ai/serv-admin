/* eslint-disable @typescript-eslint/no-require-imports -- Suite CommonJS de node:test, igual que security.test.cjs. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { QueryClient, QueryObserver } = require('@tanstack/react-query');

// Misma convención de la suite existente: transpilar en memoria, sin generar archivos.
function setup(responder) {
  const cache = new Map();
  let observer;
  const mocks = {
    '@/lib/api-client': { apiClient: { get: async (url) => {
      assert.equal(url, '/api/proveedores');
      return { data: await responder() };
    } } },
    '@tanstack/react-query': { useQuery: () => observer.getCurrentResult() },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} };
    cache.set(file, loaded);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (!id.startsWith('@/') && !id.startsWith('.')) return require(id);
      const base = id.startsWith('@/') ? path.resolve(__dirname, '../src', id.slice(2)) : path.resolve(path.dirname(file), id);
      const target = [base + '.ts', base + '.tsx'].find(fs.existsSync);
      assert.ok(target, `Módulo local disponible: ${id}`);
      return load(target);
    };
    new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  const folder = path.resolve(__dirname, '../src/app/(dashboard)/admin/tiendas');
  const { consultarTiendas, RespuestaTiendasInvalida } = load(path.join(folder, 'consulta-tiendas.ts'));
  const Page = load(path.join(folder, 'page.tsx')).default;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  observer = new QueryObserver(client, { queryKey: ['admin-tiendas'], queryFn: consultarTiendas, enabled: false });
  const unsubscribe = observer.subscribe(() => {});
  return {
    consultarTiendas, RespuestaTiendasInvalida,
    refresh: () => observer.refetch(),
    render: () => renderToStaticMarkup(React.createElement(Page)),
    tree: () => Page(),
    close: () => { unsubscribe(); observer.destroy(); client.clear(); },
  };
}

const tienda = { id: 7, nombre_comercial: 'Tienda de prueba', direcciones: null, es_verificado: false };

function retryButton(node) {
  if (!React.isValidElement(node)) return null;
  if (node.props.children === 'Reintentar') return node;
  for (const child of [node.props.action, ...React.Children.toArray(node.props.children)]) {
    const found = retryButton(child);
    if (found) return found;
  }
  return null;
}

test('muestra carga y luego las tiendas del arreglo directo del backend', async (t) => {
  const app = setup(async () => [tienda]); t.after(app.close);
  const pending = app.refresh();
  assert.match(app.render(), /Cargando tiendas/);
  await pending;
  const html = app.render();
  assert.match(html, /Tienda de prueba/);
  assert.doesNotMatch(html, /Sin tiendas registradas|role="alert"/);
});

test('un arreglo válido vacío muestra el estado vacío', async (t) => {
  const app = setup(async () => []); t.after(app.close);
  await app.refresh();
  assert.match(app.render(), /Sin tiendas registradas/);
  assert.doesNotMatch(app.render(), /role="alert"/);
});

test('error HTTP muestra error y acción de reintento, sin estado vacío', async (t) => {
  const failure = new Error('HTTP 503 simulado');
  const app = setup(async () => { throw failure; }); t.after(app.close);
  await assert.rejects(app.consultarTiendas(), error => error === failure);
  await app.refresh();
  const html = app.render();
  assert.match(html, /role="alert"/);
  assert.match(html, /No se pudieron cargar las tiendas/);
  assert.match(html, /Reintentar/);
  assert.doesNotMatch(html, /Sin tiendas registradas/);
});

test('formatos inesperados y registros inválidos se rechazan explícitamente', async () => {
  for (const payload of [null, {}, { data: [tienda] }, 'error', [null], [{}], [{ id: 1 }], [{ ...tienda, nombre_comercial: 42 }]]) {
    const app = setup(async () => payload);
    try {
      await assert.rejects(app.consultarTiendas(), app.RespuestaTiendasInvalida);
      await app.refresh();
      assert.match(app.render(), /Respuesta inesperada/);
      assert.match(app.render(), /role="alert"/);
      assert.ok(retryButton(app.tree()));
      assert.doesNotMatch(app.render(), /Sin tiendas registradas/);
    } finally { app.close(); }
  }
});

test('la acción de reintento recupera la lista después de un error', async (t) => {
  let attempts = 0;
  let complete;
  const app = setup(async () => {
    attempts++;
    if (attempts === 1) throw new Error('HTTP 500 simulado');
    return new Promise(resolve => { complete = () => resolve([tienda]); });
  }); t.after(app.close);
  await app.refresh();
  const button = retryButton(app.tree());
  assert.ok(button);
  button.props.onClick();
  assert.equal(attempts, 2);
  assert.match(app.render(), /Cargando tiendas/);
  complete();
  // Se une a la consulta en curso, sin lanzar otra petición.
  await app.refresh();
  assert.equal(attempts, 2);
  assert.match(app.render(), /Tienda de prueba/);
  assert.doesNotMatch(app.render(), /role="alert"|Sin tiendas registradas/);
});

test('un error al actualizar datos previos tampoco se oculta tras la lista', async (t) => {
  let fail = false;
  const app = setup(async () => { if (fail) throw new Error('HTTP 503 simulado'); return [tienda]; });
  t.after(app.close);
  await app.refresh();
  fail = true;
  await app.refresh();
  assert.match(app.render(), /role="alert"/);
  assert.doesNotMatch(app.render(), /Tienda de prueba|Sin tiendas registradas/);
});

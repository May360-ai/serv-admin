const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const { NextRequest } = require('next/server');
const source = fs.readFileSync(require.resolve('../src/middleware.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function('require', 'module', 'exports', output)(require, loaded, loaded.exports);

test('panel usa sesión verificada e ignora cookie de rol; falla cerrado', async () => {
  const originalFetch = global.fetch;
  function request(path = '/admin/metricas') {
    return new NextRequest(`http://localhost${path}`, { headers: { cookie: 'serv_token=falso; serv_role=administrador' } });
  }
  try {
    global.fetch = async () => new Response('{}', { status: 403 });
    assert.match((await loaded.exports.middleware(request())).headers.get('location'), /login/);
    global.fetch = async () => Response.json({ rol_nombre: 'cliente' });
    assert.match((await loaded.exports.middleware(request())).headers.get('location'), /unauthorized/);
    assert.match((await loaded.exports.middleware(request('/admin/metricas.json'))).headers.get('location'), /unauthorized/);
    global.fetch = async () => Response.json({ rol_nombre: 'administrador' });
    assert.equal((await loaded.exports.middleware(request())).headers.get('x-middleware-next'), '1');
    global.fetch = async () => { throw new Error('offline'); };
    assert.match((await loaded.exports.middleware(request())).headers.get('location'), /login/);
  } finally { global.fetch = originalFetch; }
});

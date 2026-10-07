const { test, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index');
const db = require('../src/db');

let server;
let base;

before(async () => {
  await db.conectar(process.env.TEST_MONGODB_URI); // sin URI: repositorio en memoria
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await db.desconectar();
});

test('GET /health responde ok', async () => {
  const res = await fetch(`${base}/health`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).status, 'ok');
});

test('GET / sirve la página principal', async () => {
  const res = await fetch(base);
  assert.strictEqual(res.status, 200);
  assert.match(await res.text(), /Mi Node App/);
});

test('CRUD de empleados', async () => {
  const creado = await fetch(`${base}/api/empleados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'María', cargo: 'QA', salario: 1500 })
  });
  assert.strictEqual(creado.status, 201);
  const { id } = await creado.json();

  const invalido = await fetch(`${base}/api/empleados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cargo: 'QA' })
  });
  assert.strictEqual(invalido.status, 400);

  const actualizado = await fetch(`${base}/api/empleados/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'María', cargo: 'QA Lead' })
  });
  assert.strictEqual((await actualizado.json()).cargo, 'QA Lead');

  assert.strictEqual((await fetch(`${base}/api/empleados/${id}`, { method: 'DELETE' })).status, 204);
  assert.strictEqual((await fetch(`${base}/api/empleados/${id}`)).status, 404);
});

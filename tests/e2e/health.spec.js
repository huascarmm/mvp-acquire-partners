const { test, expect } = require('@playwright/test');

// Verifica que el servicio responde y que las rutas protegidas exigen auth.
test('health responde ok', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toMatchObject({ ok: true });
});

test('ruta desconocida da 404', async ({ request }) => {
  const res = await request.get('/no-existe-' + Date.now());
  expect(res.status()).toBe(404);
});

test('admin sin token: 401', async ({ request }) => {
  const res = await request.get('/api/admin/leads');
  expect(res.status()).toBe(401);
});

test('admin stats sin token: 401', async ({ request }) => {
  const res = await request.get('/api/admin/stats');
  expect(res.status()).toBe(401);
});

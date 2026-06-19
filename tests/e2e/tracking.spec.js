const { test, expect } = require('@playwright/test');

const RUN = process.env.E2E_RUN_ID || ('local-' + Date.now());

// Verifica que en la conversión se disparan los eventos a Meta Pixel y a GA4.
test('dispara eventos de Meta Pixel y GA4 en la conversión', async ({ page }) => {
  await page.addInitScript((run) => {
    // Stub de fbq: pixels.js respeta window.fbq si ya existe (no recarga el script externo).
    window.__fbq = [];
    window.fbq = function () { window.__fbq.push(Array.prototype.slice.call(arguments)); };
    window.fbq.queue = []; window.fbq.loaded = true; window.fbq.version = '2.0';
    window._fbq = window.fbq;
    // sessionId con prefijo e2e- para poder limpiarlo después.
    let c = 0;
    crypto.randomUUID = () => `e2e-${run}-trk-${++c}-${Math.random().toString(36).slice(2, 8)}`;
  }, RUN);

  await page.goto('/funnel.html?m=cafe&v=C-A');
  await page.locator('#go').click();
  await page.locator('.options .opt').first().click();
  await page.locator('#name').fill('E2E Track');
  await page.locator('#email').fill('e2e-trk@example.com');
  await page.locator('#company').fill('QA');
  await page.locator('#next').click();
  await page.locator('#actor').fill('Coop E2E');
  await page.locator('#years').fill('6');
  await page.locator('#intro .opt[data-v="1"]').click();
  for (let q = 0; q < 4; q++) {
    await expect(page.locator('.eyebrow')).toContainText('Calificacion');
    await page.locator('.options .opt').first().click();
  }
  await page.locator('.options .opt').first().click();
  await expect(page.locator('.title')).toContainText(/Tu perfil encaja|Registro verificado/);

  // Meta Pixel: debe haberse disparado al menos 'Lead'.
  const fbq = await page.evaluate(() => window.__fbq || []);
  const tracks = fbq.filter((a) => a[0] === 'track').map((a) => a[1]);
  expect(tracks).toContain('Lead');

  // GA4: gtag empuja ['event', name, params] a dataLayer.
  const dl = await page.evaluate(() => window.dataLayer || []);
  const evNames = dl.filter((a) => a && a[0] === 'event').map((a) => a[1]);
  expect(evNames).toContain('funnel_start');
  expect(evNames).toContain('generate_lead');
});

const { test, expect } = require('@playwright/test');

const RUN = process.env.E2E_RUN_ID || ('local-' + Date.now());

// Verifica de forma realista que en la conversión se disparan los eventos a
// Meta Pixel (Lead / LeadCalificado / LeadA) con sus parámetros e IDs de dedup,
// y los eventos de embudo a GA4. El recorrido elige la primera opción en cada
// paso (acceso cooperativa + puede presentar + todo "high" + reunión) => Tipo A.
test('dispara eventos de Meta Pixel (incl. LeadA) y GA4 en la conversión', async ({ page }) => {
  await page.addInitScript((run) => {
    // pixels.js respeta window.fbq si ya existe (no recarga el script externo).
    window.__fbq = [];
    window.fbq = function () { window.__fbq.push(Array.prototype.slice.call(arguments)); };
    window.fbq.queue = []; window.fbq.loaded = true; window.fbq.version = '2.0';
    window._fbq = window.fbq;
    let c = 0;
    crypto.randomUUID = () => `e2e-${run}-trk-${++c}-${Math.random().toString(36).slice(2, 8)}`;
  }, RUN);

  await page.goto('/funnel.html?m=cafe&v=C-A');
  await page.locator('#go').click();
  await page.locator('.options .opt').first().click();          // triage: cooperativa (acceso)
  await page.locator('#name').fill('E2E Track');
  await page.locator('#email').fill('e2e-trk@example.com');
  await page.locator('#company').fill('QA');
  await page.locator('#next').click();
  await page.locator('#actor').fill('Coop E2E');
  await page.locator('#years').fill('6');
  await page.locator('#intro .opt[data-v="1"]').click();         // puede presentar
  for (let q = 0; q < 4; q++) {                                   // 4 preguntas: "high"
    await expect(page.locator('.eyebrow')).toContainText('Calificacion');
    await page.locator('.options .opt').first().click();
  }
  await page.locator('.options .opt').first().click();           // final: agéndame reunión
  await expect(page.locator('.title')).toContainText(/Tu perfil encaja|Registro verificado/);

  // ---- Meta Pixel ----
  const fbq = await page.evaluate(() => window.__fbq || []);
  const tracks = fbq.filter((a) => a[0] === 'track');
  const names = tracks.map((a) => a[1]);
  expect(names).toContain('Lead');           // volumen
  expect(names).toContain('LeadCalificado'); // A/B
  expect(names).toContain('LeadA');          // identifica Tipo A (el de mayor valor)

  const lead = tracks.find((a) => a[1] === 'Lead');
  expect(lead[2].lead_type).toBe('A');                 // parámetro de calidad
  expect(lead[3] && lead[3].eventID).toMatch(/:lead$/); // dedup con CAPI
  const la = tracks.find((a) => a[1] === 'LeadA');
  expect(la[3] && la[3].eventID).toMatch(/:a$/);
  const lq = tracks.find((a) => a[1] === 'LeadCalificado');
  expect(lq[3] && lq[3].eventID).toMatch(/:qualified$/);

  // ---- GA4 (embudo de ventas) ----
  const dl = await page.evaluate(() => window.dataLayer || []);
  const evNames = dl.filter((a) => a && a[0] === 'event').map((a) => a[1]);
  expect(evNames).toEqual(expect.arrayContaining(['funnel_start', 'funnel_stage', 'generate_lead', 'qualified_lead']));
  const gl = dl.find((a) => a && a[0] === 'event' && a[1] === 'generate_lead');
  expect(gl[2].lead_type).toBe('A');
});

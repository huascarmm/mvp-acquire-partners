const { test, expect } = require('@playwright/test');

const RUN = process.env.E2E_RUN_ID || ('local-' + Date.now());

// Recorrido completo del embudo (camino "con acceso") en un navegador real.
// Fuerza un sessionId con prefijo e2e- para poder limpiarlo despues.
test('recorrido completo del embudo (cafe, con acceso)', async ({ page }) => {
  let i = 0;
  await page.addInitScript((run) => {
    // @ts-ignore
    crypto.randomUUID = () => `e2e-${run}-ui-${(window.__c = (window.__c || 0) + 1)}-${Math.random().toString(36).slice(2, 8)}`;
  }, RUN);

  await page.goto('/funnel.html?m=cafe');

  // Hero
  await page.locator('#go').click();

  // Triage: primera opcion (cooperativa = con acceso)
  await page.locator('.options .opt').first().click();

  // Contacto
  await page.locator('#name').fill('E2E UI Tester');
  await page.locator('#email').fill('e2e-ui@example.com');
  await page.locator('#company').fill('QA Bot');
  await page.locator('#next').click();

  // Prueba fehaciente
  await page.locator('#actor').fill('Cooperativa E2E de prueba');
  await page.locator('#years').fill('5');
  await page.locator('#intro .opt[data-v="1"]').click();

  // Calificacion: 4 preguntas, elegir la primera opcion en cada una
  for (let q = 0; q < 4; q++) {
    await expect(page.locator('.eyebrow')).toContainText('Calificacion');
    await page.locator('.options .opt').first().click();
  }

  // Maximo valor (final ask)
  await page.locator('.options .opt').first().click();

  // Gracias
  await expect(page.locator('.title')).toContainText('Registro verificado');
});

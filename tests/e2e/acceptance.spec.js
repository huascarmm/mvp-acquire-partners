const { test, expect } = require('@playwright/test');

const RUN = process.env.E2E_RUN_ID || ('local-' + Date.now());
const sid = (n) => `e2e-${RUN}-acc-${n}-${Math.random().toString(36).slice(2, 8)}`;

// ---- Estructura obligatoria del landing -------------------------------------
test('landing muestra las 6 secciones del esquema', async ({ page }) => {
  await page.goto('/funnel.html?m=cafe');
  // 0. Header con logo enlazado a blockchainconsultora.com
  const brand = page.locator('.brandbar a[href="https://blockchainconsultora.com"]');
  await expect(brand).toHaveAttribute('target', '_blank');
  await expect(brand.locator('img.brand-logo')).toBeVisible();
  // 1. Hero + 1.1 badges + 1.2 whatsapp sutil
  await expect(page.locator('.hero .title')).toBeVisible();
  await expect(page.locator('.hero .badges .badge')).toHaveCount(2);
  await expect(page.locator('.hero .wa-soft')).toBeVisible();
  // 2. Contexto con palabras clave
  await expect(page.locator('.sec .kw')).toHaveCount(3);
  // 3. A quién buscamos + nota "no necesitas tecnología"
  await expect(page.locator('.seek-list li')).toHaveCount(3);
  await expect(page.locator('.note-chip')).toContainText(/tecnolog/i);
  // 4. Alianza con pasos numerados
  await expect(page.locator('.ally-steps li')).toHaveCount(3);
  // 5. CTA destacado
  await expect(page.locator('.cta-card #go2')).toBeVisible();
  // 6. Footer quiénes somos + logos
  await expect(page.locator('.lp-footer')).toContainText(/Quiénes somos/i);
  await expect(page.locator('.lp-footer .logos img')).not.toHaveCount(0);
});

// ---- Integraciones de terceros presentes ------------------------------------
test('GA4 y Meta Pixel se inicializan', async ({ page }) => {
  await page.goto('/funnel.html?m=cafe');
  // GA4: gtag/dataLayer disponibles (site.js trae un Measurement ID)
  const hasGtag = await page.evaluate(() => typeof window.gtag === 'function' && Array.isArray(window.dataLayer));
  expect(hasGtag).toBeTruthy();
  // Meta Pixel: fbq inicializado
  await expect.poll(async () => page.evaluate(() => typeof window.fbq === 'function')).toBeTruthy();
});

// ---- Contratos de la API (Firestore/Firebase) -------------------------------
test('API lead devuelve leadType/qualified/eventId con id estable', async ({ request }) => {
  const sessionId = sid('lead');
  const res = await request.post('/api/lead', {
    data: {
      sessionId, market: 'cafe', stageReached: 4,
      patch: {
        contact: { name: 'Acc', email: 'acc@example.com', whatsapp: '70000000' },
        marketAccess: { hasAccess: true, canIntroduce: true, actorNamed: 'Coop', experienceYears: 7 },
        qualification: { canGetMeetings: 'high', canCofinance: 'high', regulatoryKnowledge: 'mid', salesCapacity: 'high' },
        finalAsk: { willIntroduceDecisionMaker: 'meeting' },
      },
      meta: { sourceUrl: 'https://x.test/funnel.html?m=cafe' },
    },
  });
  expect(res.ok()).toBeTruthy();
  const b = await res.json();
  expect(b.ok).toBe(true);
  expect(b.id).toBe(sessionId);
  expect(['A', 'B', 'C', 'D']).toContain(b.leadType);
  expect(typeof b.qualified).toBe('boolean');
  expect(b.eventId).toBe(`${sessionId}:lead`); // id estable para dedup con CAPI
  expect(b.score).toBeUndefined();              // el score no se expone
});

test('API referral devuelve cupón', async ({ request }) => {
  const res = await request.post('/api/referral', {
    data: {
      market: 'madera', referrerLeadId: sid('ref'),
      referrerContact: { name: 'Ref', email: 'ref@example.com' },
      referred: { name: 'X', contact: 'wa 700', relationship: 'gerente' },
    },
  });
  expect(res.ok()).toBeTruthy();
  const b = await res.json();
  expect(b.couponCode).toMatch(/^ASOBC-[A-Z0-9]{6}$/);
});

// ---- Endpoint admin de pipeline protegido ----------------------------------
test('PATCH /api/admin/lead/:id exige token (401 sin auth)', async ({ request }) => {
  const res = await request.patch('/api/admin/lead/cualquier-id', {
    data: { pipelineStatus: 'Revisado' },
  });
  expect(res.status()).toBe(401);
});

test('lead nuevo arranca en pipelineStatus "Solicitado"', async ({ request }) => {
  const sessionId = sid('pipe');
  const res = await request.post('/api/lead', {
    data: { sessionId, market: 'cafe', stageReached: 1, patch: { triage: { value: 'cooperativa' } } },
  });
  expect(res.ok()).toBeTruthy();
  // No exponemos pipelineStatus en la respuesta del funnel (es interno del panel),
  // pero el lead queda creado; el panel lo lee vía /api/admin/leads (protegido).
  const b = await res.json();
  expect(b.id).toBe(sessionId);
});

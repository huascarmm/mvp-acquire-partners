const { test, expect } = require('@playwright/test');

// Prefijo identificable para limpiar luego (ver tests/cleanup.js).
const RUN = process.env.E2E_RUN_ID || ('local-' + Date.now());
const sid = (n) => `e2e-${RUN}-${n}-${Math.random().toString(36).slice(2, 8)}`;

test('POST /api/lead rechaza payload invalido', async ({ request }) => {
  const r1 = await request.post('/api/lead', { data: {} });
  expect(r1.status()).toBe(400);
  const r2 = await request.post('/api/lead', { data: { sessionId: sid('bad'), market: 'no_existe' } });
  expect(r2.status()).toBe(400);
});

test('POST /api/lead crea/actualiza lead valido', async ({ request }) => {
  const sessionId = sid('lead');
  const res = await request.post('/api/lead', {
    data: {
      sessionId, market: 'cafe', stageReached: 4,
      patch: {
        contact: { name: 'E2E Tester', email: 'e2e@example.com', company: 'QA', role: 'bot' },
        marketAccess: { hasAccess: true, canIntroduce: true, actorNamed: 'Coop E2E', experienceYears: 6 },
        qualification: { canGetMeetings: 'high', canCofinance: 'mid', regulatoryKnowledge: 'high', salesCapacity: 'high' },
        finalAsk: { willIntroduceDecisionMaker: 'meeting' },
        campaign: { variant: 'e2e' }
      }
    }
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.id).toBe(sessionId);
  // El score NO debe exponerse al cliente.
  expect(body.score).toBeUndefined();
});

test('POST /api/referral devuelve cupon', async ({ request }) => {
  const res = await request.post('/api/referral', {
    data: {
      market: 'madera', referrerLeadId: sid('ref'),
      referrerContact: { name: 'E2E Referrer', email: 'ref@example.com' },
      referred: { name: 'Persona Referida', contact: 'wa 700', relationship: 'gerente' }
    }
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.couponCode).toMatch(/^ASOBC-[A-Z0-9]{6}$/);
});

test('POST /api/referral sin referido: 400', async ({ request }) => {
  const res = await request.post('/api/referral', { data: { market: 'madera', referred: {} } });
  expect(res.status()).toBe(400);
});

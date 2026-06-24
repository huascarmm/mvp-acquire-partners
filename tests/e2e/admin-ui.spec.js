const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

const sampleLead = {
  id: 'lead-admin-1',
  market: 'cafe',
  stageReached: 4,
  status: 'meeting_requested',
  leadType: 'A',
  score: 92,
  pipelineStatus: 'Solicitado',
  adminNotes: 'Nota inicial',
  rating: 0,
  ratingComment: '',
  contact: {
    name: 'Lead de prueba',
    email: 'lead@example.com',
    whatsapp: '59170000000',
    company: 'Cooperativa QA',
    role: 'Gerente'
  },
  marketAccess: {
    relation: 'cooperativa',
    hasAccess: true,
    canIntroduce: true,
    actorNamed: 'Cooperativa QA',
    experienceYears: 5
  },
  qualification: {
    canGetMeetings: 'high',
    canCofinance: 'high',
    regulatoryKnowledge: 'mid',
    salesCapacity: 'high'
  },
  finalAsk: { willIntroduceDecisionMaker: 'meeting' },
  campaign: { variant: 'C-A' },
  createdAt: '2026-06-24T12:00:00.000Z'
};

async function prepareAdmin(page) {
  const calls = { patches: [], creates: [], publicLeadPosts: 0 };

  await page.route('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    headers: { 'access-control-allow-origin': '*' },
    body: 'export function initializeApp(){ return {}; }'
  }));
  await page.route('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    headers: { 'access-control-allow-origin': '*' },
    body: `
      export function getAuth(){ return {}; }
      export async function signInWithEmailAndPassword(){ return {}; }
      export function onAuthStateChanged(_auth, callback){
        queueMicrotask(() => callback({ email: 'admin@example.com', getIdToken: async () => 'fake-token' }));
        return function(){};
      }
      export async function signOut(){ return {}; }
    `
  }));

  await page.route('https://admin.test/**', async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.startsWith('/api/admin/')) {
      const auth = request.headers().authorization;
      expect(auth).toBe('Bearer fake-token');

      if (url.pathname === '/api/admin/stats' && request.method() === 'GET') {
        return route.fulfill({ json: { ok: true, stats: { total: 1, qualified: 1, meetings: 1, referrals: 0, byType: { A: 1 } } } });
      }
      if (url.pathname === '/api/admin/leads' && request.method() === 'GET') {
        return route.fulfill({ json: { ok: true, leads: [sampleLead], referrals: [] } });
      }
      if (url.pathname === '/api/admin/leads' && request.method() === 'POST') {
        calls.creates.push(request.postDataJSON());
        return route.fulfill({ status: 201, json: { ok: true, id: 'manual-1', leadType: 'A', score: 90, pipelineStatus: 'Agendado' } });
      }
      if (url.pathname.startsWith('/api/admin/lead/') && request.method() === 'PATCH') {
        calls.patches.push({ path: url.pathname, body: request.postDataJSON() });
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ status: 404, json: { ok: false } });
    }

    if (url.pathname === '/api/lead') {
      calls.publicLeadPosts += 1;
      return route.fulfill({ status: 500, json: { ok: false } });
    }

    return route.fulfill({ status: 404, body: 'not found' });
  });

  const styles = fs.readFileSync(path.join(ROOT, 'public/assets/styles.css'), 'utf8');
  const markets = fs.readFileSync(path.join(ROOT, 'public/assets/markets.js'), 'utf8');
  const adminJs = fs.readFileSync(path.join(ROOT, 'public/assets/admin.js'), 'utf8');
  let html = fs.readFileSync(path.join(ROOT, 'public/admin.html'), 'utf8');
  html = html
    .replace('<head>', '<head><base href="https://admin.test/">')
    .replace('<link rel="stylesheet" href="assets/styles.css" />', `<style>${styles}</style>`)
    .replace('<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml" />', '')
    .replace('<script src="assets/markets.js?v=1.2.0"></script>', `<script>${markets}</script>`)
    .replace('<script type="module" src="assets/admin.js?v=1.2.0"></script>', `<script type="module">${adminJs}</script>`);

  await page.setContent(html, { waitUntil: 'load' });
  await expect(page.locator('#dash')).toBeVisible();
  await expect(page.locator('tr.lead-row')).toHaveCount(1);
  return calls;
}

test('notes-inp usa readonly, se habilita al enfocar y guarda al perder foco', async ({ page }) => {
  const calls = await prepareAdmin(page);
  const notes = page.locator('.notes-inp');

  await expect(notes).toHaveAttribute('readonly', '');
  expect(await notes.isDisabled()).toBe(false);

  await notes.click();
  await expect(notes).not.toHaveAttribute('readonly', '');
  await notes.fill('Nueva conclusión del contacto');
  await page.locator('#fSearch').click();

  await expect.poll(() => calls.patches.length).toBe(1);
  expect(calls.patches[0]).toEqual({
    path: '/api/admin/lead/lead-admin-1',
    body: { adminNotes: 'Nueva conclusión del contacto' }
  });
  await expect(notes).toHaveAttribute('readonly', '');
});

test('formulario admin crea un lead manual completo sin llamar al endpoint público', async ({ page }) => {
  const calls = await prepareAdmin(page);

  await page.locator('#addLead').click();
  await expect(page.locator('#leadModal')).toHaveClass(/open/);

  await page.locator('#mlMarket').selectOption('madera');
  await page.locator('#mlName').fill('Carlos Madera');
  await page.locator('#mlEmail').fill('carlos@example.com');
  await page.locator('#mlWhatsapp').fill('59171111111');
  await page.locator('#mlCompany').fill('Exportadora Forestal');
  await page.locator('#mlRole').fill('Director comercial');
  await page.locator('#mlRelation').selectOption('empresa');
  await expect(page.locator('#mlAccessHint')).toContainText('acceso directo');
  await page.locator('#mlActor').fill('Aserradero Exportador QA');
  await page.locator('#mlYears').fill('9');
  await page.locator('#mlProof').fill('https://example.com/perfil');
  await page.locator('#mlCanIntroduce').check();
  await page.locator('#mlCanGetMeetings').selectOption('high');
  await page.locator('#mlCanCofinance').selectOption('mid');
  await page.locator('#mlRegulatoryKnowledge').selectOption('high');
  await page.locator('#mlSalesCapacity').selectOption('high');
  await page.locator('#mlFinal').selectOption('meeting');
  await page.locator('#mlChannel').selectOption('whatsapp');
  await page.locator('#mlPipeline').selectOption('Agendado');
  await page.locator('#mlVariant').fill('M-A');
  await page.locator('#mlUtmSource').fill('whatsapp');
  await page.locator('#mlUtmCampaign').fill('contacto-directo');
  await page.locator('#mlNotes').fill('Pidió una demostración esta semana.');
  await page.locator('#manualSubmit').click();

  await expect.poll(() => calls.creates.length).toBe(1);
  const body = calls.creates[0];
  expect(body.market).toBe('madera');
  expect(body.contact).toEqual({
    name: 'Carlos Madera',
    email: 'carlos@example.com',
    whatsapp: '59171111111',
    company: 'Exportadora Forestal',
    role: 'Director comercial'
  });
  expect(body.marketAccess).toEqual({
    relation: 'empresa',
    hasAccess: true,
    canIntroduce: true,
    actorNamed: 'Aserradero Exportador QA',
    experienceYears: 9,
    proofFileUrl: 'https://example.com/perfil'
  });
  expect(body.qualification).toEqual({
    canGetMeetings: 'high',
    canCofinance: 'mid',
    regulatoryKnowledge: 'high',
    salesCapacity: 'high'
  });
  expect(body.finalAsk).toEqual({ willIntroduceDecisionMaker: 'meeting' });
  expect(body.campaign).toEqual({ variant: 'M-A', utmSource: 'whatsapp', utmCampaign: 'contacto-directo' });
  expect(body.source).toEqual({ channel: 'whatsapp' });
  expect(body.pipelineStatus).toBe('Agendado');
  expect(body.adminNotes).toBe('Pidió una demostración esta semana.');
  expect(calls.publicLeadPosts).toBe(0);
  await expect(page.locator('#leadModal')).not.toHaveClass(/open/);
  await expect(page.locator('#notice')).toContainText('Lead creado correctamente');
});

test('formulario adapta la pregunta final del mercado institucional', async ({ page }) => {
  const calls = await prepareAdmin(page);
  await page.locator('#addLead').click();
  await page.locator('#mlMarket').selectOption('oro_tokenizado');
  await expect(page.locator('#mlFinalLabel')).toContainText('mesa de diálogo');

  await page.locator('#mlName').fill('Ana Institucional');
  await page.locator('#mlWhatsapp').fill('59172222222');
  await page.locator('#mlRelation').selectOption('regulatorio');
  await page.locator('#mlFinal').selectOption('intro');
  await page.locator('#manualSubmit').click();

  await expect.poll(() => calls.creates.length).toBe(1);
  expect(calls.creates[0].finalAsk).toEqual({ joinRoundtable: 'intro' });
});

test('formulario exige email o WhatsApp antes de enviar', async ({ page }) => {
  const calls = await prepareAdmin(page);
  await page.locator('#addLead').click();
  await page.locator('#mlName').fill('Sin contacto');
  await page.locator('#manualSubmit').click();

  await expect(page.locator('#manualError')).toContainText('email o WhatsApp');
  expect(calls.creates).toHaveLength(0);
});

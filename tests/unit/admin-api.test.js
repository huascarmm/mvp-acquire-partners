'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const documents = new Map();
let sequence = 0;
const timestamp = { toDate: () => new Date('2026-06-24T12:00:00.000Z') };

const fakeDb = {
  collection(name) {
    assert.equal(name, 'leads');
    return {
      doc(id) {
        const documentId = id || `manual-${++sequence}`;
        return {
          id: documentId,
          async set(data, options) {
            const previous = documents.get(documentId) || {};
            documents.set(documentId, options && options.merge ? { ...previous, ...data } : data);
          },
          async get() {
            const data = documents.get(documentId);
            return { exists: !!data, data: () => data };
          }
        };
      }
    };
  }
};

const fakeAdmin = {
  initializeApp() {},
  firestore() { return fakeDb; },
  auth() {
    return {
      async verifyIdToken(token) {
        if (token !== 'valid-admin-token') throw new Error('bad token');
        return { email: 'admin@example.com' };
      }
    };
  }
};
fakeAdmin.firestore.FieldValue = { serverTimestamp: () => timestamp };

process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.ADMIN_EMAILS = 'admin@example.com';

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'firebase-admin') return fakeAdmin;
  return originalLoad.call(this, request, parent, isMain);
};
const { app } = require('../../server');
Module._load = originalLoad;

async function withServer(run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

function fullPayload() {
  return {
    market: 'cafe',
    contact: {
      name: 'Contacto manual',
      email: 'manual@example.com',
      whatsapp: '59170000000',
      company: 'Cooperativa Manual',
      role: 'Gerente'
    },
    marketAccess: {
      relation: 'cooperativa',
      hasAccess: true,
      canIntroduce: true,
      actorNamed: 'Cooperativa Manual',
      experienceYears: 8,
      proofFileUrl: 'https://example.com/perfil'
    },
    qualification: {
      canGetMeetings: 'high',
      canCofinance: 'mid',
      regulatoryKnowledge: 'high',
      salesCapacity: 'high'
    },
    finalAsk: { willIntroduceDecisionMaker: 'meeting' },
    campaign: { variant: 'C-A', utmSource: 'whatsapp', utmCampaign: 'manual' },
    source: { channel: 'whatsapp' },
    pipelineStatus: 'Agendado',
    adminNotes: 'Agendar demostración.'
  };
}

test('POST /api/admin/leads exige autenticación', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/admin/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(fullPayload())
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: 'no_token' });
  });
});

test('POST /api/admin/leads crea un documento nuevo y no usa un ID aportado por el cliente', async () => {
  documents.clear();
  await withServer(async baseUrl => {
    const payload = { ...fullPayload(), id: 'no-debe-usarse' };
    const response = await fetch(`${baseUrl}/api/admin/leads`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-admin-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.match(body.id, /^manual-\d+$/);
    assert.notEqual(body.id, 'no-debe-usarse');
    assert.equal(body.leadType, 'A');
    assert.equal(body.pipelineStatus, 'Agendado');

    const stored = documents.get(body.id);
    assert.ok(stored);
    assert.equal(stored.contact.name, 'Contacto manual');
    assert.equal(stored.manualEntry, true);
    assert.equal(stored.source.type, 'admin_manual');
    assert.equal(stored.source.createdBy, 'admin@example.com');
    assert.equal(stored.createdAt, timestamp);
    assert.equal(stored.updatedAt, timestamp);
  });
});

test('POST /api/admin/leads rechaza un formulario incompleto sin escribir', async () => {
  documents.clear();
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/admin/leads`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-admin-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ market: 'cafe', contact: { name: 'Sin contacto' } })
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, 'missing_contact');
    assert.equal(documents.size, 0);
  });
});

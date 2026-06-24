'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildManualLeadRecord,
  ManualLeadValidationError,
  FINAL_FIELD_BY_MARKET
} = require('../../lib/manual-lead');

const NOW = { __serverTimestamp: true };

function completePayload(overrides = {}) {
  return {
    market: 'cafe',
    contact: {
      name: 'María Pérez',
      email: 'maria@example.com',
      whatsapp: '59170000000',
      company: 'Cooperativa Andina',
      role: 'Gerente'
    },
    marketAccess: {
      relation: 'cooperativa',
      hasAccess: true,
      canIntroduce: true,
      actorNamed: 'Cooperativa Andina',
      experienceYears: 8,
      proofFileUrl: 'https://linkedin.com/in/maria'
    },
    qualification: {
      canGetMeetings: 'high',
      canCofinance: 'mid',
      regulatoryKnowledge: 'high',
      salesCapacity: 'high'
    },
    finalAsk: { willIntroduceDecisionMaker: 'meeting' },
    campaign: { variant: 'C-A', utmSource: 'whatsapp', utmCampaign: 'manual-junio' },
    source: { channel: 'whatsapp' },
    pipelineStatus: 'Agendado',
    adminNotes: 'Contacto recibido por WhatsApp.',
    ...overrides
  };
}

function build(payload) {
  return buildManualLeadRecord(payload, { adminEmail: 'admin@example.com', now: NOW });
}

test('crea un lead manual completo con el mismo score/tipo del funnel', () => {
  const record = build(completePayload());

  assert.equal(record.market, 'cafe');
  assert.equal(record.contact.name, 'María Pérez');
  assert.equal(record.stageReached, 4);
  assert.equal(record.status, 'meeting_requested');
  assert.equal(record.pipelineStatus, 'Agendado');
  assert.equal(record.leadType, 'A');
  assert.equal(record.score, 90);
  assert.equal(record.manualEntry, true);
  assert.deepEqual(record.source, {
    type: 'admin_manual',
    channel: 'whatsapp',
    createdBy: 'admin@example.com'
  });
  assert.equal(record.createdAt, NOW);
  assert.equal(record.updatedAt, NOW);
});

test('calcula etapa 2 cuando solo hay contacto y relación', () => {
  const payload = completePayload({
    qualification: {},
    finalAsk: {},
    pipelineStatus: 'Solicitado'
  });
  const record = build(payload);
  assert.equal(record.stageReached, 2);
  assert.equal(record.status, 'qualifying');
});

test('un lead sin acceso queda como referidor y tipo D', () => {
  const payload = completePayload({
    marketAccess: {
      relation: 'conozco',
      hasAccess: false,
      canIntroduce: false,
      actorNamed: '',
      experienceYears: 0
    },
    qualification: {},
    finalAsk: {}
  });
  const record = build(payload);
  assert.equal(record.status, 'referrer');
  assert.equal(record.leadType, 'D');
  assert.ok(record.score <= 35);
});

test('usa joinRoundtable para el mercado institucional', () => {
  const payload = completePayload({
    market: 'oro_tokenizado',
    finalAsk: { joinRoundtable: 'intro' }
  });
  const record = build(payload);
  assert.equal(FINAL_FIELD_BY_MARKET.oro_tokenizado, 'joinRoundtable');
  assert.deepEqual(record.finalAsk, { joinRoundtable: 'intro' });
  assert.equal(record.status, 'meeting_requested');
});

test('requiere nombre y un medio de contacto', () => {
  assert.throws(
    () => build(completePayload({ contact: { name: '', email: '', whatsapp: '' } })),
    error => error instanceof ManualLeadValidationError && error.code === 'missing_name'
  );

  assert.throws(
    () => build(completePayload({ contact: { name: 'Persona', email: '', whatsapp: '' } })),
    error => error instanceof ManualLeadValidationError && error.code === 'missing_contact'
  );
});

test('rechaza mercado, calificación y estado inválidos', () => {
  assert.throws(
    () => build(completePayload({ market: 'otro' })),
    error => error instanceof ManualLeadValidationError && error.code === 'bad_market'
  );

  assert.throws(
    () => build(completePayload({ qualification: { canGetMeetings: 'super' } })),
    error => error instanceof ManualLeadValidationError && error.code === 'bad_qualification'
  );

  assert.throws(
    () => build(completePayload({ pipelineStatus: 'Inventado' })),
    error => error instanceof ManualLeadValidationError && error.code === 'bad_status'
  );
});

test('recorta campos y limita años a un rango razonable', () => {
  const payload = completePayload({
    contact: { name: ' X ', email: 'x@example.com', whatsapp: '', company: 'A'.repeat(300), role: '' },
    marketAccess: { hasAccess: true, experienceYears: 999, actorNamed: ' Actor ' }
  });
  const record = build(payload);
  assert.equal(record.contact.name, 'X');
  assert.equal(record.contact.company.length, 200);
  assert.equal(record.marketAccess.experienceYears, 80);
  assert.equal(record.marketAccess.actorNamed, 'Actor');
});

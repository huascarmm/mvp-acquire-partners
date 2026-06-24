'use strict';

const { computeScore, leadTypeFor } = require('./scoring');

const MARKETS = new Set(['cafe', 'madera', 'oro_compliance', 'oro_tokenizado']);
const LEVELS = new Set(['high', 'mid', 'low', 'none']);
const FINAL_VALUES = new Set(['meeting', 'intro', 'info']);
const FINAL_FIELD_BY_MARKET = {
  cafe: 'willIntroduceDecisionMaker',
  madera: 'willIntroduceDecisionMaker',
  oro_compliance: 'willIntroduceDecisionMaker',
  oro_tokenizado: 'joinRoundtable'
};
const PIPELINE_STATES = new Set([
  'Solicitado', 'Revisado', 'Agendado', 'Primera Reunión', 'Segunda Reunión',
  'Trabajando', 'Cerrado', 'Cerrado con feedback'
]);

class ManualLeadValidationError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ManualLeadValidationError';
    this.code = code;
    this.status = 400;
  }
}

const isStr = value => typeof value === 'string';
const clean = (value, max = 300) => (isStr(value) ? value.trim().slice(0, max) : '');

function cleanLevel(value, field) {
  const level = clean(value, 20);
  if (!level) return '';
  if (!LEVELS.has(level)) throw new ManualLeadValidationError('bad_qualification', `Valor inválido en ${field}`);
  return level;
}

function buildManualLeadRecord(body, context = {}) {
  const input = body && typeof body === 'object' ? body : {};
  const market = clean(input.market, 40);
  if (!MARKETS.has(market)) throw new ManualLeadValidationError('bad_market', 'Selecciona un mercado válido.');

  const rawContact = input.contact || {};
  const contact = {
    name: clean(rawContact.name, 160),
    email: clean(rawContact.email, 160),
    whatsapp: clean(rawContact.whatsapp, 60),
    company: clean(rawContact.company, 200),
    role: clean(rawContact.role, 160)
  };
  if (!contact.name) throw new ManualLeadValidationError('missing_name', 'El nombre es obligatorio.');
  if (!contact.email && !contact.whatsapp) {
    throw new ManualLeadValidationError('missing_contact', 'Indica email o WhatsApp.');
  }

  const rawAccess = input.marketAccess || {};
  const yearsNumber = Number(rawAccess.experienceYears || 0);
  const experienceYears = Number.isFinite(yearsNumber)
    ? Math.max(0, Math.min(80, Math.round(yearsNumber)))
    : 0;
  const actorNamed = clean(rawAccess.actorNamed || rawAccess.proofText, 1000);
  const marketAccess = {
    relation: clean(rawAccess.relation, 120),
    hasAccess: rawAccess.hasAccess === true,
    canIntroduce: rawAccess.canIntroduce === true,
    actorNamed,
    experienceYears,
    proofText: actorNamed,
    proofFileUrl: clean(rawAccess.proofFileUrl, 1000)
  };

  const rawQualification = input.qualification || {};
  const qualification = {};
  ['canGetMeetings', 'canCofinance', 'regulatoryKnowledge', 'salesCapacity'].forEach(field => {
    const value = cleanLevel(rawQualification[field], field);
    if (value) qualification[field] = value;
  });

  const finalField = FINAL_FIELD_BY_MARKET[market];
  const rawFinal = input.finalAsk || {};
  const finalValue = clean(rawFinal[finalField], 30);
  if (finalValue && !FINAL_VALUES.has(finalValue)) {
    throw new ManualLeadValidationError('bad_final_ask', 'La respuesta final no es válida.');
  }
  const finalAsk = finalValue ? { [finalField]: finalValue } : {};

  const rawCampaign = input.campaign || {};
  const campaign = {
    variant: clean(rawCampaign.variant, 120),
    utmSource: clean(rawCampaign.utmSource, 160),
    utmCampaign: clean(rawCampaign.utmCampaign, 200)
  };

  const pipelineStatus = clean(input.pipelineStatus, 80) || 'Solicitado';
  if (!PIPELINE_STATES.has(pipelineStatus)) {
    throw new ManualLeadValidationError('bad_status', 'El estado de pipeline no es válido.');
  }

  let stageReached = 2;
  if (Object.keys(qualification).length) stageReached = 3;
  if (finalValue) stageReached = 4;

  const score = computeScore({ market, marketAccess, qualification });
  const leadType = leadTypeFor(score, marketAccess.hasAccess);
  let status = marketAccess.hasAccess ? 'qualifying' : 'referrer';
  if (finalValue) status = 'meeting_requested';

  const adminEmail = clean(context.adminEmail, 200);
  const channel = clean((input.source || {}).channel, 80) || 'whatsapp';
  const now = context.now;
  if (!now) throw new Error('buildManualLeadRecord requiere context.now');

  return {
    market,
    stageReached,
    status,
    leadType,
    score,
    pipelineStatus,
    contact,
    marketAccess,
    qualification,
    finalAsk,
    campaign,
    adminNotes: clean(input.adminNotes, 4000),
    rating: 0,
    ratingComment: '',
    manualEntry: true,
    source: {
      type: 'admin_manual',
      channel,
      createdBy: adminEmail
    },
    createdBy: adminEmail,
    createdAt: now,
    updatedAt: now
  };
}

module.exports = {
  buildManualLeadRecord,
  ManualLeadValidationError,
  PIPELINE_STATES,
  FINAL_FIELD_BY_MARKET
};

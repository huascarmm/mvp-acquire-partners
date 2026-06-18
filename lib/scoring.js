/* =============================================================================
 * lib/scoring.js — Cálculo de score 0-100 y leadType. SOLO en el servidor.
 * El cliente nunca ve esta lógica ni el puntaje.
 * ===========================================================================*/

// Pesos por defecto (cafe, madera, oro_compliance)
const WEIGHTS_DEFAULT = {
  directAccess: 25,        // de la prueba: actor concreto + puede presentar
  experience: 15,          // años en el sector
  canGetMeetings: 15,
  canCofinance: 15,
  regulatoryKnowledge: 10,
  salesCapacity: 10,
  referralCapacity: 10
};

// Variante institucional (oro_tokenizado): mismos campos, otra lectura
const WEIGHTS_INSTITUTIONAL = {
  directAccess: 25,        // acceso institucional/regulatorio
  experience: 10,
  canGetMeetings: 15,      // capacidad de convocar
  canCofinance: 15,        // aportar/canalizar recursos
  regulatoryKnowledge: 15, // sandbox / identidad digital
  salesCapacity: 10,       // relevancia del rol
  referralCapacity: 10
};

// Mapea respuesta cualitativa -> fracción del peso
const LEVEL = { high: 1, mid: 0.6, low: 0.3, none: 0 };

function weightsFor(market) {
  return market === 'oro_tokenizado' ? WEIGHTS_INSTITUTIONAL : WEIGHTS_DEFAULT;
}

/**
 * Calcula score 0-100 a partir de los datos acumulados del lead.
 * @param {object} lead - { market, marketAccess, qualification }
 */
function computeScore(lead) {
  const w = weightsFor(lead.market);
  const acc = lead.marketAccess || {};
  const q = lead.qualification || {};

  // directAccess: combina "puede presentar" + nombró un actor concreto
  let directLevel = 'none';
  const named = !!(acc.actorNamed && String(acc.actorNamed).trim().length > 2);
  if (acc.canIntroduce && named) directLevel = 'high';
  else if (acc.canIntroduce || named) directLevel = 'mid';
  else if (acc.hasAccess) directLevel = 'low';

  // experience por años
  const years = Number(acc.experienceYears || 0);
  let expLevel = 'none';
  if (years >= 8) expLevel = 'high';
  else if (years >= 3) expLevel = 'mid';
  else if (years >= 1) expLevel = 'low';

  const parts = {
    directAccess: LEVEL[directLevel] * w.directAccess,
    experience: LEVEL[expLevel] * w.experience,
    canGetMeetings: (LEVEL[q.canGetMeetings] ?? 0) * w.canGetMeetings,
    canCofinance: (LEVEL[q.canCofinance] ?? 0) * w.canCofinance,
    regulatoryKnowledge: (LEVEL[q.regulatoryKnowledge] ?? 0) * w.regulatoryKnowledge,
    salesCapacity: (LEVEL[q.salesCapacity] ?? 0) * w.salesCapacity,
    referralCapacity: (LEVEL[q.referralCapacity] ?? 0.6) * w.referralCapacity // por defecto medio si no se preguntó
  };

  let score = Math.round(Object.values(parts).reduce((a, b) => a + b, 0));
  if (!acc.hasAccess) score = Math.min(score, 35); // sin acceso declarado, tope bajo
  score = Math.max(0, Math.min(100, score));

  return score;
}

function leadTypeFor(score, hasAccess) {
  if (!hasAccess) return 'D';
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

module.exports = { computeScore, leadTypeFor };

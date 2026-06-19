'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { computeScore, leadTypeFor } = require('../../lib/scoring');

test('acceso alto + alta calificación => score alto y Tipo A', () => {
  const s = computeScore({
    market: 'cafe',
    marketAccess: { hasAccess: true, canIntroduce: true, actorNamed: 'Coop', experienceYears: 9 },
    qualification: { canGetMeetings: 'high', canCofinance: 'high', regulatoryKnowledge: 'high', salesCapacity: 'high' },
  });
  assert.ok(s >= 80, 'score >= 80, fue ' + s);
  assert.equal(leadTypeFor(s, true), 'A');
});

test('sin acceso => score bajo y Tipo D', () => {
  const s = computeScore({ market: 'cafe', marketAccess: { hasAccess: false } });
  assert.ok(s <= 25, 'score <= 25, fue ' + s);
  assert.equal(leadTypeFor(s, false), 'D');
});

test('score siempre entre 0 y 100', () => {
  const s = computeScore({
    market: 'madera',
    marketAccess: { hasAccess: true, experienceYears: 3 },
    qualification: { canGetMeetings: 'mid', canCofinance: 'low', regulatoryKnowledge: 'mid', salesCapacity: 'mid' },
  });
  assert.ok(s >= 0 && s <= 100);
});

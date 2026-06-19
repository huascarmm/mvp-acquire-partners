'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { sendMetaEvent, normalizeBoliviaPhone } = require('../../lib/meta-capi');

test('normalizeBoliviaPhone normaliza formatos comunes', () => {
  assert.equal(normalizeBoliviaPhone('70000000'), '59170000000');
  assert.equal(normalizeBoliviaPhone('+591 7000-0000'), '59170000000');
  assert.equal(normalizeBoliviaPhone('0059170000000'), '59170000000');
  assert.equal(normalizeBoliviaPhone('59170000000'), '59170000000');
  assert.equal(normalizeBoliviaPhone(''), '');
});

test('sendMetaEvent se omite sin configuración', async () => {
  delete process.env.META_CAPI;
  const r = await sendMetaEvent('cafe', { eventName: 'Lead', eventId: 'x' });
  assert.equal(r.skipped, true);
});

test('sendMetaEvent envía lead_score (no value USD), hashea email/teléfono y usa v25.0', async () => {
  process.env.META_CAPI = JSON.stringify({ cafe: { pixelId: 'PIX123', token: 'TOK' } });
  let captured;
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    captured = { url, body: JSON.parse(opts.body) };
    return { ok: true, status: 200, json: async () => ({ events_received: 1 }) };
  };
  try {
    const r = await sendMetaEvent('cafe', {
      eventName: 'Lead', eventId: 's1:lead', score: 80,
      contact: { email: 'A@B.com', whatsapp: '70000000' },
      ip: '1.2.3.4', ua: 'UA', sourceUrl: 'https://x.test/funnel.html?m=cafe',
    });
    assert.equal(r.ok, true);
    assert.match(captured.url, /\/v25\.0\/PIX123\/events/);
    const d = captured.body.data[0];
    assert.equal(d.event_name, 'Lead');
    assert.equal(d.event_id, 's1:lead');
    assert.equal(d.action_source, 'website');
    assert.equal(d.event_source_url, 'https://x.test/funnel.html?m=cafe');
    assert.equal(d.custom_data.lead_score, 80);
    assert.equal(d.custom_data.value, undefined);    // NO debe enviarse como USD
    assert.equal(d.custom_data.currency, undefined);
    assert.ok(Array.isArray(d.user_data.em) && d.user_data.em[0].length === 64);
    assert.ok(Array.isArray(d.user_data.ph) && d.user_data.ph[0].length === 64);
    assert.equal(d.user_data.client_ip_address, '1.2.3.4');
  } finally {
    global.fetch = realFetch;
  }
});

test('sendMetaEvent reporta status en error sin lanzar', async () => {
  process.env.META_CAPI = JSON.stringify({ cafe: { pixelId: 'PIX', token: 'TOK' } });
  const realFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'bad' } }) });
  try {
    const r = await sendMetaEvent('cafe', { eventName: 'Lead', eventId: 'e' });
    assert.equal(r.ok, false);
    assert.equal(r.status, 400);
  } finally {
    global.fetch = realFetch;
  }
});

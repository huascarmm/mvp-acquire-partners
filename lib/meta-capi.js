/* =============================================================================
 * lib/meta-capi.js — Conversions API de Meta (server-side), OPCIONAL.
 * Se activa solo si existe la env META_CAPI (JSON por mercado):
 *   META_CAPI={"cafe":{"pixelId":"123","token":"EAA..."}, "madera":{...}}
 * Variables opcionales:
 *   META_GRAPH_VERSION  (default v21.0)  -> súbela cuando Meta publique nuevas
 *   META_TEST_EVENT_CODE (para probar en Events Manager → Test Events)
 * Si no está configurado, no hace nada (no rompe el flujo).
 * Recomendado por Meta: dual tracking (Pixel del navegador + CAPI), dedup por
 * event_id compartido entre ambos.
 * ===========================================================================*/
'use strict';
const crypto = require('crypto');

const GRAPH = process.env.META_GRAPH_VERSION || 'v21.0';
const sha256 = (v) => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');

function config() {
  try { return JSON.parse(process.env.META_CAPI || '{}'); } catch { return {}; }
}

/**
 * Envía un evento a Meta. No bloquea el flujo: errores se loguean y se ignoran.
 * @param {string} market
 * @param {object} e { eventName, eventId, score, contact:{email,whatsapp}, ip, ua, fbp, fbc, sourceUrl }
 */
async function sendMetaEvent(market, e) {
  const cfg = config()[market];
  if (!cfg || !cfg.pixelId || !cfg.token) return { skipped: true };

  const user_data = {};
  if (e.contact && e.contact.email) user_data.em = [sha256(e.contact.email)];
  if (e.contact && e.contact.whatsapp) user_data.ph = [sha256(String(e.contact.whatsapp).replace(/\D/g, ''))];
  if (e.ip) user_data.client_ip_address = e.ip;
  if (e.ua) user_data.client_user_agent = e.ua;
  if (e.fbp) user_data.fbp = e.fbp;
  if (e.fbc) user_data.fbc = e.fbc;

  const body = {
    data: [{
      event_name: e.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: e.eventId,
      action_source: 'website',
      event_source_url: e.sourceUrl || undefined,
      user_data,
      custom_data: {
        content_category: market,
        value: e.score != null ? Number(e.score) : undefined,
        currency: 'USD',
      },
    }],
  };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;

  const url = `https://graph.facebook.com/${GRAPH}/${cfg.pixelId}/events?access_token=${encodeURIComponent(cfg.token)}`;
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) console.error('CAPI', e.eventName, r.status);
    return { ok: r.ok, status: r.status };
  } catch (err) {
    console.error('CAPI error', String(err));
    return { ok: false, error: String(err) };
  }
}

module.exports = { sendMetaEvent };

/* =============================================================================
 * lib/meta-capi.js — Conversions API de Meta (server-side), OPCIONAL.
 * Se activa solo si existe la env META_CAPI (JSON por mercado):
 *   META_CAPI={"cafe":{"pixelId":"123","token":"EAA..."}, "madera":{...}}
 * Variables opcionales:
 *   META_GRAPH_VERSION   (default v25.0 — versión vigente feb-2026)
 *   META_TEST_EVENT_CODE (para probar en Events Manager → Test Events)
 * Si no está configurado, no hace nada (no rompe el flujo).
 * Dual tracking recomendado por Meta: Pixel (navegador) + CAPI, dedup por
 * event_id idéntico en ambos.
 * ===========================================================================*/
'use strict';
const crypto = require('crypto');

const GRAPH = process.env.META_GRAPH_VERSION || 'v25.0';
const sha256 = (v) => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');

function config() {
  try { return JSON.parse(process.env.META_CAPI || '{}'); } catch { return {}; }
}

// Normaliza teléfonos bolivianos a formato internacional sin signos.
// "70000000" -> "59170000000"; quita prefijo "00" internacional.
function normalizeBoliviaPhone(value) {
  let phone = String(value || '').replace(/\D/g, '');
  if (/^[67]\d{7}$/.test(phone)) phone = `591${phone}`; // móvil local 8 dígitos
  if (phone.startsWith('00')) phone = phone.slice(2);
  return phone;
}

/**
 * Envía un evento a Meta. No rompe el flujo: devuelve { ok|skipped, status, body }.
 * @param {string} market
 * @param {object} e { eventName, eventId, score, contact:{email,whatsapp}, ip, ua, fbp, fbc, sourceUrl }
 */
async function sendMetaEvent(market, e) {
  const cfg = config()[market];
  if (!cfg || !cfg.pixelId || !cfg.token) return { skipped: true };

  const user_data = {};
  if (e.contact && e.contact.email) user_data.em = [sha256(e.contact.email)];
  if (e.contact && e.contact.whatsapp) {
    const phone = normalizeBoliviaPhone(e.contact.whatsapp);
    if (phone) user_data.ph = [sha256(phone)];
  }
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
      // lead_score = puntuación interna (NO es valor económico en USD).
      custom_data: {
        content_category: market,
        lead_score: e.score != null ? Number(e.score) : undefined,
        lead_type: e.leadType || undefined,
      },
    }],
  };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;

  const url = `https://graph.facebook.com/${GRAPH}/${cfg.pixelId}/events?access_token=${encodeURIComponent(cfg.token)}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const responseBody = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('CAPI error', e.eventName, r.status, JSON.stringify(responseBody));
    } else {
      console.log('CAPI accepted', e.eventName, JSON.stringify(responseBody));
    }
    return { ok: r.ok, status: r.status, body: responseBody };
  } catch (err) {
    console.error('CAPI exception', e.eventName, String(err));
    return { ok: false, error: String(err) };
  }
}

module.exports = { sendMetaEvent, normalizeBoliviaPhone };

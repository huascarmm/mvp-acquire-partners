/* =============================================================================
 * server.js — API mínima + servidor estático.
 * - Escrituras de leads/referidos vía firebase-admin (Firestore "(default)").
 * - Lecturas admin protegidas por ID token de Firebase + allowlist de correos.
 * - Sirve /public con cache headers (para Cloud Run "single service").
 *   En producción recomendamos Firebase Hosting (CDN) + rewrite /api a Cloud Run.
 *
 * Secretos por variables de entorno (sin .env en producción):
 *   FIREBASE_PROJECT_ID   (requerido)
 *   ADMIN_EMAILS          (correos admin separados por coma)
 *   ALLOWED_ORIGIN        (opcional, para CORS si el front está en otro origen)
 *   PORT                  (Cloud Run lo inyecta; default 8080)
 *   GOOGLE_APPLICATION_CREDENTIALS (solo local; en Cloud Run se usa ADC)
 * ===========================================================================*/
'use strict';

const path = require('path');
const express = require('express');
const admin = require('firebase-admin');
const { computeScore, leadTypeFor } = require('./lib/scoring');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const PORT = process.env.PORT || 8080;

// --- Init firebase-admin (ADC en Cloud Run; clave por env en local) ----------
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore(); // base "(default)"
const auth = admin.auth();

const MARKETS = new Set(['cafe', 'madera', 'oro_compliance', 'oro_tokenizado']);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

// CORS sólo si el front vive en otro origen (con Hosting+rewrite no hace falta)
app.use((req, res, next) => {
  if (ALLOWED_ORIGIN) {
    res.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
  }
  next();
});

// --- Rate limit simple en memoria (suficiente para MVP) ----------------------
const hits = new Map();
function rateLimit(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || req.ip || 'x').split(',')[0].trim();
  const now = Date.now();
  const win = 60_000, max = 30;
  const rec = hits.get(ip) || { c: 0, t: now };
  if (now - rec.t > win) { rec.c = 0; rec.t = now; }
  rec.c++; hits.set(ip, rec);
  if (rec.c > max) return res.status(429).json({ ok: false, error: 'rate_limited' });
  next();
}

const isStr = v => typeof v === 'string';
const clean = (v, n = 300) => (isStr(v) ? v.trim().slice(0, n) : '');

// --- POST /api/lead : upsert progresivo del lead -----------------------------
app.post('/api/lead', rateLimit, async (req, res) => {
  try {
    const b = req.body || {};
    if (!isStr(b.sessionId) || b.sessionId.length < 8) return res.status(400).json({ ok: false, error: 'bad_session' });
    if (!MARKETS.has(b.market)) return res.status(400).json({ ok: false, error: 'bad_market' });

    const ref = db.collection('leads').doc(b.sessionId);
    const snap = await ref.get();
    const prev = snap.exists ? snap.data() : {};

    // Merge superficial de secciones permitidas
    const patch = b.patch || {};
    const merged = {
      market: b.market,
      stageReached: Math.max(Number(prev.stageReached || 0), Number(b.stageReached || 0)),
      contact: { ...(prev.contact || {}), ...(patch.contact || {}) },
      marketAccess: { ...(prev.marketAccess || {}), ...(patch.marketAccess || {}) },
      qualification: { ...(prev.qualification || {}), ...(patch.qualification || {}) },
      finalAsk: { ...(prev.finalAsk || {}), ...(patch.finalAsk || {}) },
      campaign: { ...(prev.campaign || {}), ...(patch.campaign || {}) }
    };

    // Recalcular score/tipo en el servidor
    const score = computeScore(merged);
    const hasAccess = !!(merged.marketAccess && merged.marketAccess.hasAccess);
    const leadType = leadTypeFor(score, hasAccess);

    // Estado
    let status = 'qualifying';
    if (!hasAccess) status = 'referrer';
    if (merged.finalAsk && (merged.finalAsk.willIntroduceDecisionMaker || merged.finalAsk.joinRoundtable)) {
      status = 'meeting_requested';
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    await ref.set({
      ...merged,
      score, leadType, status,
      updatedAt: now,
      ...(snap.exists ? {} : { createdAt: now })
    }, { merge: true });

    // No devolvemos el score (queda oculto al cliente)
    res.json({ ok: true, id: b.sessionId });
  } catch (e) {
    console.error('lead error', e);
    res.status(500).json({ ok: false, error: 'server' });
  }
});

// --- POST /api/referral : crea referido + cupón ------------------------------
function couponCode() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return 'ASOBC-' + s;
}

app.post('/api/referral', rateLimit, async (req, res) => {
  try {
    const b = req.body || {};
    if (!MARKETS.has(b.market)) return res.status(400).json({ ok: false, error: 'bad_market' });
    const referred = b.referred || {};
    if (!clean(referred.name)) return res.status(400).json({ ok: false, error: 'missing_referred' });

    const code = couponCode();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await db.collection('referrals').add({
      market: b.market,
      referrerContact: {
        name: clean((b.referrerContact || {}).name),
        email: clean((b.referrerContact || {}).email, 120),
        whatsapp: clean((b.referrerContact || {}).whatsapp, 40)
      },
      referred: {
        name: clean(referred.name),
        contact: clean(referred.contact, 200),
        relationship: clean(referred.relationship, 200)
      },
      referrerLeadId: clean(b.referrerLeadId, 80) || null,
      couponCode: code,
      couponStatus: 'issued',
      createdAt: now
    });
    res.json({ ok: true, couponCode: code, id: docRef.id });
  } catch (e) {
    console.error('referral error', e);
    res.status(500).json({ ok: false, error: 'server' });
  }
});

// --- Auth admin: verifica ID token + allowlist -------------------------------
async function requireAdmin(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) return res.status(401).json({ ok: false, error: 'no_token' });
    const decoded = await auth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    if (!email || (ADMIN_EMAILS.length && !ADMIN_EMAILS.includes(email))) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    req.adminEmail = email;
    next();
  } catch (e) {
    res.status(401).json({ ok: false, error: 'bad_token' });
  }
}

function tsToIso(t) { try { return t && t.toDate ? t.toDate().toISOString() : null; } catch { return null; } }

// --- GET /api/admin/leads ----------------------------------------------------
app.get('/api/admin/leads', requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection('leads').orderBy('updatedAt', 'desc').limit(2000).get();
    const leads = snap.docs.map(d => {
      const x = d.data();
      return {
        id: d.id, market: x.market, stageReached: x.stageReached || 0,
        status: x.status, leadType: x.leadType, score: x.score,
        contact: x.contact || {}, marketAccess: x.marketAccess || {},
        qualification: x.qualification || {}, finalAsk: x.finalAsk || {},
        campaign: x.campaign || {},
        createdAt: tsToIso(x.createdAt), updatedAt: tsToIso(x.updatedAt)
      };
    });
    const rsnap = await db.collection('referrals').orderBy('createdAt', 'desc').limit(2000).get();
    const referrals = rsnap.docs.map(d => {
      const x = d.data();
      return { id: d.id, market: x.market, referrerContact: x.referrerContact || {},
        referred: x.referred || {}, couponCode: x.couponCode, couponStatus: x.couponStatus,
        createdAt: tsToIso(x.createdAt) };
    });
    res.json({ ok: true, leads, referrals });
  } catch (e) {
    console.error('admin leads error', e);
    res.status(500).json({ ok: false, error: 'server' });
  }
});

// --- GET /api/admin/stats : agregados ----------------------------------------
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection('leads').limit(5000).get();
    const stats = { total: 0, byMarket: {}, byType: { A: 0, B: 0, C: 0, D: 0 },
      byStage: {}, qualified: 0, meetings: 0 };
    snap.forEach(d => {
      const x = d.data(); stats.total++;
      stats.byMarket[x.market] = (stats.byMarket[x.market] || 0) + 1;
      if (x.leadType) stats.byType[x.leadType] = (stats.byType[x.leadType] || 0) + 1;
      const st = String(x.stageReached || 0);
      stats.byStage[st] = (stats.byStage[st] || 0) + 1;
      if (x.leadType === 'A' || x.leadType === 'B') stats.qualified++;
      if (x.status === 'meeting_requested') stats.meetings++;
    });
    const rsnap = await db.collection('referrals').limit(5000).get();
    stats.referrals = rsnap.size;
    res.json({ ok: true, stats });
  } catch (e) {
    console.error('admin stats error', e);
    res.status(500).json({ ok: false, error: 'server' });
  }
});

// --- Estáticos (cache largo para assets, corto para HTML) --------------------
const PUB = path.join(__dirname, 'public');
app.use(express.static(PUB, {
  setHeaders(res, filePath) {
    if (/\.(css|js|webp|png|jpg|svg|woff2)$/.test(filePath)) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.set('Cache-Control', 'public, max-age=300');
    }
  }
}));
app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`socio-funnel API+static en :${PORT}`));

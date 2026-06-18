/* =============================================================================
 * tests/cleanup.js — Borra de Firestore los documentos de prueba E2E.
 * Identifica por prefijo "e2e-" en el id del lead y en referrerLeadId.
 * Usa ADC (en CI, la misma service account del deploy via GOOGLE_APPLICATION_CREDENTIALS).
 * Requiere FIREBASE_PROJECT_ID.
 * ===========================================================================*/
'use strict';
const admin = require('firebase-admin');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
if (!PROJECT_ID) { console.error('Falta FIREBASE_PROJECT_ID'); process.exit(1); }

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

async function deleteWhere(coll, predicate) {
  const snap = await db.collection(coll).limit(5000).get();
  let n = 0;
  let batch = db.batch();
  for (const doc of snap.docs) {
    if (!predicate(doc)) continue;
    batch.delete(doc.ref);
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  if (n % 400 !== 0) await batch.commit();
  return n;
}

(async () => {
  const leads = await deleteWhere('leads', d => d.id.startsWith('e2e-'));
  const refs = await deleteWhere('referrals', d => String((d.data() || {}).referrerLeadId || '').startsWith('e2e-'));
  console.log(`Limpieza E2E: ${leads} leads, ${refs} referrals borrados.`);
  process.exit(0);
})().catch(e => { console.error('Cleanup error:', e); process.exit(1); });

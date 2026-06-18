/* =============================================================================
 * admin.js — Panel admin (modulo). Auth con Firebase + lectura via API protegida.
 * Solo se carga en /admin (no afecta la velocidad del embudo).
 * ===========================================================================*/
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);

const $ = s => document.querySelector(s);
let DATA = { leads: [], referrals: [] };
let TAB = 'leads';
let idToken = '';

const MARKET_LABEL = { cafe: 'Cafe', madera: 'Madera', oro_compliance: 'Oro compliance', oro_tokenizado: 'Investigacion' };

/* ---- Auth ---- */
$('#signin').onclick = async () => {
  $('#err').textContent = '';
  try {
    await signInWithEmailAndPassword(auth, $('#email').value.trim(), $('#pass').value);
  } catch (e) { $('#err').textContent = 'No se pudo ingresar. Verifica tus datos.'; }
};
onAuthStateChanged(auth, async (user) => {
  if (!user) { $('#login').style.display = ''; $('#dash').style.display = 'none'; return; }
  idToken = await user.getIdToken();
  $('#who').innerHTML = user.email + ' &middot; <a href="#" id="out" style="color:var(--muted)">salir</a>';
  $('#out').onclick = () => signOut(auth);
  $('#login').style.display = 'none'; $('#dash').style.display = '';
  await load();
});

async function api(path) {
  const r = await fetch(path, { headers: { Authorization: 'Bearer ' + idToken } });
  if (!r.ok) throw new Error('api');
  return r.json();
}

async function load() {
  try {
    const [s, l] = await Promise.all([api('/api/admin/stats'), api('/api/admin/leads')]);
    DATA.leads = l.leads || []; DATA.referrals = l.referrals || [];
    renderKpis(s.stats); fillMarketFilter(); renderTable();
  } catch (e) {
    $('#tableWrap').innerHTML = '<p class="muted">No se pudieron cargar los datos. Revisa que tu correo este en ADMIN_EMAILS.</p>';
  }
}

function renderKpis(st) {
  const cards = [
    ['Total leads', st.total || 0],
    ['Tipo A+B (calificados)', st.qualified || 0],
    ['Reuniones solicitadas', st.meetings || 0],
    ['Referidos', st.referrals || 0],
    ['Tipo A', (st.byType && st.byType.A) || 0],
    ['Tipo B', (st.byType && st.byType.B) || 0]
  ];
  $('#kpis').innerHTML = cards.map(c => `<div class="kpi"><div class="n">${c[1]}</div><div class="l">${c[0]}</div></div>`).join('');
}

function fillMarketFilter() {
  const sel = $('#fMarket');
  Object.keys(MARKET_LABEL).forEach(k => {
    if (![...sel.options].some(o => o.value === k)) {
      const o = document.createElement('option'); o.value = k; o.textContent = MARKET_LABEL[k]; sel.appendChild(o);
    }
  });
}

['#fMarket', '#fType', '#fStage', '#fSearch'].forEach(s => { const e = $(s); e.oninput = renderTable; e.onchange = renderTable; });
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); TAB = b.dataset.tab; renderTable();
});
$('#csv').onclick = exportCSV;

function filteredLeads() {
  const m = $('#fMarket').value, t = $('#fType').value, st = $('#fStage').value, q = $('#fSearch').value.toLowerCase().trim();
  return DATA.leads.filter(x => {
    if (m && x.market !== m) return false;
    if (t && x.leadType !== t) return false;
    if (st && String(x.stageReached) !== st) return false;
    if (q) {
      const blob = ((x.contact && (x.contact.name + ' ' + x.contact.company + ' ' + x.contact.email)) || '').toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

function renderTable() {
  if (TAB === 'referrals') return renderReferrals();
  $('#filters').style.display = '';
  const rows = filteredLeads();
  let html = '<table><thead><tr><th>Nombre</th><th>Mercado</th><th>Tipo</th><th>Score</th><th>Etapa</th><th>Estado</th><th>Variante</th></tr></thead><tbody>';
  rows.forEach((x, i) => {
    const c = x.contact || {};
    html += `<tr class="click" data-i="${i}">
      <td>${esc(c.name || '(sin nombre)')}<br><span class="muted" style="font-size:.8rem">${esc(c.company || '')}</span></td>
      <td>${MARKET_LABEL[x.market] || x.market}</td>
      <td><span class="tag ${x.leadType || 'D'}">${x.leadType || '-'}</span></td>
      <td>${x.score != null ? x.score : '-'}</td>
      <td>${x.stageReached || 0}</td>
      <td class="muted">${esc(x.status || '')}</td>
      <td class="muted">${esc((x.campaign && x.campaign.variant) || '')}</td></tr>`;
  });
  html += '</tbody></table>';
  if (!rows.length) html = '<p class="muted">Sin resultados con estos filtros.</p>';
  $('#tableWrap').innerHTML = html;
  $('#tableWrap').querySelectorAll('tr.click').forEach(tr => tr.onclick = () => detail(rows[+tr.dataset.i]));
}

function renderReferrals() {
  $('#filters').style.display = 'none';
  const rows = DATA.referrals;
  let html = '<table><thead><tr><th>Refiere</th><th>Referido</th><th>Relacion</th><th>Mercado</th><th>Cupon</th><th>Estado</th></tr></thead><tbody>';
  rows.forEach(x => {
    html += `<tr>
      <td>${esc((x.referrerContact && x.referrerContact.name) || '-')}</td>
      <td>${esc((x.referred && x.referred.name) || '-')}<br><span class="muted" style="font-size:.8rem">${esc((x.referred && x.referred.contact) || '')}</span></td>
      <td class="muted">${esc((x.referred && x.referred.relationship) || '')}</td>
      <td>${MARKET_LABEL[x.market] || x.market}</td>
      <td><span class="tag">${esc(x.couponCode || '')}</span></td>
      <td class="muted">${esc(x.couponStatus || '')}</td></tr>`;
  });
  html += '</tbody></table>';
  if (!rows.length) html = '<p class="muted">Aun no hay referidos.</p>';
  $('#tableWrap').innerHTML = html;
}

function detail(x) {
  $('#sheet').innerHTML = `<p class="eyebrow">${MARKET_LABEL[x.market] || x.market} &middot; ${x.leadType || '-'} &middot; score ${x.score != null ? x.score : '-'}</p>
    <h2 class="q">${esc((x.contact && x.contact.name) || '(sin nombre)')}</h2>
    <pre>${esc(JSON.stringify({ contact: x.contact, marketAccess: x.marketAccess, qualification: x.qualification, finalAsk: x.finalAsk, campaign: x.campaign, status: x.status, createdAt: x.createdAt }, null, 2))}</pre>
    <button class="btn full" id="close" style="margin-top:1rem">Cerrar</button>`;
  $('#modal').classList.add('open');
  $('#close').onclick = () => $('#modal').classList.remove('open');
}
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').classList.remove('open'); };

function exportCSV() {
  const rows = filteredLeads();
  const head = ['nombre', 'email', 'whatsapp', 'empresa', 'cargo', 'mercado', 'tipo', 'score', 'etapa', 'estado', 'actor', 'puede_presentar', 'variante', 'creado'];
  const lines = [head.join(',')];
  rows.forEach(x => {
    const c = x.contact || {}, a = x.marketAccess || {}, cam = x.campaign || {};
    const row = [c.name, c.email, c.whatsapp, c.company, c.role, x.market, x.leadType, x.score, x.stageReached, x.status,
      a.actorNamed, a.canIntroduce ? 'si' : 'no', cam.variant, x.createdAt];
    lines.push(row.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = u; a.download = 'leads.csv'; a.click(); URL.revokeObjectURL(u);
}

function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]); }

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

const STATES = ['Solicitado', 'Revisado', 'Agendado', 'Primera Reunión', 'Segunda Reunión', 'Trabajando', 'Cerrado', 'Cerrado con feedback'];
const STATE_SLUG = {
  'Solicitado': 'solicitado', 'Revisado': 'revisado', 'Agendado': 'agendado',
  'Primera Reunión': 'primera', 'Segunda Reunión': 'segunda', 'Trabajando': 'trabajando',
  'Cerrado': 'cerrado', 'Cerrado con feedback': 'cerrado-fb'
};
function findLead(id) { return DATA.leads.find(l => l.id === id); }
async function apiPatch(id, body) {
  const r = await fetch('/api/admin/lead/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + idToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('patch');
  return r.json();
}

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
  let html = '<table><thead><tr><th>Nombre</th><th>Mercado</th><th>Tipo</th><th>Score</th><th>Etapa</th><th>Estado</th><th>Notas</th><th>Rating</th><th>Variante</th></tr></thead><tbody>';
  rows.forEach((x) => {
    const c = x.contact || {};
    const ps = x.pipelineStatus || 'Solicitado';
    const opts = STATES.map(s => `<option ${s === ps ? 'selected' : ''}>${s}</option>`).join('');
    html += `<tr class="lead-row st-${STATE_SLUG[ps] || 'solicitado'}" data-id="${esc(x.id)}">
      <td><a href="#" class="open">${esc(c.name || '(sin nombre)')}</a><br><span class="muted" style="font-size:.8rem">${esc(c.company || '')}</span></td>
      <td>${MARKET_LABEL[x.market] || x.market}</td>
      <td><span class="tag ${x.leadType || 'D'}">${x.leadType || '-'}</span></td>
      <td>${x.score != null ? x.score : '-'}</td>
      <td>${x.stageReached || 0}</td>
      <td><select class="st-sel">${opts}</select></td>
      <td><input class="notes-inp" placeholder="Conclusiones, anotaciones..." value="${esc(x.adminNotes || '')}" disabled></td>
      <td>${ratingHTML(x)}</td>
      <td class="muted">${esc((x.campaign && x.campaign.variant) || '')}</td></tr>`;
  });
  html += '</tbody></table>';
  if (!rows.length) html = '<p class="muted">Sin resultados con estos filtros.</p>';
  $('#tableWrap').innerHTML = html;
  wireRows();
}

function ratingHTML(x) {
  const r = x.rating || 0;
  let stars = '';
  for (let i = 1; i <= 5; i++) stars += `<span class="star ${i <= r ? 'on' : ''}" data-v="${i}">★</span>`;
  return `<div class="rating">
    <div class="stars">${stars}</div>
    <div class="rate-pop">
      <button class="pencil" title="Editar comentario">✎</button>
      <input class="rate-cmt" placeholder="Comentario..." value="${esc(x.ratingComment || '')}" disabled>
    </div>
  </div>`;
}

function setRowColor(tr, ps) { tr.className = 'lead-row st-' + (STATE_SLUG[ps] || 'solicitado'); }
function paintStars(rating, v) { rating.querySelectorAll('.star').forEach(s => s.classList.toggle('on', +s.dataset.v <= v)); }

function wireRows() {
  const wrap = $('#tableWrap');
  wrap.querySelectorAll('tr.lead-row').forEach(tr => {
    const id = tr.dataset.id;
    const lead = findLead(id);
    if (!lead) return;

    // Abrir detalle (y marcar Revisado si estaba Solicitado)
    tr.querySelector('a.open').onclick = (e) => { e.preventDefault(); openDetail(lead, tr); };

    // Estado: dropdown que recolorea toda la fila
    const sel = tr.querySelector('.st-sel');
    sel.onclick = (e) => e.stopPropagation();
    sel.onchange = async () => {
      const ps = sel.value;
      try { await apiPatch(id, { pipelineStatus: ps }); lead.pipelineStatus = ps; setRowColor(tr, ps); }
      catch (_e) { sel.value = lead.pipelineStatus || 'Solicitado'; }
    };

    // Notas: deshabilitado -> clic habilita -> focusout deshabilita y guarda
    const notes = tr.querySelector('.notes-inp');
    notes.onclick = () => { notes.disabled = false; notes.focus(); };
    notes.onblur = async () => {
      notes.disabled = true;
      if (notes.value !== (lead.adminNotes || '')) {
        try { await apiPatch(id, { adminNotes: notes.value }); lead.adminNotes = notes.value; }
        catch (_e) { notes.value = lead.adminNotes || ''; }
      }
    };

    wireRating(tr, lead, id);
  });
}

function wireRating(tr, lead, id) {
  const rating = tr.querySelector('.rating');
  const pop = rating.querySelector('.rate-pop');
  const cmt = rating.querySelector('.rate-cmt');

  rating.querySelectorAll('.star').forEach(st => {
    st.onclick = async (e) => {
      e.stopPropagation();
      const v = +st.dataset.v;
      try { await apiPatch(id, { rating: v }); lead.rating = v; paintStars(rating, v); }
      catch (_e) { paintStars(rating, lead.rating || 0); }
    };
  });

  // Popover al pasar el mouse
  rating.onmouseenter = () => pop.classList.add('show');
  rating.onmouseleave = () => { if (document.activeElement !== cmt) pop.classList.remove('show'); };

  // Lápiz habilita el editable; focusout guarda, deshabilita y oculta
  pop.querySelector('.pencil').onclick = (e) => { e.stopPropagation(); cmt.disabled = false; cmt.focus(); };
  cmt.onblur = async () => {
    cmt.disabled = true;
    pop.classList.remove('show');
    if (cmt.value !== (lead.ratingComment || '')) {
      try { await apiPatch(id, { ratingComment: cmt.value }); lead.ratingComment = cmt.value; }
      catch (_e) { cmt.value = lead.ratingComment || ''; }
    }
  };
}

async function openDetail(x, tr) {
  detail(x);
  if ((x.pipelineStatus || 'Solicitado') === 'Solicitado') {
    try {
      await apiPatch(x.id, { pipelineStatus: 'Revisado' });
      x.pipelineStatus = 'Revisado';
      if (tr) { const sel = tr.querySelector('.st-sel'); if (sel) sel.value = 'Revisado'; setRowColor(tr, 'Revisado'); }
    } catch (_e) { /* noop */ }
  }
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
    <pre>${esc(JSON.stringify({ contact: x.contact, marketAccess: x.marketAccess, qualification: x.qualification, finalAsk: x.finalAsk, campaign: x.campaign, pipelineStatus: x.pipelineStatus, rating: x.rating, ratingComment: x.ratingComment, adminNotes: x.adminNotes, status: x.status, createdAt: x.createdAt }, null, 2))}</pre>
    <button class="btn full" id="close" style="margin-top:1rem">Cerrar</button>`;
  $('#modal').classList.add('open');
  $('#close').onclick = () => $('#modal').classList.remove('open');
}
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').classList.remove('open'); };

function exportCSV() {
  const rows = filteredLeads();
  const head = ['nombre', 'email', 'whatsapp', 'empresa', 'cargo', 'mercado', 'tipo', 'score', 'etapa', 'estado_pipeline', 'rating', 'rating_comentario', 'notas', 'actor', 'puede_presentar', 'variante', 'creado'];
  const lines = [head.join(',')];
  rows.forEach(x => {
    const c = x.contact || {}, a = x.marketAccess || {}, cam = x.campaign || {};
    const row = [c.name, c.email, c.whatsapp, c.company, c.role, x.market, x.leadType, x.score, x.stageReached,
      x.pipelineStatus || 'Solicitado', x.rating || 0, x.ratingComment, x.adminNotes,
      a.actorNamed, a.canIntroduce ? 'si' : 'no', cam.variant, x.createdAt];
    lines.push(row.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = u; a.download = 'leads.csv'; a.click(); URL.revokeObjectURL(u);
}

function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]); }

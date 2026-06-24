/* =============================================================================
 * admin.js — Panel admin. Auth Firebase + API protegida.
 * Incluye edición inline de notas y alta manual de leads recibidos por otros
 * canales (WhatsApp, llamada, correo o presencial).
 * ===========================================================================*/
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);

const $ = selector => document.querySelector(selector);
let DATA = { leads: [], referrals: [] };
let TAB = 'leads';
let idToken = '';

const MARKET_LABEL = {
  cafe: 'Café',
  madera: 'Madera',
  oro_compliance: 'Oro compliance',
  oro_tokenizado: 'Investigación'
};
const STATES = ['Solicitado', 'Revisado', 'Agendado', 'Primera Reunión', 'Segunda Reunión', 'Trabajando', 'Cerrado', 'Cerrado con feedback'];
const STATE_SLUG = {
  'Solicitado': 'solicitado', 'Revisado': 'revisado', 'Agendado': 'agendado',
  'Primera Reunión': 'primera', 'Segunda Reunión': 'segunda', 'Trabajando': 'trabajando',
  'Cerrado': 'cerrado', 'Cerrado con feedback': 'cerrado-fb'
};
function findLead(id) { return DATA.leads.find(lead => lead.id === id); }

async function api(path) {
  const response = await fetch(path, { headers: { Authorization: 'Bearer ' + idToken } });
  if (!response.ok) throw new Error('api');
  return response.json();
}

async function apiPatch(id, body) {
  const response = await fetch('/api/admin/lead/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + idToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error('patch');
  return response.json();
}

async function apiCreateManualLead(body) {
  const response = await fetch('/api/admin/leads', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + idToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error || 'No se pudo crear el lead.');
  return result;
}

/* ---- Auth ---- */
$('#signin').onclick = async () => {
  $('#err').textContent = '';
  try {
    await signInWithEmailAndPassword(auth, $('#email').value.trim(), $('#pass').value);
  } catch (_error) {
    $('#err').textContent = 'No se pudo ingresar. Verifica tus datos.';
  }
};

onAuthStateChanged(auth, async user => {
  if (!user) {
    $('#login').style.display = '';
    $('#dash').style.display = 'none';
    return;
  }
  idToken = await user.getIdToken();
  $('#who').innerHTML = esc(user.email) + ' &middot; <a href="#" id="out" style="color:var(--muted)">salir</a>';
  $('#out').onclick = event => { event.preventDefault(); signOut(auth); };
  $('#login').style.display = 'none';
  $('#dash').style.display = '';
  await load();
});

async function load() {
  try {
    const [statsResult, leadsResult] = await Promise.all([
      api('/api/admin/stats'),
      api('/api/admin/leads')
    ]);
    DATA.leads = leadsResult.leads || [];
    DATA.referrals = leadsResult.referrals || [];
    renderKpis(statsResult.stats || {});
    fillMarketFilter();
    renderTable();
  } catch (_error) {
    $('#tableWrap').innerHTML = '<p class="muted">No se pudieron cargar los datos. Revisa que tu correo esté en ADMIN_EMAILS.</p>';
  }
}

function renderKpis(stats) {
  const cards = [
    ['Total leads', stats.total || 0],
    ['Tipo A+B (calificados)', stats.qualified || 0],
    ['Reuniones solicitadas', stats.meetings || 0],
    ['Referidos', stats.referrals || 0],
    ['Tipo A', (stats.byType && stats.byType.A) || 0],
    ['Tipo B', (stats.byType && stats.byType.B) || 0]
  ];
  $('#kpis').innerHTML = cards.map(card => `<div class="kpi"><div class="n">${card[1]}</div><div class="l">${card[0]}</div></div>`).join('');
}

function fillMarketFilter() {
  const select = $('#fMarket');
  Object.keys(MARKET_LABEL).forEach(key => {
    if (![...select.options].some(option => option.value === key)) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = MARKET_LABEL[key];
      select.appendChild(option);
    }
  });
}

['#fMarket', '#fType', '#fStage', '#fSearch'].forEach(selector => {
  const element = $(selector);
  element.oninput = renderTable;
  element.onchange = renderTable;
});

document.querySelectorAll('.tabs button').forEach(button => {
  button.onclick = () => {
    document.querySelectorAll('.tabs button').forEach(item => item.classList.remove('on'));
    button.classList.add('on');
    TAB = button.dataset.tab;
    renderTable();
  };
});

$('#csv').onclick = exportCSV;
$('#addLead').onclick = openManualLead;

function filteredLeads() {
  const market = $('#fMarket').value;
  const type = $('#fType').value;
  const stage = $('#fStage').value;
  const query = $('#fSearch').value.toLowerCase().trim();
  return DATA.leads.filter(lead => {
    if (market && lead.market !== market) return false;
    if (type && lead.leadType !== type) return false;
    if (stage && String(lead.stageReached) !== stage) return false;
    if (query) {
      const contact = lead.contact || {};
      const blob = [contact.name, contact.company, contact.email, contact.whatsapp, contact.role]
        .filter(Boolean).join(' ').toLowerCase();
      if (!blob.includes(query)) return false;
    }
    return true;
  });
}

function renderTable() {
  if (TAB === 'referrals') return renderReferrals();
  $('#filters').style.display = '';
  const rows = filteredLeads();
  let html = '<div class="table-scroll"><table><thead><tr><th>Nombre</th><th>Mercado</th><th>Tipo</th><th>Score</th><th>Etapa</th><th>Estado</th><th>Notas</th><th>Rating</th><th>Variante</th></tr></thead><tbody>';
  rows.forEach(lead => {
    const contact = lead.contact || {};
    const pipelineStatus = lead.pipelineStatus || 'Solicitado';
    const options = STATES.map(state => `<option ${state === pipelineStatus ? 'selected' : ''}>${esc(state)}</option>`).join('');
    const manualTag = lead.manualEntry ? '<span class="manual-tag">Manual</span>' : '';
    html += `<tr class="lead-row st-${STATE_SLUG[pipelineStatus] || 'solicitado'}" data-id="${escAttr(lead.id)}">
      <td><a href="#" class="open">${esc(contact.name || '(sin nombre)')}</a> ${manualTag}<br><span class="muted row-sub">${esc(contact.company || '')}</span></td>
      <td>${esc(MARKET_LABEL[lead.market] || lead.market)}</td>
      <td><span class="tag ${escAttr(lead.leadType || 'D')}">${esc(lead.leadType || '-')}</span></td>
      <td>${lead.score != null ? lead.score : '-'}</td>
      <td>${lead.stageReached || 0}</td>
      <td><select class="st-sel">${options}</select></td>
      <td><input class="notes-inp" aria-label="Notas de ${escAttr(contact.name || 'lead')}" placeholder="Conclusiones, anotaciones..." value="${escAttr(lead.adminNotes || '')}" readonly></td>
      <td>${ratingHTML(lead)}</td>
      <td class="muted">${esc((lead.campaign && lead.campaign.variant) || '')}</td></tr>`;
  });
  html += '</tbody></table></div>';
  if (!rows.length) html = '<p class="muted">Sin resultados con estos filtros.</p>';
  $('#tableWrap').innerHTML = html;
  wireRows();
}

function ratingHTML(lead) {
  const rating = lead.rating || 0;
  let stars = '';
  for (let value = 1; value <= 5; value++) {
    stars += `<span class="star ${value <= rating ? 'on' : ''}" data-v="${value}">★</span>`;
  }
  return `<div class="rating">
    <div class="stars">${stars}</div>
    <div class="rate-pop">
      <button class="pencil" type="button" title="Editar comentario">✎</button>
      <input class="rate-cmt" placeholder="Comentario..." value="${escAttr(lead.ratingComment || '')}" disabled>
    </div>
  </div>`;
}

function setRowColor(row, status) {
  row.className = 'lead-row st-' + (STATE_SLUG[status] || 'solicitado');
}

function paintStars(rating, value) {
  rating.querySelectorAll('.star').forEach(star => star.classList.toggle('on', +star.dataset.v <= value));
}

function wireRows() {
  const wrap = $('#tableWrap');
  wrap.querySelectorAll('tr.lead-row').forEach(row => {
    const id = row.dataset.id;
    const lead = findLead(id);
    if (!lead) return;

    row.querySelector('a.open').onclick = event => {
      event.preventDefault();
      openDetail(lead, row);
    };

    const statusSelect = row.querySelector('.st-sel');
    statusSelect.onclick = event => event.stopPropagation();
    statusSelect.onchange = async () => {
      const status = statusSelect.value;
      try {
        await apiPatch(id, { pipelineStatus: status });
        lead.pipelineStatus = status;
        setRowColor(row, status);
      } catch (_error) {
        statusSelect.value = lead.pipelineStatus || 'Solicitado';
      }
    };

    // readonly sí recibe foco/clic; disabled no, que era la causa del fallo.
    const notes = row.querySelector('.notes-inp');
    const beginNotesEdit = () => {
      if (!notes.readOnly) return;
      notes.dataset.original = notes.value;
      notes.readOnly = false;
      notes.classList.add('editing');
      requestAnimationFrame(() => {
        const end = notes.value.length;
        notes.setSelectionRange(end, end);
      });
    };
    notes.onclick = event => { event.stopPropagation(); beginNotesEdit(); };
    notes.onfocus = beginNotesEdit;
    notes.onkeydown = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        notes.blur();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        notes.value = notes.dataset.original ?? (lead.adminNotes || '');
        notes.blur();
      }
    };
    notes.onblur = async () => {
      notes.readOnly = true;
      notes.classList.remove('editing');
      if (notes.value === (lead.adminNotes || '')) return;
      notes.classList.add('saving');
      try {
        await apiPatch(id, { adminNotes: notes.value });
        lead.adminNotes = notes.value;
        notes.dataset.original = notes.value;
        notes.classList.remove('save-error');
      } catch (_error) {
        notes.value = lead.adminNotes || '';
        notes.classList.add('save-error');
        showNotice('No se pudo guardar la nota.', true);
      } finally {
        notes.classList.remove('saving');
      }
    };

    wireRating(row, lead, id);
  });
}

function wireRating(row, lead, id) {
  const rating = row.querySelector('.rating');
  const popover = rating.querySelector('.rate-pop');
  const comment = rating.querySelector('.rate-cmt');

  rating.querySelectorAll('.star').forEach(star => {
    star.onclick = async event => {
      event.stopPropagation();
      const value = +star.dataset.v;
      try {
        await apiPatch(id, { rating: value });
        lead.rating = value;
        paintStars(rating, value);
      } catch (_error) {
        paintStars(rating, lead.rating || 0);
      }
    };
  });

  rating.onmouseenter = () => popover.classList.add('show');
  rating.onmouseleave = () => {
    if (document.activeElement !== comment) popover.classList.remove('show');
  };

  popover.querySelector('.pencil').onclick = event => {
    event.stopPropagation();
    comment.disabled = false;
    comment.focus();
  };
  comment.onblur = async () => {
    comment.disabled = true;
    popover.classList.remove('show');
    if (comment.value === (lead.ratingComment || '')) return;
    try {
      await apiPatch(id, { ratingComment: comment.value });
      lead.ratingComment = comment.value;
    } catch (_error) {
      comment.value = lead.ratingComment || '';
    }
  };
}

async function openDetail(lead, row) {
  detail(lead);
  if ((lead.pipelineStatus || 'Solicitado') === 'Solicitado') {
    try {
      await apiPatch(lead.id, { pipelineStatus: 'Revisado' });
      lead.pipelineStatus = 'Revisado';
      if (row) {
        const select = row.querySelector('.st-sel');
        if (select) select.value = 'Revisado';
        setRowColor(row, 'Revisado');
      }
    } catch (_error) { /* no bloquea la consulta del detalle */ }
  }
}

function renderReferrals() {
  $('#filters').style.display = 'none';
  const rows = DATA.referrals;
  let html = '<div class="table-scroll"><table><thead><tr><th>Refiere</th><th>Referido</th><th>Relación</th><th>Mercado</th><th>Cupón</th><th>Estado</th></tr></thead><tbody>';
  rows.forEach(referral => {
    html += `<tr>
      <td>${esc((referral.referrerContact && referral.referrerContact.name) || '-')}</td>
      <td>${esc((referral.referred && referral.referred.name) || '-')}<br><span class="muted row-sub">${esc((referral.referred && referral.referred.contact) || '')}</span></td>
      <td class="muted">${esc((referral.referred && referral.referred.relationship) || '')}</td>
      <td>${esc(MARKET_LABEL[referral.market] || referral.market)}</td>
      <td><span class="tag">${esc(referral.couponCode || '')}</span></td>
      <td class="muted">${esc(referral.couponStatus || '')}</td></tr>`;
  });
  html += '</tbody></table></div>';
  if (!rows.length) html = '<p class="muted">Aún no hay referidos.</p>';
  $('#tableWrap').innerHTML = html;
}

function detail(lead) {
  $('#sheet').innerHTML = `<p class="eyebrow">${esc(MARKET_LABEL[lead.market] || lead.market)} &middot; ${esc(lead.leadType || '-')} &middot; score ${lead.score != null ? lead.score : '-'}</p>
    <h2 class="q">${esc((lead.contact && lead.contact.name) || '(sin nombre)')}</h2>
    <pre>${esc(JSON.stringify({
      contact: lead.contact,
      marketAccess: lead.marketAccess,
      qualification: lead.qualification,
      finalAsk: lead.finalAsk,
      campaign: lead.campaign,
      source: lead.source,
      manualEntry: lead.manualEntry,
      pipelineStatus: lead.pipelineStatus,
      rating: lead.rating,
      ratingComment: lead.ratingComment,
      adminNotes: lead.adminNotes,
      status: lead.status,
      createdAt: lead.createdAt
    }, null, 2))}</pre>
    <button class="btn full" id="close" type="button" style="margin-top:1rem">Cerrar</button>`;
  $('#modal').classList.add('open');
  $('#close').onclick = () => $('#modal').classList.remove('open');
}

$('#modal').onclick = event => {
  if (event.target.id === 'modal') $('#modal').classList.remove('open');
};

/* ---- Alta manual --------------------------------------------------------- */
const manualForm = $('#manualLeadForm');
const manualModal = $('#leadModal');

function openManualLead() {
  manualForm.reset();
  $('#manualError').textContent = '';
  $('#mlMarket').value = 'cafe';
  $('#mlChannel').value = 'whatsapp';
  $('#mlPipeline').value = 'Solicitado';
  updateManualMarket();
  manualModal.classList.add('open');
  setTimeout(() => $('#mlName').focus(), 0);
}

function closeManualLead() {
  manualModal.classList.remove('open');
  $('#manualError').textContent = '';
}

function updateManualMarket() {
  const market = $('#mlMarket').value;
  const config = (window.MARKETS || {})[market];
  if (!config) return;

  const relation = $('#mlRelation');
  relation.innerHTML = config.triage.options.map(option =>
    `<option value="${escAttr(option.value)}" data-access="${option.access ? 'true' : 'false'}">${esc(option.label)}</option>`
  ).join('');

  const questionMap = {};
  (config.qualification || []).forEach(question => { questionMap[question.id] = question.q; });
  $('#mlCanGetMeetingsLabel').textContent = questionMap.canGetMeetings || 'Capacidad de conseguir reuniones';
  $('#mlCanCofinanceLabel').textContent = questionMap.canCofinance || 'Capacidad de cofinanciar';
  $('#mlRegulatoryKnowledgeLabel').textContent = questionMap.regulatoryKnowledge || 'Conocimiento normativo';
  $('#mlSalesCapacityLabel').textContent = questionMap.salesCapacity || 'Capacidad comercial';

  $('#mlFinalLabel').textContent = config.finalAsk.q;
  $('#mlFinal').innerHTML = '<option value="">Sin respuesta todavía</option>' +
    config.finalAsk.options.map(option => `<option value="${escAttr(option[1])}">${esc(option[0])}</option>`).join('');
  $('#mlFinal').dataset.field = config.finalAsk.field;
  updateAccessHint();
}

function updateAccessHint() {
  const option = $('#mlRelation').selectedOptions[0];
  const hasAccess = option && option.dataset.access === 'true';
  $('#mlAccessHint').textContent = hasAccess
    ? 'Esta relación cuenta como acceso directo al mercado.'
    : 'Esta relación no cuenta como acceso directo; el lead quedará como referidor.';
  $('#mlAccessHint').classList.toggle('positive', hasAccess);
}

function selectedQualification(id) {
  return $(id).value || undefined;
}

function manualPayload() {
  const relationOption = $('#mlRelation').selectedOptions[0];
  const finalAsk = {};
  if ($('#mlFinal').value) finalAsk[$('#mlFinal').dataset.field] = $('#mlFinal').value;
  return {
    market: $('#mlMarket').value,
    contact: {
      name: $('#mlName').value.trim(),
      email: $('#mlEmail').value.trim(),
      whatsapp: $('#mlWhatsapp').value.trim(),
      company: $('#mlCompany').value.trim(),
      role: $('#mlRole').value.trim()
    },
    marketAccess: {
      relation: $('#mlRelation').value,
      hasAccess: !!relationOption && relationOption.dataset.access === 'true',
      canIntroduce: $('#mlCanIntroduce').checked,
      actorNamed: $('#mlActor').value.trim(),
      experienceYears: Number($('#mlYears').value || 0),
      proofFileUrl: $('#mlProof').value.trim()
    },
    qualification: {
      canGetMeetings: selectedQualification('#mlCanGetMeetings'),
      canCofinance: selectedQualification('#mlCanCofinance'),
      regulatoryKnowledge: selectedQualification('#mlRegulatoryKnowledge'),
      salesCapacity: selectedQualification('#mlSalesCapacity')
    },
    finalAsk,
    campaign: {
      variant: $('#mlVariant').value.trim(),
      utmSource: $('#mlUtmSource').value.trim(),
      utmCampaign: $('#mlUtmCampaign').value.trim()
    },
    source: { channel: $('#mlChannel').value },
    pipelineStatus: $('#mlPipeline').value,
    adminNotes: $('#mlNotes').value.trim()
  };
}

$('#mlMarket').onchange = updateManualMarket;
$('#mlRelation').onchange = updateAccessHint;
$('#manualClose').onclick = closeManualLead;
$('#manualCancel').onclick = closeManualLead;
manualModal.onclick = event => { if (event.target.id === 'leadModal') closeManualLead(); };

manualForm.onsubmit = async event => {
  event.preventDefault();
  $('#manualError').textContent = '';
  if (!manualForm.reportValidity()) return;
  if (!$('#mlEmail').value.trim() && !$('#mlWhatsapp').value.trim()) {
    $('#manualError').textContent = 'Indica al menos email o WhatsApp.';
    $('#mlWhatsapp').focus();
    return;
  }

  const submit = $('#manualSubmit');
  const previousText = submit.textContent;
  submit.disabled = true;
  submit.textContent = 'Guardando...';
  try {
    const created = await apiCreateManualLead(manualPayload());
    closeManualLead();
    await load();
    showNotice(`Lead creado correctamente · Tipo ${created.leadType} · Score ${created.score}`);
  } catch (error) {
    $('#manualError').textContent = error.message || 'No se pudo crear el lead.';
  } finally {
    submit.disabled = false;
    submit.textContent = previousText;
  }
};

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (manualModal.classList.contains('open')) closeManualLead();
  else if ($('#modal').classList.contains('open')) $('#modal').classList.remove('open');
});

function showNotice(message, isError = false) {
  const notice = $('#notice');
  notice.textContent = message;
  notice.classList.toggle('error', isError);
  notice.classList.add('show');
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => notice.classList.remove('show'), 4500);
}

function exportCSV() {
  const rows = filteredLeads();
  const head = ['nombre', 'email', 'whatsapp', 'empresa', 'cargo', 'mercado', 'tipo', 'score', 'etapa', 'estado_pipeline', 'rating', 'rating_comentario', 'notas', 'actor', 'puede_presentar', 'variante', 'origen_manual', 'canal', 'creado'];
  const lines = [head.join(',')];
  rows.forEach(lead => {
    const contact = lead.contact || {};
    const access = lead.marketAccess || {};
    const campaign = lead.campaign || {};
    const source = lead.source || {};
    const row = [
      contact.name, contact.email, contact.whatsapp, contact.company, contact.role,
      lead.market, lead.leadType, lead.score, lead.stageReached,
      lead.pipelineStatus || 'Solicitado', lead.rating || 0, lead.ratingComment, lead.adminNotes,
      access.actorNamed, access.canIntroduce ? 'sí' : 'no', campaign.variant,
      lead.manualEntry ? 'sí' : 'no', source.channel, lead.createdAt
    ];
    lines.push(row.map(value => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"').join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'leads.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function esc(value) {
  return String(value == null ? '' : value).replace(/[<>&"]/g, char => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;'
  })[char]);
}

function escAttr(value) {
  return esc(value).replace(/'/g, '&#39;');
}

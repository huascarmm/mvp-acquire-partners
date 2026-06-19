/* =============================================================================
 * funnel.js — Motor de embudo (un solo motor para los 4 mercados).
 * Lee ?m=mercado y UTMs, renderiza paso a paso (estilo typeform), guarda
 * progresivamente en el servidor y dispara los pixeles en las conversiones.
 * ===========================================================================*/
(function () {
  var qs = new URLSearchParams(location.search);
  var marketKey = qs.get("m") || qs.get("market");
  var M = (window.MARKETS || {})[marketKey];

  if (!M) {
    location.replace("index.html");
    return;
  }
  document.body.setAttribute("data-market", marketKey);

  var sessionId =
    (crypto.randomUUID && crypto.randomUUID()) ||
    Date.now() + "-" + Math.random().toString(36).slice(2);

  var campaign = {
    variant: qs.get("variant") || qs.get("v") || "",
    utmSource: qs.get("utm_source") || "",
    utmCampaign: qs.get("utm_campaign") || "",
  };

  function cookie(n) {
    var m = document.cookie.match("(^|;)\\s*" + n + "\\s*=\\s*([^;]+)");
    return m ? m.pop() : "";
  }
  // Lee _fbp/_fbc en el MOMENTO de la conversión (el script de Meta puede no
  // haberlas creado al cargar la página).
  function getMetaContext() {
    return { fbp: cookie("_fbp"), fbc: cookie("_fbc"), sourceUrl: location.href };
  }

  var state = {
    contact: {},
    marketAccess: {},
    qualification: {},
    finalAsk: {},
    hasAccess: null,
  };

  var app = document.getElementById("app");
  var bar = document.getElementById("bar");

  function saveLead(stage, patch, extra) {
    return fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        Object.assign(
          {
            sessionId: sessionId,
            market: marketKey,
            stageReached: stage,
            patch: patch,
          },
          extra || {},
        ),
      ),
    })
      .then(function (r) { return r.json(); })
      .catch(function () { return {}; });
  }
  function saveReferral(payload) {
    return fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return { ok: false };
      });
  }

  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstChild;
  }
  function setProgress(p) {
    bar.style.width = Math.max(4, Math.min(100, p)) + "%";
  }
  function render(node) {
    app.innerHTML = "";
    app.appendChild(node);
    window.scrollTo(0, 0);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[<>&"]/g, function (c) {
      return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c];
    });
  }
  function sealHTML() {
    return (
      '<span class="seal"><span class="dot"></span>origen verificable' +
      '<svg viewBox="0 0 24 24"><path class="chk" d="M5 13l4 4L19 7"/></svg></span>'
    );
  }
  function backBtn(fn) {
    var b = el('<button class="back">&larr; Atras</button>');
    b.onclick = fn;
    return b;
  }

  // Botones de Calendly + WhatsApp (sin LinkedIn). Se muestran al calificar.
  function ctaRowHTML() {
    var S = window.SITE || {};
    var cta = M.cta || {};
    var wa = String(cta.whatsapp || S.whatsapp || "").replace(/\D/g, "");
    var cal = cta.calendly || S.calendly || "";
    var msg = encodeURIComponent(
      String(cta.whatsappMsg || S.whatsappMsg || "Hola").replace("{market}", M.eyebrow || marketKey),
    );
    var html = "";
    if (cal)
      html +=
        '<a class="btn full" id="cal" href="' + esc(cal) +
        '" target="_blank" rel="noopener">Agendar reunion <span class="arrow">&rarr;</span></a>';
    if (wa)
      html +=
        '<a class="btn ghost full" id="wa" style="margin-top:.6rem" href="https://wa.me/' +
        wa + "?text=" + msg + '" target="_blank" rel="noopener">Escribir por WhatsApp</a>';
    return html;
  }
  function wireCtas(node) {
    var cal = node.querySelector("#cal");
    if (cal) cal.onclick = function () {
      if (window.SocioPixels) SocioPixels.schedule(marketKey);
      if (window.SocioAnalytics) SocioAnalytics.event("cta_schedule", { market: marketKey });
    };
    var wa = node.querySelector("#wa");
    if (wa) wa.onclick = function () {
      if (window.SocioPixels) SocioPixels.contact(marketKey);
      if (window.SocioAnalytics) SocioAnalytics.event("cta_whatsapp", { market: marketKey });
    };
  }

  // Elige el hero: 1) si la URL trae ?v= y existe, usa esa variante (match con
  // el anuncio); 2) si hay variantes, elige una AL AZAR; 3) si no hay, el hero base.
  function pickHero() {
    if (M.heroVariants) {
      var v = campaign.variant;
      if (v && M.heroVariants[v]) return M.heroVariants[v];
      var keys = Object.keys(M.heroVariants);
      if (keys.length) return M.heroVariants[keys[Math.floor(Math.random() * keys.length)]];
    }
    return M.hero;
  }

  function waHref() {
    var S = window.SITE || {};
    var cta = M.cta || {};
    var wa = String(cta.whatsapp || S.whatsapp || "").replace(/\D/g, "");
    if (!wa) return "";
    var msg = encodeURIComponent(
      String(cta.whatsappMsg || S.whatsappMsg || "Hola").replace("{market}", M.eyebrow || marketKey),
    );
    return "https://wa.me/" + wa + "?text=" + msg;
  }

  // Iconos SVG en línea (livianos, currentColor) para una vista escaneable.
  function icon(n, cls) {
    var p = {
      leaf: '<path d="M5 21c0-8 5-13 14-14 0 9-5 14-14 14z"/><path d="M5 21c2-6 5-9 9-11"/>',
      seedling: '<path d="M12 21v-7"/><path d="M12 14c-4 0-6-2-6-6 4 0 6 2 6 6z"/><path d="M12 12c0-4 2-6 6-6 0 4-2 6-6 6z"/>',
      jar: '<path d="M8 3h8"/><path d="M9 3v2a4 4 0 0 0-2 3v9a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3V8a4 4 0 0 0-2-3V3"/><path d="M12 10l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9 12.2l2-.3z"/>',
      doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 15l2 2 4-4"/>',
      people: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5.5"/><path d="M18 14a6 6 0 0 1 3 6"/>',
      check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/>',
      handshake: '<path d="M12 6l2-1.5a3 3 0 0 1 4 .5l3 3"/><path d="M12 6L9.5 4.3a3 3 0 0 0-3.8.4L3 7"/><path d="M3 7v5l4 4 2-2 2 2 2-2 2 2 3-3v-3"/>',
      shield: '<path d="M12 3l7 3v6c0 5-3 7-7 9-4-2-7-4-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
      dollar: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M14.5 9.3A2.4 2 0 0 0 12 8.2c-1.5 0-2.7.8-2.7 1.9 0 2.6 5.4 1.4 5.4 4 0 1.1-1.2 1.9-2.7 1.9a2.4 2 0 0 1-2.5-1.1"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      wa: '<path d="M3 21l1.7-4.2A8 8 0 1 1 8 19.3z"/><path d="M8.5 8.5c0 4 3 7 7 7 1.6 0 1.6-2.2 0-2.2-1 .8-3.2-1.4-2.3-2.4 1-1.6-1.1-1.6-2.2 0-.4.6-2.5.5-2.5-.4z"/>',
      lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
    }[n] || "";
    return (
      '<svg class="ico' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      p + "</svg>"
    );
  }

  function sectionHead(ic, title) {
    return '<div class="sec-head">' + icon(ic, "sec-ico") + "<h2>" + esc(title) + "</h2></div>";
  }

  /* 1.1) Badges + 1.2) WhatsApp sutil */
  function badgesHTML() {
    var S = window.SITE || {};
    var b = S.badges || [
      { icon: "dollar", label: "Sin inversión requerida" },
      { icon: "clock", label: "Encuesta de 2 minutos" },
    ];
    return (
      '<div class="badges">' +
      b.map(function (x) { return '<span class="badge">' + icon(x.icon) + esc(x.label) + "</span>"; }).join("") +
      "</div>"
    );
  }

  /* 2) Contexto */
  function contextHTML(L) {
    var c = L.context;
    if (!c) return "";
    var kw = (c.keywords || [])
      .map(function (k) { return '<span class="kw">' + icon(k.icon) + esc(k.label) + "</span>"; })
      .join("");
    return (
      '<section class="sec">' +
      sectionHead("leaf", c.title || "¿Qué está cambiando?") +
      '<p class="sec-body">' + esc(c.body) + "</p>" +
      (kw ? '<div class="kw-row">' + kw + "</div>" : "") +
      "</section>"
    );
  }

  /* 3) A quién buscamos */
  function seekingHTML(L) {
    var s = L.seeking;
    if (!s) return "";
    var items = (s.items || [])
      .map(function (it) { return "<li>" + icon("check", "ok") + "<span>" + esc(it) + "</span></li>"; })
      .join("");
    return (
      '<section class="sec">' +
      sectionHead("people", s.title || "¿A quién buscamos?") +
      '<ul class="seek-list">' + items + "</ul>" +
      (s.note ? '<p class="note-chip">' + icon("info") + esc(s.note) + "</p>" : "") +
      "</section>"
    );
  }

  /* 4) Alianza */
  function allianceHTML(L) {
    var a = L.alliance;
    if (!a) return "";
    var steps = (a.steps || [])
      .map(function (st, i) {
        var n = String(i + 1).padStart ? String(i + 1).padStart(2, "0") : "0" + (i + 1);
        return '<li><span class="step-n">' + n + "</span><span>" + esc(st) + "</span></li>";
      })
      .join("");
    return (
      '<section class="sec">' +
      sectionHead("handshake", a.title || "Una alianza con responsabilidades claras") +
      '<ol class="ally-steps">' + steps + "</ol>" +
      "</section>"
    );
  }

  /* 5) CTA destacado */
  function ctaCardHTML(L) {
    var c = L.cta || {};
    var label = c.label || "Evaluar si puedo aportar";
    return (
      '<section class="cta-card">' +
      icon("jar", "cta-card-ico") +
      '<div class="cta-card-body">' +
      "<h3>" + esc(c.title || "¿Puedes acercarnos a un actor del sector?") + "</h3>" +
      (c.sub ? "<p>" + esc(c.sub) + "</p>" : "") +
      '<button class="btn full" id="go2">' + esc(label) + ' <span class="arrow">&rarr;</span></button>' +
      (c.refNote ? '<p class="foot">' + esc(c.refNote) + "</p>" : "") +
      "</div></section>"
    );
  }

  /* 6) Footer: quiénes somos + aliados */
  function footerHTML() {
    var S = window.SITE || {};
    var about = S.about || (S.credibility && S.credibility.line) || "";
    var logos = ((S.credibility && S.credibility.logos) || [])
      .map(function (l) { return '<img src="' + esc(l.src) + '" alt="' + esc(l.alt || "") + '" loading="lazy">'; })
      .join("");
    if (!about && !logos) return "";
    return (
      '<footer class="lp-footer">' +
      (about ? sectionHead("shield", "¿Quiénes somos?") + '<p class="sec-body">' + esc(about) + "</p>" : "") +
      (logos ? '<p class="cred-logos-label">Experiencia y aliados</p><div class="logos">' + logos + "</div>" : "") +
      "</footer>"
    );
  }

  /* 0/1) LANDING (hero + secciones) */
  function stepHero() {
    setProgress(6);
    var hero = pickHero();
    var L = M.landing || {};
    var dis = M.disclaimer ? '<div class="disclaimer">' + esc(M.disclaimer) + "</div>" : "";
    var wa = waHref();
    var heroCta = (L.cta && L.cta.label) || "Evaluar si puedo aportar";
    var waSoft = wa
      ? '<a class="wa-soft" id="wahero" href="' + wa + '" target="_blank" rel="noopener">' +
        icon("wa") + "Consultar primero por WhatsApp <span class=\"arrow\">&rarr;</span></a>"
      : "";
    var node = el(
      '<div class="step lp">' +
        // 1) HERO
        '<section class="hero">' +
        '<p class="eyebrow">' + esc(M.eyebrow) + "</p>" +
        dis +
        '<h1 class="title">' + esc(hero.title) + "</h1>" +
        '<p class="sub">' + esc(hero.sub) + "</p>" +
        '<button class="btn full" id="go">' + esc(heroCta) + ' <span class="arrow">&rarr;</span></button>' +
        badgesHTML() +
        waSoft +
        '<p class="lock-line">' + icon("lock") + "Buscamos experiencia y acceso real al sector.</p>" +
        "</section>" +
        contextHTML(L) +
        seekingHTML(L) +
        allianceHTML(L) +
        ctaCardHTML(L) +
        footerHTML() +
        "</div>",
    );
    function start() {
      if (window.SocioPixels) SocioPixels.funnelStart();
      if (window.SocioAnalytics) SocioAnalytics.event("funnel_start", { market: marketKey });
      stepTriage();
    }
    node.querySelector("#go").onclick = start;
    var g2 = node.querySelector("#go2");
    if (g2) g2.onclick = start;
    var wh = node.querySelector("#wahero");
    if (wh) wh.onclick = function () {
      if (window.SocioPixels) SocioPixels.contact(marketKey);
      if (window.SocioAnalytics) SocioAnalytics.event("cta_whatsapp", { market: marketKey });
    };
    if (window.SocioPixels) SocioPixels.viewContent();
    render(node);
  }

  /* 1) TRIAGE */
  function stepTriage() {
    setProgress(18);
    var opts = M.triage.options
      .map(function (o, i) {
        return (
          '<button class="opt" data-i="' +
          i +
          '"><span>' +
          esc(o.label) +
          '</span><span class="tick"></span></button>'
        );
      })
      .join("");
    var node = el(
      '<div class="step"><p class="eyebrow">' +
        esc(M.eyebrow) +
        "</p>" +
        '<h2 class="q">' +
        esc(M.triage.question) +
        "</h2>" +
        '<div class="options">' +
        opts +
        "</div></div>",
    );
    node.querySelectorAll(".opt").forEach(function (b) {
      b.onclick = function () {
        var o = M.triage.options[+b.dataset.i];
        state.hasAccess = !!o.access;
        state.marketAccess.relation = o.value;
        state.marketAccess.hasAccess = state.hasAccess;
        if (state.hasAccess) stepContact();
        else stepContactB();
      };
    });
    node.appendChild(backBtn(stepHero));
    render(node);
  }

  /* 2A) CONTACTO */
  function stepContact() {
    setProgress(34);
    var node = el(
      '<div class="step"><h2 class="q">Como te contactamos?</h2>' +
        '<div class="field"><label>Nombre completo</label><input id="name" autocomplete="name"></div>' +
        '<div class="row2"><div class="field"><label>Email</label><input id="email" type="email" autocomplete="email"></div>' +
        '<div class="field"><label>WhatsApp</label><input id="wa" inputmode="tel" autocomplete="tel"></div></div>' +
        '<div class="row2"><div class="field"><label>Empresa / organizacion</label><input id="company"></div>' +
        '<div class="field"><label>Cargo</label><input id="role"></div></div>' +
        '<button class="btn full" id="next">Continuar <span class="arrow">&rarr;</span></button></div>',
    );
    node.querySelector("#next").onclick = function () {
      var name = node.querySelector("#name").value.trim();
      var email = node.querySelector("#email").value.trim();
      var wa = node.querySelector("#wa").value.trim();
      if (!name || (!email && !wa)) {
        alert("Indica tu nombre y al menos un medio de contacto.");
        return;
      }
      state.contact = {
        name: name,
        email: email,
        whatsapp: wa,
        company: node.querySelector("#company").value.trim(),
        role: node.querySelector("#role").value.trim(),
      };
      saveLead(2, {
        contact: state.contact,
        marketAccess: state.marketAccess,
        campaign: campaign,
      });
      stepProof();
    };
    node.appendChild(backBtn(stepTriage));
    render(node);
  }

  /* 2A.2) PRUEBA FEHACIENTE */
  function stepProof() {
    setProgress(48);
    var node = el(
      '<div class="step"><h2 class="q">' +
        esc(M.proof.intro) +
        "</h2>" +
        '<div class="field"><label>' +
        esc(M.proof.actorLabel) +
        "</label>" +
        '<textarea id="actor" placeholder="' +
        esc(M.proof.actorPlaceholder) +
        '"></textarea></div>' +
        '<div class="row2"><div class="field"><label>Años en el sector</label><input id="years" inputmode="numeric" placeholder="Ej. 5"></div>' +
        '<div class="field"><label>LinkedIn o enlace (opcional)</label><input id="link" placeholder="https://"></div></div>' +
        '<div class="field"><label>Podrias presentarnos a ese actor?</label>' +
        '<div class="options" id="intro">' +
        '<button class="opt" data-v="1"><span>Si, puedo presentarlo</span><span class="tick"></span></button>' +
        '<button class="opt" data-v="0"><span>Aun no, pero tengo el contacto</span><span class="tick"></span></button>' +
        "</div></div></div>",
    );
    node.querySelectorAll("#intro .opt").forEach(function (b) {
      b.onclick = function () {
        state.marketAccess.canIntroduce = b.dataset.v === "1";
        state.marketAccess.actorNamed = node
          .querySelector("#actor")
          .value.trim();
        state.marketAccess.experienceYears =
          parseInt(node.querySelector("#years").value, 10) || 0;
        state.marketAccess.proofText = node
          .querySelector("#actor")
          .value.trim();
        state.marketAccess.proofFileUrl = node
          .querySelector("#link")
          .value.trim();
        saveLead(2, { marketAccess: state.marketAccess });
        stepQualification(0);
      };
    });
    node.appendChild(backBtn(stepContact));
    render(node);
  }

  /* 3) CALIFICACION */
  function stepQualification(i) {
    var qns = M.qualification;
    if (i >= qns.length) {
      saveLead(3, { qualification: state.qualification });
      return stepFinal();
    }
    setProgress(48 + Math.round(((i + 1) / (qns.length + 1)) * 32));
    if (window.SocioAnalytics) SocioAnalytics.event("funnel_stage", { market: marketKey, stage: i + 1 });
    var item = qns[i];
    var opts = item.options
      .map(function (o) {
        return (
          '<button class="opt" data-v="' +
          o[1] +
          '"><span>' +
          esc(o[0]) +
          '</span><span class="tick"></span></button>'
        );
      })
      .join("");
    var node = el(
      '<div class="step"><p class="eyebrow">Calificacion ' +
        (i + 1) +
        "/" +
        qns.length +
        "</p>" +
        '<h2 class="q">' +
        esc(item.q) +
        '</h2><div class="options">' +
        opts +
        "</div></div>",
    );
    node.querySelectorAll(".opt").forEach(function (b) {
      b.onclick = function () {
        state.qualification[item.id] = b.dataset.v;
        stepQualification(i + 1);
      };
    });
    node.appendChild(
      backBtn(function () {
        i === 0 ? stepProof() : stepQualification(i - 1);
      }),
    );
    render(node);
  }

  /* 4) MAXIMO VALOR */
  function stepFinal() {
    setProgress(86);
    var fa = M.finalAsk;
    var opts = fa.options
      .map(function (o) {
        return (
          '<button class="opt" data-v="' +
          o[1] +
          '"><span>' +
          esc(o[0]) +
          '</span><span class="tick"></span></button>'
        );
      })
      .join("");
    var node = el(
      '<div class="step"><h2 class="q">' +
        esc(fa.q) +
        '</h2><div class="options">' +
        opts +
        "</div></div>",
    );
    node.querySelectorAll(".opt").forEach(function (b) {
      b.onclick = function () {
        state.finalAsk[fa.field] = b.dataset.v;
        saveLead(4, { finalAsk: state.finalAsk }, { meta: getMetaContext() }).then(function (resp) {
          resp = resp || {};
          var ev = resp.eventId;
          if (M.pixelLeadEvent && window.SocioPixels) {
            SocioPixels.lead(marketKey, ev);
            if (resp.qualified) {
              SocioPixels.leadQualified(marketKey, ev ? ev.replace(/:lead$/, ":qualified") : undefined);
            }
          }
          if (window.SocioAnalytics) {
            SocioAnalytics.event("generate_lead", { market: marketKey, lead_type: resp.leadType });
            if (resp.qualified) SocioAnalytics.event("qualified_lead", { market: marketKey });
          }
          stepThanksA(b.dataset.v, resp);
        });
      };
    });
    render(node);
  }

  /* 5A) GRACIAS (acceso) */
  function stepThanksA(choice, resp) {
    setProgress(100);
    resp = resp || {};
    var qualified = !!resp.qualified;
    var head = qualified ? "Tu perfil encaja." : "Registro verificado.";
    var msg = qualified
      ? "Demos el siguiente paso: agenda una reunion o escribenos por WhatsApp."
      : choice === "info"
        ? "Te enviaremos mas informacion y coordinamos una conversacion breve."
        : "Nos pondremos en contacto muy pronto para coordinar la reunion.";
    var ctas = qualified ? ctaRowHTML() : "";
    var node = el(
      '<div class="step"><div style="margin-bottom:1.2rem">' +
        sealHTML() +
        "</div>" +
        '<h1 class="title">' + esc(head) + "</h1>" +
        '<p class="sub">' + esc(msg) + "</p>" +
        ctas +
        '<p class="foot" style="margin-top:1.4rem">Tambien puedes referir a alguien valioso y recibir un cupo de curso AsoBlockchain.</p>' +
        '<button class="btn ghost full" id="ref">Referir a alguien y recibir un cupo</button></div>',
    );
    wireCtas(node);
    node.querySelector("#ref").onclick = function () {
      stepReferral(true);
    };
    render(node);
  }

  /* 2B) CONTACTO (sin acceso) */
  function stepContactB() {
    setProgress(40);
    saveLead(2, { marketAccess: state.marketAccess, campaign: campaign });
    var node = el(
      '<div class="step"><p class="eyebrow">Programa de referidos</p>' +
        '<h2 class="q">Conoces a alguien con acceso real a este mercado?</h2>' +
        '<p class="sub">Refierelo y te damos un cupo gratuito a un curso de AsoBlockchain Bolivia.</p>' +
        '<div class="field"><label>Tu nombre</label><input id="rname" autocomplete="name"></div>' +
        '<div class="row2"><div class="field"><label>Tu email</label><input id="remail" type="email"></div>' +
        '<div class="field"><label>Tu WhatsApp</label><input id="rwa" inputmode="tel"></div></div>' +
        '<button class="btn full" id="next">Continuar <span class="arrow">&rarr;</span></button></div>',
    );
    node.querySelector("#next").onclick = function () {
      var name = node.querySelector("#rname").value.trim();
      var email = node.querySelector("#remail").value.trim();
      var wa = node.querySelector("#rwa").value.trim();
      if (!name || (!email && !wa)) {
        alert("Indica tu nombre y un medio de contacto.");
        return;
      }
      state.contact = { name: name, email: email, whatsapp: wa };
      saveLead(2, { contact: state.contact });
      stepReferral(false);
    };
    node.appendChild(backBtn(stepTriage));
    render(node);
  }

  /* 2B.2 / referido */
  function stepReferral(fromAccessPath) {
    setProgress(80);
    var node = el(
      '<div class="step"><h2 class="q">A quien nos recomiendas?</h2>' +
        '<div class="field"><label>Nombre de la persona</label><input id="pname"></div>' +
        '<div class="field"><label>Como contactarla (email, WhatsApp o LinkedIn)</label><input id="pcontact"></div>' +
        '<div class="field"><label>Que relacion tiene con el mercado?</label><input id="prel" placeholder="Ej. gerente de una cooperativa"></div>' +
        '<button class="btn full" id="send">Enviar referido <span class="arrow">&rarr;</span></button>' +
        (fromAccessPath ? "" : "") +
        "</div>",
    );
    node.querySelector("#send").onclick = function () {
      var pname = node.querySelector("#pname").value.trim();
      if (!pname) {
        alert("Indica al menos el nombre de la persona.");
        return;
      }
      var payload = {
        market: marketKey,
        referrerLeadId: sessionId,
        referrerContact: state.contact,
        referred: {
          name: pname,
          contact: node.querySelector("#pcontact").value.trim(),
          relationship: node.querySelector("#prel").value.trim(),
        },
      };
      node.querySelector("#send").textContent = "Enviando...";
      saveReferral(payload).then(function (r) {
        if (window.SocioPixels) SocioPixels.referral(marketKey);
        if (window.SocioAnalytics) SocioAnalytics.event("referral", { market: marketKey });
        stepThanksB(r && r.couponCode);
      });
    };
    node.appendChild(
      backBtn(
        fromAccessPath
          ? function () {
              stepThanksA("x");
            }
          : stepContactB,
      ),
    );
    render(node);
  }

  /* 5B) GRACIAS (referido + cupon) */
  function stepThanksB(code) {
    setProgress(100);
    var couponBlock = code
      ? '<p class="muted">Tu cupo de curso:</p><div class="coupon">' +
        esc(code) +
        "</div>"
      : '<p class="sub">Gracias. Te contactaremos con tu cupo de curso.</p>';
    var node = el(
      '<div class="step"><div style="margin-bottom:1.2rem">' +
        sealHTML() +
        "</div>" +
        '<h1 class="title">Gracias por la recomendacion.</h1>' +
        couponBlock +
        '<button class="btn ghost full" id="more" style="margin-top:1rem">Referir a otra persona</button></div>',
    );
    node.querySelector("#more").onclick = function () {
      stepReferral(false);
    };
    render(node);
  }

  // Imagen de fondo opcional: si existe assets/img/bg-<mercado>.webp, se activa
  // sobre el degradado. Si no existe, queda el fondo CSS instantaneo.
  (function () {
    var bg = document.getElementById("bgimg");
    if (!bg) return;
    var src = "assets/img/bg-" + marketKey + ".webp";
    var im = new Image();
    im.onload = function () {
      bg.style.backgroundImage = "url(" + src + ")";
      bg.classList.add("is-loaded");
    };
    im.src = src;
  })();

  // Arranque + pixel PageView
  if (window.SocioPixels) SocioPixels.pageView();
  stepHero();
})();

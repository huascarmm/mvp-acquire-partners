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
  // Datos para deduplicar el evento navegador <-> Conversions API.
  var meta = { fbp: cookie("_fbp"), fbc: cookie("_fbc"), sourceUrl: location.href };

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

  function credibilityHTML() {
    var S = window.SITE || {};
    var c = S.credibility || {};
    var line = c.line || S.tagline || "";
    var pts = (c.points || [])
      .map(function (p) { return "<li>" + esc(p) + "</li>"; })
      .join("");
    var logos = (c.logos || [])
      .map(function (l) {
        return '<img src="' + esc(l.src) + '" alt="' + esc(l.alt || "") + '" loading="lazy">';
      })
      .join("");
    if (!line && !pts && !logos) return "";
    return (
      '<div class="cred">' +
      (line ? '<p class="cred-line">' + esc(line) + "</p>" : "") +
      (pts ? '<ul class="cred-pts">' + pts + "</ul>" : "") +
      (logos ? '<div class="logos">' + logos + "</div>" : "") +
      "</div>"
    );
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

  /* 0) HERO */
  function stepHero() {
    setProgress(6);
    var hero = (M.heroVariants && M.heroVariants[campaign.variant]) || M.hero;
    var dis = M.disclaimer
      ? '<div class="disclaimer">' + esc(M.disclaimer) + "</div>"
      : "";
    var node = el(
      '<div class="step">' +
        '<p class="eyebrow">' + esc(M.eyebrow) + "</p>" +
        dis +
        '<h1 class="title">' + esc(hero.title) + "</h1>" +
        '<p class="sub">' + esc(hero.sub) + "</p>" +
        '<button class="btn full" id="go">Soy un posible aliado <span class="arrow">&rarr;</span></button>' +
        '<p class="foot">Menos de 2 minutos. Buscamos acceso real al mercado, no inversion.</p>' +
        credibilityHTML() +
        "</div>",
    );
    node.querySelector("#go").onclick = function () {
      if (window.SocioPixels) SocioPixels.funnelStart();
      if (window.SocioAnalytics) SocioAnalytics.event("funnel_start", { market: marketKey });
      stepTriage();
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
        saveLead(4, { finalAsk: state.finalAsk }, { meta: meta }).then(function (resp) {
          resp = resp || {};
          var ev = resp.eventId;
          if (M.pixelLeadEvent && window.SocioPixels) {
            SocioPixels.lead(marketKey, ev);
            if (resp.qualified) SocioPixels.leadQualified(marketKey, ev ? ev + ":q" : undefined);
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

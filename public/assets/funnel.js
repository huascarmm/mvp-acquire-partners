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

  var state = {
    contact: {},
    marketAccess: {},
    qualification: {},
    finalAsk: {},
    hasAccess: null,
  };

  var app = document.getElementById("app");
  var bar = document.getElementById("bar");

  function saveLead(stage, patch) {
    return fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId,
        market: marketKey,
        stageReached: stage,
        patch: patch,
      }),
    }).catch(function () {});
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

  /* 0) HERO */
  function stepHero() {
    setProgress(6);
    var dis = M.disclaimer
      ? '<div class="disclaimer">' + esc(M.disclaimer) + "</div>"
      : "";
    var node = el(
      '<div class="step">' +
        '<p class="eyebrow">' +
        esc(M.eyebrow) +
        "</p>" +
        dis +
        '<h1 class="title">' +
        esc(M.hero.title) +
        "</h1>" +
        '<p class="sub">' +
        esc(M.hero.sub) +
        "</p>" +
        '<div style="margin:1.2rem 0 1.6rem">' +
        sealHTML() +
        "</div>" +
        '<button class="btn full" id="go">Soy un posible aliado <span class="arrow">&rarr;</span></button>' +
        '<p class="foot">Toma menos de 2 minutos. Buscamos acceso real al mercado, no inversion.</p>' +
        "</div>",
    );
    node.querySelector("#go").onclick = stepTriage;
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
        saveLead(4, { finalAsk: state.finalAsk });
        if (M.pixelLeadEvent && window.SocioPixels) SocioPixels.lead(marketKey);
        stepThanksA(b.dataset.v);
      };
    });
    render(node);
  }

  /* 5A) GRACIAS (acceso) */
  function stepThanksA(choice) {
    setProgress(100);
    var msg =
      choice === "info"
        ? "Te enviaremos mas informacion y coordinamos una conversacion breve."
        : "Nos pondremos en contacto muy pronto para coordinar la reunion.";
    var node = el(
      '<div class="step"><div style="margin-bottom:1.2rem">' +
        sealHTML() +
        "</div>" +
        '<h1 class="title">Registro verificado.</h1>' +
        '<p class="sub">' +
        esc(msg) +
        "</p>" +
        '<p class="foot">Tambien puedes referir a alguien valioso y recibir un cupo de curso AsoBlockchain.</p>' +
        '<button class="btn ghost full" id="ref">Referir a alguien y recibir un cupo</button></div>',
    );
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
        if (window.SocioPixels) SocioPixels.lead(marketKey);
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

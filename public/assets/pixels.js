/* =============================================================================
 * pixels.js — Píxeles de Meta (Facebook) y TikTok + eventos por calificación.
 *
 * ACTIVACIÓN POR MERCADO: en assets/markets.js cada mercado declara
 *   pixels: { facebook: 'PIXEL_DEL_PRODUCTO', tiktok: '' }
 * Fallback global opcional: window.PIXEL_CONFIG = { facebook:'', tiktok:'' }.
 *
 * EVENTOS (clave para optimizar hacia leads de ALTA calificación):
 *   pageView()            -> al cargar
 *   viewContent()         -> hero visto
 *   funnelStart()         -> empezó el embudo
 *   lead(market, evId)    -> completó el formulario (TODOS) = volumen
 *   leadQualified(m, evId)-> lead Tipo A/B (score alto) = evento a optimizar
 *   schedule(m)           -> hizo clic en "Agendar reunión" (Calendly)
 *   contact(m)            -> hizo clic en "WhatsApp"
 *   referral(m)           -> envió un referido
 *
 * El evId (eventID) lo entrega el servidor para deduplicar con el Conversions
 * API (mismo evento contado una sola vez).
 * ===========================================================================*/
(function () {
  var cfg = window.PIXEL_CONFIG || {};
  function clean(v) { return (v == null ? "" : String(v)).trim(); }

  function currentMarket() {
    try {
      var m = clean(new URLSearchParams(location.search || "").get("m"));
      if (m && window.MARKETS && window.MARKETS[m]) return m;
    } catch (_e) {}
    var bm = clean(document.body && document.body.getAttribute("data-market"));
    if (bm && window.MARKETS && window.MARKETS[bm]) return bm;
    return "";
  }

  var market = currentMarket();
  var mg = (cfg.markets && market && cfg.markets[market]) || {};
  var mm = (window.MARKETS && market && window.MARKETS[market] && window.MARKETS[market].pixels) || {};
  var fbId = clean(mg.facebook || mm.facebook || cfg.facebook);
  var ttId = clean(mg.tiktok || mm.tiktok || cfg.tiktok);

  if (fbId) {
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", fbId);
  }

  if (ttId) {
    !(function (w, d, t) {
      w.TiktokAnalyticsObject = t; var ttq = (w[t] = w[t] || []);
      ttq.methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
      ttq.setAndDefer = function (e, n) { e[n] = function () { e.push([n].concat([].slice.call(arguments, 0))); }; };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.load = function (e, n) {
        var o = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = o; ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
        ttq._o = ttq._o || {}; ttq._o[e] = n || {};
        var s = d.createElement("script"); s.async = !0; s.src = o + "?sdkid=" + e + "&lib=" + t;
        var a = d.getElementsByTagName("script")[0]; a.parentNode.insertBefore(s, a);
      };
      ttq.load(ttId); ttq.page();
    })(window, document, "ttq");
  }

  function fb(name, params, evId) {
    if (!window.fbq) return;
    var opts = evId ? { eventID: evId } : undefined;
    fbq("track", name, params || {}, opts);
  }

  window.SocioPixels = {
    pageView: function () { fb("PageView", { content_category: market }); },
    viewContent: function () { fb("ViewContent", { content_category: market }); },
    funnelStart: function () { fb("InitiateCheckout", { content_category: market }); if (window.ttq) ttq.track("ClickButton", { content_type: market }); },
    lead: function (m, evId, leadType) { fb("Lead", { content_category: m || market, lead_type: leadType || undefined }, evId); if (window.ttq) ttq.track("SubmitForm", { content_type: m || market }); },
    leadQualified: function (m, evId) { fb("LeadCalificado", { content_category: m || market }, evId); },
    leadA: function (m, evId) { fb("LeadA", { content_category: m || market }, evId); },
    schedule: function (m) { fb("Schedule", { content_category: m || market }); },
    contact: function (m) { fb("Contact", { content_category: m || market }); if (window.ttq) ttq.track("Contact", { content_type: m || market }); },
    referral: function (m) { fb("CompleteRegistration", { content_category: m || market, status: "referral" }); },
    debug: function () { return { market: market, facebook: !!fbId, tiktok: !!ttId }; },
  };
})();

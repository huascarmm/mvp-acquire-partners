/* =============================================================================
 * analytics.js — Google Analytics 4 (gtag) + API de eventos del embudo.
 * Se carga solo si window.SITE.ga4 tiene un Measurement ID (G-XXXX).
 * GA4 ya mide page_view, engagement, rebote y origen del tráfico de forma
 * automática; aquí añadimos eventos del embudo para construir el "funnel"
 * en Explorar y medir dónde caen los usuarios.
 * ===========================================================================*/
(function () {
  var ga = (window.SITE && window.SITE.ga4 || "").trim();

  if (ga) {
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ga);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    // send_page_view automático en la carga inicial
    window.gtag("config", ga, { anonymize_ip: true });
  }

  // API unificada: SocioAnalytics.event('funnel_stage', { market, stage })
  window.SocioAnalytics = {
    enabled: !!ga,
    event: function (name, params) {
      try { if (window.gtag) window.gtag("event", name, params || {}); } catch (_e) {}
    },
  };
})();

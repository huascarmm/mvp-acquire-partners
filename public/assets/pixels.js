/* =============================================================================
 * pixels.js — Píxeles de Facebook (Meta) y TikTok para publicidad pagada.
 *
 * ACTIVACIÓN POR PRODUCTO/MERCADO:
 *   En assets/markets.js, cada mercado puede declarar:
 *     pixels: { facebook: 'PIXEL_META_DEL_PRODUCTO', tiktok: 'PIXEL_TIKTOK_DEL_PRODUCTO' }
 *
 * FALLBACK GLOBAL OPCIONAL:
 *   En index.html/funnel.html puedes declarar:
 *     window.PIXEL_CONFIG = { facebook: '', tiktok: '', markets: { cafe: { facebook: '' } } };
 *
 * PRIORIDAD:
 *   1) window.PIXEL_CONFIG.markets[market]
 *   2) window.MARKETS[market].pixels
 *   3) window.PIXEL_CONFIG.facebook / tiktok global
 *
 * EVENTOS:
 *   SocioPixels.pageView()  -> al cargar el embudo
 *   SocioPixels.lead()      -> al calificar (final) o al referir = conversión
 * ===========================================================================*/
(function () {
  var cfg = window.PIXEL_CONFIG || {};

  function clean(v) { return (v == null ? '' : String(v)).trim(); }

  function currentMarket() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var m = clean(params.get('m'));
      if (m && window.MARKETS && window.MARKETS[m]) return m;
    } catch (_e) {}
    var bodyMarket = clean(document.body && document.body.getAttribute('data-market'));
    if (bodyMarket && window.MARKETS && window.MARKETS[bodyMarket]) return bodyMarket;
    return '';
  }

  var market = currentMarket();
  var marketFromGlobal = (cfg.markets && market && cfg.markets[market]) || {};
  var marketFromMarkets = (window.MARKETS && market && window.MARKETS[market] && window.MARKETS[market].pixels) || {};

  var fbId = clean(marketFromGlobal.facebook || marketFromMarkets.facebook || cfg.facebook);
  var ttId = clean(marketFromGlobal.tiktok || marketFromMarkets.tiktok || cfg.tiktok);

  // --- Meta / Facebook Pixel (carga sólo si hay ID) --------------------------
  if (fbId) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', fbId);
  }

  // --- TikTok Pixel (carga sólo si hay ID) -----------------------------------
  if (ttId) {
    !function (w, d, t) {
      w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || [];
      ttq.methods = ['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];
      ttq.setAndDefer = function (e, n) { e[n] = function () { e.push([n].concat([].slice.call(arguments, 0))); }; };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (e) { for (var n = ttq._i[e] || [], i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(n, ttq.methods[i]); return n; };
      ttq.load = function (e, n) {
        var o = 'https://analytics.tiktok.com/i18n/pixel/events.js';
        ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = o; ttq._t = ttq._t || {}; ttq._t[e] = +new Date;
        ttq._o = ttq._o || {}; ttq._o[e] = n || {};
        var s = d.createElement('script'); s.type = 'text/javascript'; s.async = !0; s.src = o + '?sdkid=' + e + '&lib=' + t;
        var a = d.getElementsByTagName('script')[0]; a.parentNode.insertBefore(s, a);
      };
      ttq.load(ttId); ttq.page();
    }(window, document, 'ttq');
  }

  // --- API unificada ---------------------------------------------------------
  window.SocioPixels = {
    pageView: function () {
      if (window.fbq) fbq('track', 'PageView', { content_category: market || '' });
      /* ttq.page ya disparó al cargar */
    },
    lead: function (leadMarket) {
      var m = leadMarket || market || '';
      if (window.fbq) fbq('track', 'Lead', { content_category: m });
      if (window.ttq) ttq.track('SubmitForm', { content_type: m });
    },
    debug: function () {
      return { market: market, facebookConfigured: !!fbId, tiktokConfigured: !!ttId };
    }
  };
})();

/* =============================================================================
 * site.js — Configuración global del sitio (pública).
 * Marca, contacto (WhatsApp/Calendly), credibilidad y medición (GA4).
 * NADA secreto aquí (el GA4 y el pixel son públicos por diseño).
 * El token del Conversions API va SOLO en variables de entorno del servidor.
 * ===========================================================================*/
window.SITE = {
  brand: "Blockchain Consultora",
  tagline:
    "Consultora blockchain · trazabilidad, compliance e identidad digital",

  // --- Contacto (reemplaza con tus datos reales) ---------------------------
  whatsapp: "59167014222", // solo dígitos, con código de país, sin + ni espacios
  whatsappMsg:
    "Hola, vengo del anuncio de {market} y tengo acceso al sector. Quiero conversar.",
  calendly: "https://calendly.com/blockchainconsultora/asesoria-blockchain",

  // --- Credibilidad (para que se lea como consultora seria) ----------------
  // points: textos cortos y verificables (no inventes certificaciones/clientes).
  // logos: opcional; deja [] hasta tener los reales en assets/img/logos/.
  credibility: {
    line: "Consultora blockchain · más de 7 años en desarrollo de software",
    points: [
      "Blockchain, trazabilidad e identidad digital",
      "Pilotos verificables, enfoque institucional",
      "Software a medida, hecho en Bolivia",
    ],
    logos: [
      {
        src: "assets/img/logos/asoblockchain-bolivia.webp",
        alt: "Asoblockchain Bolivia",
      },
      {
        src: "assets/img/logos/hospital-martin-dockweiler.webp",
        alt: "Hospital Martin Dockweiler",
      },
      {
        src: "assets/img/logos/tu-voto-decide.webp",
        alt: "Tu Voto Decide",
      },
    ],
  },

  // --- Medición (público) --------------------------------------------------
  ga4: "G-791XKSW1VN", // "G-XXXXXXXXXX"  (déjalo vacío y no se carga GA)
};

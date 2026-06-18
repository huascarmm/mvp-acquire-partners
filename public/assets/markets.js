/* =============================================================================
 * markets.js — Configuración de los 4 mercados (un solo motor de embudo)
 * Para agregar un 5º mercado: añade una entrada aquí. No se toca el motor.
 * Cada mercado define: copy del hero, acento visual, triage, prueba, preguntas
 * de calificación y la "pregunta de máximo valor".
 * ===========================================================================*/
window.MARKETS = {
  cafe: {
    key: "cafe",
    accent: "#C57B46", // umber cálido (café)
    eyebrow: "Café · EUDR",
    hero: {
      title:
        "Buscamos un socio estratégico para la trazabilidad EUDR del café boliviano.",
      sub: "No vendemos software de mapas. Co-creamos implementación verificable: campo, expediente y notarización. Buscamos a quien conozca el terreno.",
    },
    triage: {
      question: "¿Cómo te relacionas con el sector café?",
      options: [
        {
          label: "Trabajo en una cooperativa o exportadora",
          value: "cooperativa",
          access: true,
        },
        {
          label: "Soy comprador, trader o importador",
          value: "comprador",
          access: true,
        },
        {
          label: "Trabajo en cooperación / ONG / institución",
          value: "cooperacion",
          access: true,
        },
        {
          label: "Conozco a gente del sector, pero no trabajo en él",
          value: "conozco",
          access: false,
        },
        {
          label: "No tengo contacto directo con este mercado",
          value: "ninguno",
          access: false,
        },
      ],
    },
    proof: {
      intro: "Cuéntanos de tu acceso real al mercado.",
      actorLabel:
        "Nombra un actor concreto que podrías presentarnos (cooperativa, exportador o comprador)",
      actorPlaceholder:
        "Ej. Cooperativa de Caranavi, exportador, comprador europeo…",
    },
    qualification: [
      {
        id: "canGetMeetings",
        q: "¿Podrías conseguir una reunión con un decisor del sector?",
        options: [
          ["Sí, esta semana", "high"],
          ["Sí, con algo de tiempo", "mid"],
          ["Difícil, pero posible", "low"],
          ["No", "none"],
        ],
      },
      {
        id: "canCofinance",
        q: "¿Hay forma de cofinanciar un piloto (cooperativa, comprador o cooperación)?",
        options: [
          ["Sí, manejo o conozco el presupuesto", "high"],
          ["Probablemente, vía cooperación", "mid"],
          ["Tal vez", "low"],
          ["No lo veo", "none"],
        ],
      },
      {
        id: "regulatoryKnowledge",
        q: "¿Qué tanto conoces el EUDR y sus plazos?",
        options: [
          ["A fondo", "high"],
          ["Lo básico", "mid"],
          ["He oído de él", "low"],
          ["Nada", "none"],
        ],
      },
      {
        id: "salesCapacity",
        q: "¿Tu perfil es de abrir negocios y cerrar acuerdos?",
        options: [
          ["Sí, es lo que hago", "high"],
          ["En parte", "mid"],
          ["Más bien técnico", "low"],
          ["No", "none"],
        ],
      },
    ],
    finalAsk: {
      field: "willIntroduceDecisionMaker",
      q: "¿Aceptarías presentarnos a un decisor o agendar una reunión de co-creación?",
      options: [
        ["Sí, agéndame una reunión", "meeting"],
        ["Sí, puedo presentar a alguien", "intro"],
        ["Quiero más información primero", "info"],
      ],
    },
    pixels: { facebook: "1132300571584678", tiktok: "" }, // Pixel especifico del producto cafe
    pixelLeadEvent: true,
  },

  madera: {
    key: "madera",
    accent: "#5E7D52", // verde bosque
    eyebrow: "Madera · EUDR",
    hero: {
      title:
        "Buscamos un socio del sector forestal para un piloto de expediente EUDR verificable.",
      sub: "Origen legal y cero deforestación. Complementa tu CFO/FSC con el expediente que exige el importador europeo.",
    },
    triage: {
      question: "¿Cómo te relacionas con el sector forestal?",
      options: [
        {
          label: "Empresa forestal, aserradero o exportador",
          value: "empresa",
          access: true,
        },
        {
          label: "Consultor FSC / cadena de custodia",
          value: "consultor",
          access: true,
        },
        {
          label: "ABT / institución del sector",
          value: "institucion",
          access: true,
        },
        {
          label: "Conozco gente del sector, pero no trabajo en él",
          value: "conozco",
          access: false,
        },
        {
          label: "No tengo contacto directo con este mercado",
          value: "ninguno",
          access: false,
        },
      ],
    },
    proof: {
      intro: "Cuéntanos de tu acceso real al mercado.",
      actorLabel:
        "Nombra una empresa o actor forestal que podrías presentarnos",
      actorPlaceholder: "Ej. aserradero exportador, empresa con FSC/CFO…",
    },
    qualification: [
      {
        id: "canGetMeetings",
        q: "¿Podrías conseguir una reunión con una empresa exportadora?",
        options: [
          ["Sí, esta semana", "high"],
          ["Sí, con algo de tiempo", "mid"],
          ["Difícil, pero posible", "low"],
          ["No", "none"],
        ],
      },
      {
        id: "canCofinance",
        q: "¿La empresa tendría capacidad de pagar/cofinanciar un piloto?",
        options: [
          ["Sí, claramente", "high"],
          ["Probablemente", "mid"],
          ["Tal vez", "low"],
          ["No lo veo", "none"],
        ],
      },
      {
        id: "regulatoryKnowledge",
        q: "¿Qué tanto conoces el EUDR y la cadena de custodia?",
        options: [
          ["A fondo", "high"],
          ["Lo básico", "mid"],
          ["He oído de él", "low"],
          ["Nada", "none"],
        ],
      },
      {
        id: "salesCapacity",
        q: "¿Tu perfil es de abrir negocios y cerrar acuerdos?",
        options: [
          ["Sí, es lo que hago", "high"],
          ["En parte", "mid"],
          ["Más bien técnico", "low"],
          ["No", "none"],
        ],
      },
    ],
    finalAsk: {
      field: "willIntroduceDecisionMaker",
      q: "¿Nos presentarías a una empresa exportadora a la UE o agendamos una reunión técnica?",
      options: [
        ["Sí, agéndame una reunión", "meeting"],
        ["Sí, puedo presentar a una empresa", "intro"],
        ["Quiero más información primero", "info"],
      ],
    },
    pixels: { facebook: "1114909039466091", tiktok: "" }, // Pixel especifico del producto madera
    pixelLeadEvent: true,
  },

  oro_compliance: {
    key: "oro_compliance",
    accent: "#C9A227", // latón/oro sobrio (NO neón)
    eyebrow: "Oro · Compliance",
    hero: {
      title:
        "Buscamos un aliado del sector aurífero formal para validar un sistema de compliance y trazabilidad documental.",
      sub: "Sin tokenización ni compra de oro: expediente verificable, alineado a OCDE/LBMA, para comercializadoras formales.",
    },
    triage: {
      question: "¿Cómo te relacionas con el sector aurífero formal?",
      options: [
        {
          label: "Comercializadora o exportadora de oro formal",
          value: "comercializadora",
          access: true,
        },
        { label: "Abogado/a o especialista AML", value: "aml", access: true },
        {
          label: "Banca, SENARECOM, BCB o EPCORO",
          value: "institucional",
          access: true,
        },
        {
          label: "Conozco gente del sector, pero no trabajo en él",
          value: "conozco",
          access: false,
        },
        {
          label: "No tengo contacto directo con este mercado",
          value: "ninguno",
          access: false,
        },
      ],
    },
    proof: {
      intro: "Cuéntanos de tu acceso real al mercado.",
      actorLabel:
        "Nombra una comercializadora, estudio AML o actor que podrías presentarnos",
      actorPlaceholder: "Ej. comercializadora formal, estudio jurídico AML…",
    },
    qualification: [
      {
        id: "canGetMeetings",
        q: "¿Podrías conseguir una reunión con una comercializadora formal o estudio AML?",
        options: [
          ["Sí, esta semana", "high"],
          ["Sí, con algo de tiempo", "mid"],
          ["Difícil, pero posible", "low"],
          ["No", "none"],
        ],
      },
      {
        id: "canCofinance",
        q: "¿Ese actor tendría capacidad de pagar por compliance?",
        options: [
          ["Sí, claramente", "high"],
          ["Probablemente", "mid"],
          ["Tal vez", "low"],
          ["No lo veo", "none"],
        ],
      },
      {
        id: "regulatoryKnowledge",
        q: "¿Qué tanto conoces AML, OCDE y LBMA?",
        options: [
          ["A fondo", "high"],
          ["Lo básico", "mid"],
          ["He oído de ello", "low"],
          ["Nada", "none"],
        ],
      },
      {
        id: "salesCapacity",
        q: "¿Tu perfil es de abrir negocios y cerrar acuerdos?",
        options: [
          ["Sí, es lo que hago", "high"],
          ["En parte", "mid"],
          ["Más bien técnico", "low"],
          ["No", "none"],
        ],
      },
    ],
    finalAsk: {
      field: "willIntroduceDecisionMaker",
      q: "¿Nos presentarías a una comercializadora o estudio AML, o agendamos una reunión?",
      options: [
        ["Sí, agéndame una reunión", "meeting"],
        ["Sí, puedo presentar a alguien", "intro"],
        ["Quiero más información primero", "info"],
      ],
    },
    pixels: { facebook: "1522257669353901", tiktok: "" }, // Pixel especifico del producto oro_compliance
    pixelLeadEvent: true,
  },

  oro_tokenizado: {
    key: "oro_tokenizado",
    accent: "#4FA3A1", // teal institucional (señala investigación)
    eyebrow: "Investigación · Trazabilidad de origen",
    disclaimer: "Es una investigación / piloto, NO una oferta de inversión.",
    hero: {
      title:
        "Iniciativa de investigación: trazabilidad voluntaria de origen del oro con identidad digital.",
      sub: "Preformalización responsable. Convocamos a aliados regulatorios, institucionales, técnicos y académicos a una mesa de diálogo.",
    },
    triage: {
      question: "¿Cuál es tu perfil?",
      options: [
        {
          label: "Regulatorio / ASFI / política pública",
          value: "regulatorio",
          access: true,
        },
        {
          label: "AGETIC / identidad digital / gobtech",
          value: "identidad",
          access: true,
        },
        {
          label: "Minería responsable / academia / cooperación",
          value: "academia",
          access: true,
        },
        {
          label: "Tengo interés general en el tema",
          value: "interes",
          access: false,
        },
        {
          label: "No tengo relación con este ámbito",
          value: "ninguno",
          access: false,
        },
      ],
    },
    proof: {
      intro: "Cuéntanos de tu rol institucional.",
      actorLabel: "Institución y área de expertise",
      actorPlaceholder:
        "Ej. regulación financiera, identidad digital, minería responsable…",
    },
    qualification: [
      {
        id: "canGetMeetings",
        q: "¿Podrías convocar o conectar con actores institucionales?",
        options: [
          ["Sí, tengo esa capacidad", "high"],
          ["En parte", "mid"],
          ["Difícil", "low"],
          ["No", "none"],
        ],
      },
      {
        id: "canCofinance",
        q: "¿Tu institución podría aportar o canalizar recursos/cooperación?",
        options: [
          ["Sí", "high"],
          ["Posiblemente", "mid"],
          ["Tal vez", "low"],
          ["No lo veo", "none"],
        ],
      },
      {
        id: "regulatoryKnowledge",
        q: "¿Qué tanto conoces sandbox regulatorio e identidad digital?",
        options: [
          ["A fondo", "high"],
          ["Lo básico", "mid"],
          ["He oído de ello", "low"],
          ["Nada", "none"],
        ],
      },
      {
        id: "salesCapacity",
        q: "¿Qué tan relevante es tu rol para esta agenda?",
        options: [
          ["Muy relevante / decisor", "high"],
          ["Relevante", "mid"],
          ["Marginal", "low"],
          ["No aplica", "none"],
        ],
      },
    ],
    finalAsk: {
      field: "joinRoundtable",
      q: "¿Te sumarías a una mesa de diálogo institucional?",
      options: [
        ["Sí, cuéntenme cuándo", "meeting"],
        ["Sí, y puedo invitar a otros", "intro"],
        ["Quiero más información primero", "info"],
      ],
    },
    pixels: { facebook: "2474685053036364", tiktok: "" }, // Pixel especifico del producto oro_tokenizado
    pixelLeadEvent: true,
  },
};

window.MARKET_KEYS = Object.keys(window.MARKETS);

# Socio-Funnel — Captación de socios estratégicos (4 mercados, un motor)

Sistema para encontrar **socios con acceso real al mercado** mediante un embudo de validación,
con **panel admin**. Cuatro mercados (café, madera, oro compliance, investigación/oro tokenizado)
corren sobre **un solo motor configurable**. Optimizado para **carga casi inmediata** y publicidad pagada.

## Por qué carga casi al instante
- **Frontend estático sin build ni framework** (HTML + CSS + JS vanilla): nada que compilar, nada que hidratar.
- **Fondo CSS instantáneo** (degradado + textura topográfica); las imágenes son mejora opcional.
- **Tipografía del sistema** (sans + mono): cero latencia de fuentes web.
- **CSS crítico inline** + `preload` del CSS + scripts `defer`.
- **Píxeles diferidos** y que sólo cargan si pones sus IDs.
- Estáticos con **cache `immutable`** (CDN de Firebase Hosting recomendado).
- El tráfico de anuncios sólo golpea archivos estáticos; la API (Cloud Run) se llama únicamente al enviar.

## Estructura
```
public/            estático (desplegar en Firebase Hosting / CDN)
  index.html       selector de mercado
  funnel.html      motor del embudo (lee ?m=cafe|madera|oro_compliance|oro_tokenizado)
  admin.html       panel
  assets/
    markets.js     CONFIG de los 4 mercados (aquí se edita el copy / se agrega un 5º mercado)
    funnel.js      motor del embudo (no se toca para agregar mercados)
    styles.css     sistema visual
    pixels.js      Meta + TikTok
    admin.js       panel (Firebase Auth + lecturas vía API)
    img/           imágenes opcionales + README-IMAGENES.md (prompts)
server.js          API Node (firebase-admin) + sirve estáticos
lib/scoring.js     scoring 0-100 (SOLO servidor; oculto al cliente)
firestore.rules    deny-all al cliente (todo pasa por la API)
firebase.json      Hosting + rewrite /api -> Cloud Run
Dockerfile         para Cloud Run
.env.example        variables de entorno
```

## Variables de entorno (exportar en consola, sin archivo .env en producción)
```bash
export FIREBASE_PROJECT_ID=tu-proyecto-gcp
export ADMIN_EMAILS="tu-correo@dominio.com"      # correos del panel (coma-separados)
# export ALLOWED_ORIGIN=https://tu-dominio.web.app   # sólo si el front va en otro origen
# export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json  # SÓLO local
```

## Desarrollo local
```bash
npm install
export FIREBASE_PROJECT_ID=tu-proyecto-gcp
export ADMIN_EMAILS="tu-correo@dominio.com"
export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json   # llave de servicio para local
npm run dev      # http://localhost:8080  (sirve estáticos + API)
```
Abre `http://localhost:8080/funnel.html?m=cafe` para probar un embudo.

## Base de datos
Usa Firestore **`(default)`**. Colecciones: `leads` y `referrals` (se crean solas). Sube `firestore.rules`.

## Despliegue (resumen; el paso a paso detallado va en otra entrega)
- **API** → Cloud Run (contenedor del `Dockerfile`). En Cloud Run **no subes llave**: el service account
  del servicio necesita el rol `roles/datastore.user` y firebase-admin usa ADC.
- **Frontend** → Firebase Hosting (CDN). `firebase.json` ya reescribe `/api/**` a tu servicio Cloud Run
  (ajusta `serviceId`/`region`). Alternativa: servir todo desde Cloud Run con `server.js` (un solo servicio).
- **Admin** → crea el usuario en Firebase Auth (email/password) y pon su correo en `ADMIN_EMAILS`.
  Completa `window.FIREBASE_CONFIG` en `admin.html` (apiKey, authDomain, projectId).

## Píxeles de publicidad
El Pixel de Meta/Facebook y TikTok se configura por producto/mercado en `public/assets/markets.js`:
```js
pixels: { facebook: 'PIXEL_META_DEL_PRODUCTO', tiktok: 'PIXEL_TIKTOK_DEL_PRODUCTO' }
```
Mercados actuales: `cafe`, `madera`, `oro_compliance`, `oro_tokenizado`.

`assets/pixels.js` detecta el producto desde `funnel.html?m=<mercado>` y carga solo el pixel correspondiente. Si el ID queda vacío, no se carga nada. Eventos: `PageView` al cargar el embudo; `Lead` al calificar o referir.

## Imágenes de fondo
Opcionales. Mira `public/assets/img/README-IMAGENES.md`: trae los **prompts** y los nombres exactos
(`bg-cafe.webp`, etc.). Si colocas los archivos, se activan solos; si no, queda el fondo CSS.

## Agregar un mercado nuevo
Añade una entrada al objeto `MARKETS` en `assets/markets.js` y al set `MARKETS` de `server.js`. Nada más.

## Nota
El scoring se calcula en el servidor y **no se expone** al cliente. El embudo guarda progresivamente:
si alguien abandona a mitad, queda registrado en la etapa alcanzada y lo ves en el panel.

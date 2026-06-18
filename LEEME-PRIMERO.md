# LEEME PRIMERO

## Archivos "ocultos" (importante)
Varios archivos empiezan con punto (`.`) y por eso **no se ven en Finder/Explorador por defecto**, pero **sí están** en el proyecto:

- `.github/workflows/deploy.yml` → el pipeline CI/CD (deploy + tests).
- `.firebaserc`, `.dockerignore`, `.gitignore`, `.env.example`

Para verlos:
- **macOS Finder:** `Cmd + Shift + .`
- **VS Code / editor:** se ven siempre en el árbol de archivos.
- **Terminal:** `ls -a`

Verificá el workflow con: `cat .github/workflows/deploy.yml`

## Mapa del proyecto
```
server.js              API + sirve estáticos (Cloud Run)
lib/scoring.js         scoring 0-100 (solo servidor)
public/                frontend estático (Hosting)
  index.html funnel.html admin.html
  assets/  markets.js funnel.js styles.css pixels.js admin.js img/*.webp
firestore.rules        deny-all al cliente (todo pasa por la API)
firebase.json          Hosting + rewrite /api -> Cloud Run
Dockerfile             imagen para Cloud Run
scripts/optimize-images.js   optimizador WebP (dev)
tests/                 E2E Playwright + cleanup.js
.github/workflows/deploy.yml   CI/CD: push a main -> deploy + tests
DESPLIEGUE.md          paso a paso (APIs, service account, secrets, local)
```

## Empezar
1. Reemplazá `tu-proyecto-gcp` en `.firebaserc`, `firebase.json` y `public/admin.html`.
2. Seguí **`DESPLIEGUE.md`** (pasos 1–8) para crear la service account, secrets de GitHub y el usuario admin.
3. Para correr en local (incluye cómo crear `serviceAccount.json`): **`DESPLIEGUE.md`** sección 10.
4. Push a `main` → el pipeline despliega y verifica solo.

# Despliegue y CI/CD — paso a paso

Arquitectura: **API + estáticos en un solo contenedor (Cloud Run)** y **frontend servido por Firebase Hosting** (que reescribe `/api/**` a Cloud Run, según `firebase.json`). Firestore guarda `leads` y `referrals`.

Auth elegida (lo más simple y seguro razonable): **una Service Account de despliegue** con roles mínimos, su llave JSON guardada en un **secret de GitHub** (`GCP_SA_KEY`). Sin llaves en el repo, sin llaves en runtime (Cloud Run usa ADC).

---

## 0. Prerrequisitos (una vez, local)

```bash
# gcloud y firebase CLI instalados, y sesión iniciada
gcloud auth login
firebase login

export PROJECT_ID=tu-proyecto-gcp
export REGION=us-central1
export SERVICE=socio-funnel
gcloud config set project $PROJECT_ID
```

> Cambia `tu-proyecto-gcp` por el ID real en: `.firebaserc`, `firebase.json` (rewrite `serviceId`/`region`) y `public/admin.html` (`window.FIREBASE_CONFIG`).

---

## 1. Habilitar APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  firebasehosting.googleapis.com
```

## 2. Firestore (modo nativo) + repo de imágenes

```bash
# Crea la base (default) en modo nativo si aún no existe
gcloud firestore databases create --location=$REGION --type=firestore-native || true

# Artifact Registry para las imágenes Docker (el nombre debe ser = $SERVICE)
gcloud artifacts repositories create $SERVICE \
  --repository-format=docker --location=$REGION
```

## 3. Service Account de despliegue + roles mínimos

```bash
gcloud iam service-accounts create gh-deployer --display-name="GitHub Actions deployer"
export SA=gh-deployer@$PROJECT_ID.iam.gserviceaccount.com

for R in roles/run.admin \
         roles/artifactregistry.writer \
         roles/firebasehosting.admin \
         roles/datastore.user \
         roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA" --role="$R" -q
done

# Requerido por google-github-actions/auth@v3 al usar credentials_json:
gcloud iam service-accounts add-iam-policy-binding $SA \
  --member="serviceAccount:$SA" --role="roles/iam.serviceAccountTokenCreator" -q
```

## 4. Que la app (runtime de Cloud Run) lea/escriba Firestore vía ADC

```bash
export PNUM=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PNUM-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user" -q
```

## 5. Llave JSON de la SA

```bash
gcloud iam service-accounts keys create gh-key.json --iam-account=$SA
```

---

## 6. Configurar secrets en GitHub (con `gh` CLI)

```bash
# desde la carpeta del repo, con el remoto de GitHub ya configurado
gh secret set GCP_SA_KEY < gh-key.json
gh secret set GCP_PROJECT_ID --body "$PROJECT_ID"
gh secret set ADMIN_EMAILS  --body "tu-correo@dominio.com"

shred -u gh-key.json   # borra la llave local (o: rm gh-key.json)
```

Comprobar: `gh secret list` debe mostrar `GCP_SA_KEY`, `GCP_PROJECT_ID`, `ADMIN_EMAILS`.

---

## 7. Firebase: config web del panel + usuario admin

```bash
# Imprime apiKey/authDomain/projectId de TU proyecto. Pégalos en public/admin.html.
firebase apps:sdkconfig WEB --project $PROJECT_ID
```

Usuario del panel (email/password):
- Firebase Console → **Authentication** → Sign-in method → habilitar **Email/Password**.
- Authentication → **Users** → **Add user** (ese email debe coincidir con `ADMIN_EMAILS`).

## 8. Reglas de Firestore (una vez, manual)

El cliente nunca toca Firestore directo (`firestore.rules` = deny-all). Súbelas una vez:

```bash
firebase deploy --only firestore:rules --project $PROJECT_ID
```

---

## 9. Disparar el pipeline

Solo haz push a `main`:

```bash
git add -A && git commit -m "deploy" && git push origin main
```

El workflow `.github/workflows/deploy.yml` hace, en orden:

1. **deploy-candidate** → build de la imagen, push a Artifact Registry y deploy de una revisión **CANDIDATA en Cloud Run con `--no-traffic`** (no recibe usuarios). Expone una URL con tag (`cand-xxxxxxxx---...run.app`).
2. **e2e** → instala Chromium y corre los tests Playwright **contra esa URL candidata** (health, estáticos, API lead/referral, recorrido completo del embudo). Si algo falla, **el pipeline se detiene y la candidata nunca recibe tráfico**.
3. **promote** (solo si E2E pasó) → enruta el 100% del tráfico a la nueva revisión, despliega el **frontend en Hosting**, hace un smoke `/health` en vivo y **borra los datos de prueba** (`leads`/`referrals` con prefijo `e2e-`) de Firestore.

Verás el reporte de Playwright como artifact del run en GitHub.

---

## 10. Desarrollo local + `serviceAccount.json`

En local, firebase-admin (en `server.js`) necesita credenciales para hablar con Firestore. Se proveen con una llave de service account apuntada por `GOOGLE_APPLICATION_CREDENTIALS`. Puedes **reutilizar la llave del deploy** o crear una dedicada para local con permiso mínimo de Firestore:

```bash
# Opcion A (rapida): reutiliza la del deploy
gcloud iam service-accounts keys create serviceAccount.json --iam-account=$SA

# Opcion B (recomendada): una SA solo-local con datastore.user
gcloud iam service-accounts create local-dev --display-name="Local dev"
export LSA=local-dev@$PROJECT_ID.iam.gserviceaccount.com
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$LSA" --role="roles/datastore.user" -q
gcloud iam service-accounts keys create serviceAccount.json --iam-account=$LSA
```

`serviceAccount.json` queda en la raiz del proyecto y **esta en `.gitignore`/`.dockerignore`** (no se sube ni al repo ni a la imagen). Luego:

```bash
npm install
export FIREBASE_PROJECT_ID=$PROJECT_ID
export ADMIN_EMAILS="tu-correo@dominio.com"
export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json
npm run dev        # http://localhost:8080

# en otra terminal, tests E2E contra el server local:
E2E_BASE_URL=http://localhost:8080 npm run test:e2e
# (la primera vez: npx playwright install chromium)
```

Abre `http://localhost:8080/funnel.html?m=cafe` para probar el embudo, y `/admin.html` para el panel.

Optimizar imágenes (si reemplazas PNG): `npm run optimize:images` (usa `sharp`, ya en devDependencies).

---

## Notas de seguridad

- La llave JSON solo vive en el secret `GCP_SA_KEY`; nunca se commitea (`.gitignore`/`.dockerignore` excluyen `serviceAccount.json` y `node_modules`).
- El `apiKey` web de `admin.html` **no es secreto** (es público por diseño en Firebase); el acceso real al panel lo controla Firebase Auth + la allowlist `ADMIN_EMAILS` validada en el servidor.
- Si rotas la llave: `gcloud iam service-accounts keys create` + `gh secret set GCP_SA_KEY` de nuevo, y borra la vieja con `gcloud iam service-accounts keys delete`.

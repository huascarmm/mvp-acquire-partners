# Imagenes del sistema — prompts y especificaciones

El sistema funciona **sin imágenes** (fondo CSS elegante e instantáneo). Las imágenes son una
**mejora opcional**: si colocas los archivos con el nombre exacto en esta carpeta, se cargan solas.

## Nombres de archivo que el sistema busca (déjalos exactos)
- `bg-cafe.webp` — fondo del embudo de café
- `bg-madera.webp` — fondo del embudo de madera
- `bg-oro_compliance.webp` — fondo del embudo de oro compliance
- `bg-oro_tokenizado.webp` — fondo del embudo de investigación/oro tokenizado
- `og-default.webp` — imagen de previsualización para enlaces en anuncios (1200×630)
- `favicon.svg` — ya incluido

## Reglas de optimización (clave para "carga casi inmediata")
- Formato **WebP**, calidad 70–78.
- Fondos: **1920×1080**, peso objetivo **< 150 KB** cada uno (recórtalo en https://squoosh.app).
- OG: **1200×630**, < 200 KB.
- Sin texto incrustado (el texto lo pone la web). Composición con espacio negativo a la izquierda
  (ahí va el copy). Tono sobrio, institucional, NO "cripto".
- El sistema las muestra al ~18% de opacidad sobre el degradado, así que elige imágenes con
  **buen contraste tonal pero sin saturación alta**.

---

## Prompts (para Midjourney / DALL·E / Firefly / Ideogram)

> Sugerencia de estilo común para todas: *"cinematic, muted, editorial, fine grain, soft directional
> light, shallow depth of field, no text, no logos, negative space on the left third, deep teal-slate
> color grade (#0E1C1B base)"*.

### bg-cafe.webp — Café EUDR
```
Close, cinematic photograph of green coffee parcels on a misty Yungas mountainside at dawn,
terraced coffee plants, soft fog, warm umber light breaking through, deep teal-slate shadows,
shallow depth of field, fine film grain, editorial and sober, abundant negative space on the
left third, muted color grade, no people, no text, no logos. 1920x1080.
```

### bg-madera.webp — Madera EUDR
```
Cinematic photograph of stacked tropical hardwood logs in a clean certified sawmill yard at
golden hour, each log cross-section subtly visible, forest-green and warm wood tones over a
deep teal-slate grade, soft directional light, fine grain, editorial, sober, negative space on
the left third, no people, no text, no logos. 1920x1080.
```

### bg-oro_compliance.webp — Oro compliance
```
Elegant low-key still life suggesting documentation and provenance: a refined dark desk with a
single subtle brass-toned gold bar slightly out of focus behind ordered paper documents and a
seal, restrained brass accent (not shiny crypto gold), deep teal-slate background, soft light,
fine grain, corporate-legal mood, negative space on the left third, no text, no logos. 1920x1080.
```

### bg-oro_tokenizado.webp — Investigación / sandbox
```
Abstract institutional image of a quiet roundtable / governance setting blended with faint
topographic contour lines and a subtle digital-identity motif (soft network of points), cool
institutional teal grade over deep slate, calm and credible, research mood, soft light, fine
grain, negative space on the left third, no text, no logos, no coins, no crypto symbols. 1920x1080.
```

### og-default.webp — previsualización social (anuncios)
```
Minimal editorial banner, deep teal-slate background (#0E1C1B), a single small glowing verification
seal/check motif on the right, large empty space on the left for overlaid title, subtle topographic
contour texture, sober and premium, no text baked in. 1200x630.
```

### Favicon / logo (opcional, ya hay un favicon.svg)
```
Minimal flat icon: a circular verification seal with a check mark inside, single teal accent on a
deep slate rounded square, flat, geometric, no gradient, no text. SVG, 32x32 safe.
```

---

## Cómo activar
1. Genera las imágenes con los prompts de arriba.
2. Optimízalas a WebP (Squoosh) respetando el peso objetivo.
3. Renómbralas con el nombre exacto de la lista y déjalas en esta carpeta (`public/assets/img/`).
4. Listo: el embudo las detecta y las usa automáticamente; si falta alguna, se queda el fondo CSS.

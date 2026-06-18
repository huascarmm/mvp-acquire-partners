#!/usr/bin/env node
/*
 * Convierte las imágenes PNG del embudo a WebP optimizado.
 * Entrada esperada: public/assets/img/<nombre>.png
 * Salida:           public/assets/img/<nombre>.webp
 *
 * Uso:
 *   npm run optimize:images
 *   npm run optimize:images -- --dir public/assets/img --delete-png
 */

const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');

const TARGETS = [
  { name: 'bg-cafe', width: 1920, height: 1080, maxKB: 150, type: 'fondo' },
  { name: 'bg-madera', width: 1920, height: 1080, maxKB: 150, type: 'fondo' },
  { name: 'bg-oro_compliance', width: 1920, height: 1080, maxKB: 150, type: 'fondo' },
  { name: 'bg-oro_tokenizado', width: 1920, height: 1080, maxKB: 150, type: 'fondo' },
  { name: 'og-default', width: 1200, height: 630, maxKB: 200, type: 'og' },
];

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const imgDir = path.resolve(ROOT, getArg('--dir', 'public/assets/img'));
const deletePng = args.includes('--delete-png');
const dryRun = args.includes('--dry-run');

const QUALITY_RECOMMENDED_MIN = 70;
const QUALITY_MAX = 78;
const QUALITY_FLOOR = 38; // Prioriza cumplir peso objetivo si 70-78 no alcanza.

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function renderWebpBuffer(inputPath, target, quality) {
  return sharp(inputPath)
    .rotate()
    .resize(target.width, target.height, {
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: false,
    })
    .webp({
      quality,
      effort: 6,
      smartSubsample: true,
    })
    .toBuffer();
}

async function optimizeOne(target) {
  const inputPath = path.join(imgDir, `${target.name}.png`);
  const outputPath = path.join(imgDir, `${target.name}.webp`);
  const maxBytes = target.maxKB * 1024;

  if (!(await exists(inputPath))) {
    return {
      name: target.name,
      status: 'missing',
      message: `No existe ${path.relative(ROOT, inputPath)}`,
    };
  }

  const inputStat = await fs.stat(inputPath);
  let best = null;

  // Primero intenta dentro del rango recomendado del README: calidad 70-78.
  for (let quality = QUALITY_MAX; quality >= QUALITY_RECOMMENDED_MIN; quality -= 2) {
    const buffer = await renderWebpBuffer(inputPath, target, quality);
    if (buffer.length <= maxBytes) {
      best = { quality, buffer, withinRecommended: true };
      break;
    }
  }

  // Si no entra, baja calidad gradualmente para cumplir el peso objetivo.
  if (!best) {
    for (let quality = QUALITY_RECOMMENDED_MIN - 2; quality >= QUALITY_FLOOR; quality -= 3) {
      const buffer = await renderWebpBuffer(inputPath, target, quality);
      if (buffer.length <= maxBytes) {
        best = { quality, buffer, withinRecommended: false };
        break;
      }
      // Guarda el último intento por si ni siquiera el piso cumple.
      best = { quality, buffer, withinRecommended: false, overTarget: true };
    }
  }

  if (!dryRun) {
    await fs.writeFile(outputPath, best.buffer);
    if (deletePng) await fs.rm(inputPath);
  }

  const outputBytes = best.buffer.length;
  const ok = outputBytes <= maxBytes;
  const warning = ok
    ? best.withinRecommended
      ? ''
      : ' — OK peso, pero debajo de calidad 70; revisar visualmente.'
    : ' — NO llegó al peso objetivo; revisar/cropear manualmente.';

  return {
    name: target.name,
    status: ok ? 'ok' : 'over',
    input: kb(inputStat.size),
    output: kb(outputBytes),
    target: `< ${target.maxKB} KB`,
    quality: best.quality,
    dimensions: `${target.width}x${target.height}`,
    message: `${dryRun ? '[dry-run] ' : ''}${target.name}.png → ${target.name}.webp | ${kb(inputStat.size)} → ${kb(outputBytes)} | q=${best.quality} | ${target.width}x${target.height} | objetivo ${target.maxKB} KB${warning}`,
  };
}

async function main() {
  console.log(`Optimizando imágenes en: ${path.relative(ROOT, imgDir)}`);
  console.log(`Modo: ${dryRun ? 'simulación' : 'escritura'}${deletePng ? ' + borrar PNG origen' : ''}\n`);

  const results = [];
  for (const target of TARGETS) {
    results.push(await optimizeOne(target));
  }

  for (const result of results) {
    if (result.status === 'missing') console.warn(`⚠ ${result.message}`);
    else if (result.status === 'over') console.warn(`⚠ ${result.message}`);
    else console.log(`✓ ${result.message}`);
  }

  const missing = results.filter((r) => r.status === 'missing').length;
  const over = results.filter((r) => r.status === 'over').length;

  if (missing || over) {
    console.log('\nResumen:');
    if (missing) console.log(`- ${missing} PNG fuente no encontrados.`);
    if (over) console.log(`- ${over} WebP quedaron por encima del peso objetivo.`);
    process.exitCode = over ? 1 : 0;
  } else {
    console.log('\nListo: todas las imágenes encontradas quedaron dentro del peso objetivo.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

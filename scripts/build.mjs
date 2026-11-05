// Generador estático: consulta la API del OIME UNA vez por publicación y
// produce HTML listo para servir desde un CDN. El visitante nunca espera a la
// API de la Alcaldía, que suele ser lenta.
import { mkdir, writeFile, readFile, readdir, cp, rm, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchRawFeatures, readSnapshot, normalizeAll, defaultOptions } from '../src/oime.mjs';
import { computeStats } from '../src/stats.mjs';
import { toCompact, COMPACT_FIELDS } from '../public/assets/shared.js';
import * as pages from '../src/pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SNAPSHOT = process.env.OIME_SNAPSHOT_PATH || join(ROOT, 'data', 'snapshot.json');

const exists = (p) => access(p).then(() => true, () => false);

function siteUrl() {
  const raw =
    process.env.SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    process.env.URL || // Netlify
    process.env.CF_PAGES_URL || // Cloudflare Pages
    'http://localhost:4321';
  return raw.replace(/\/$/, '') + '/';
}

async function getFeatures() {
  if (process.env.OIME_OFFLINE !== '1') {
    try {
      console.log('→ Consultando la API del OIME…');
      const t0 = Date.now();
      const features = await fetchRawFeatures(defaultOptions());
      if (!features.length) throw new Error('la API respondió sin registros');
      console.log(`✓ ${features.length} registros en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      return { features, fromSnapshot: false };
    } catch (err) {
      console.warn(`⚠ La API no respondió: ${err.message}`);
    }
  }
  if (await exists(SNAPSHOT)) {
    console.log(`→ Usando la copia de respaldo ${SNAPSHOT}`);
    return { features: await readSnapshot(SNAPSHOT), fromSnapshot: true };
  }
  // Fallar el build es preferible a publicar un sitio vacío: el hosting
  // mantiene en línea la última versión buena.
  throw new Error('Sin datos: la API falló y no hay copia de respaldo (npm run snapshot).');
}

const minifyCss = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();

async function out(path, content) {
  const file = join(DIST, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

function similares(o, ofertas) {
  return ofertas
    .filter((x) => x.id !== o.id && x.operacion === o.operacion && (o.barrio ? x.barrio === o.barrio : x.comuna === o.comuna))
    .sort((a, b) => Math.abs(a.precio - o.precio) - Math.abs(b.precio - o.precio))
    .slice(0, 4);
}

async function main() {
  const t0 = Date.now();
  const { features, fromSnapshot } = await getFeatures();
  const ofertas = normalizeAll(features);
  if (!ofertas.length) throw new Error('Ningún registro válido tras normalizar.');
  const stats = computeStats(ofertas);
  console.log(`✓ ${ofertas.length} ofertas válidas (${stats.venta} venta, ${stats.arriendo} arriendo), ${stats.comunas.length} comunas`);

  const ctx = {
    siteUrl: siteUrl(),
    builtAt: new Date().toISOString().slice(0, 10),
    version: Date.now().toString(36),
    css: minifyCss(await readFile(join(ROOT, 'public/assets/styles.css'), 'utf8')),
    pageSize: 24,
    fromSnapshot,
  };

  await rm(DIST, { recursive: true, force: true });
  await cp(join(ROOT, 'public'), DIST, { recursive: true });
  // Los assets se sirven con caché "immutable": versionamos también los
  // imports internos para que cada publicación invalide la caché.
  for (const f of await readdir(join(DIST, 'assets'))) {
    if (!f.endsWith('.js')) continue;
    const p = join(DIST, 'assets', f);
    const src = await readFile(p, 'utf8');
    await writeFile(p, src.replace(/from '\.\/([\w-]+)\.js'/g, `from './$1.js?v=${ctx.version}'`));
  }

  // Índice compacto para filtros y mapa (arreglos en vez de objetos: ~45 % menos peso).
  await out('data/ofertas.json', JSON.stringify({ fields: COMPACT_FIELDS, builtAt: ctx.builtAt, rows: ofertas.map(toCompact) }));

  await out('index.html', pages.homePage(ctx, ofertas, stats));
  await out('mapa/index.html', pages.mapPage(ctx, stats));
  await out('comunas/index.html', pages.comunasPage(ctx, stats));
  await out('404.html', pages.notFoundPage(ctx));

  const urls = ['/', '/mapa/', '/comunas/'];
  for (const c of stats.comunas) {
    const list = ofertas.filter((o) => o.comuna === c.nombre);
    await out(`comuna/${c.slug}/index.html`, pages.comunaPage(ctx, c, list));
    urls.push(`/comuna/${c.slug}/`);
  }
  for (const o of ofertas) {
    await out(`oferta/${o.id}/index.html`, pages.detailPage(ctx, o, stats, similares(o, ofertas)));
    urls.push(`/oferta/${o.id}/`);
  }

  await out(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `<url><loc>${new URL(u, ctx.siteUrl).href}</loc><lastmod>${ctx.builtAt}</lastmod></url>`)
      .join('\n')}\n</urlset>\n`,
  );
  await out('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap.xml', ctx.siteUrl).href}\n`);

  console.log(`✓ ${urls.length} páginas generadas en ${((Date.now() - t0) / 1000).toFixed(1)} s → dist/`);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});


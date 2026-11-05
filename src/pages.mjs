// Plantillas HTML. Cada página sale completa del build: el contenido principal
// es visible sin esperar JavaScript ni la API (clave para LCP y SEO).

import { cardHTML, esc, precioCorto, precioLargo, entero, titulo } from '../public/assets/shared.js';
import { compareToComuna, slugify } from './stats.mjs';

const SITE_NAME = 'Vitrina Inmobiliaria Medellín';
const SOURCE_URL =
  'https://www.medellin.gov.co/servidormapas/rest/services/vivienda_ciudad_terri/VM_Oferta_Comercial_Oime/MapServer/1';

const jsonLd = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

const fecha = (iso) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export function layout(ctx, { title, description, path, body, head = '', scripts = '', nav = '' }) {
  const url = new URL(path, ctx.siteUrl).href;
  const fullTitle = path === '/' ? title : `${title} | ${SITE_NAME}`;
  return `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#f6f1e8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141a17" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_CO">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="modulepreload" href="/assets/shared.js?v=${ctx.version}">
<style>${ctx.css}</style>
${head}
</head>
<body>
<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/"><svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#a8492a"/><path d="M8 24V14l8-6 8 6v10h-5v-6h-6v6z" fill="#fffdf8"/></svg>Vitrina <b>MDE</b></a>
    <nav class="nav" aria-label="Principal">
      <a href="/"${nav === 'home' ? ' aria-current="page"' : ''}>Ofertas</a>
      <a href="/mapa/"${nav === 'mapa' ? ' aria-current="page"' : ''}>Mapa</a>
      <a href="/comunas/"${nav === 'comunas' ? ' aria-current="page"' : ''}>Comunas</a>
    </nav>
  </div>
</header>
<main id="contenido">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p>Datos: <a href="${SOURCE_URL}" rel="noopener">Observatorio Inmobiliario de Medellín (OIME) · Alcaldía de Medellín</a>, capa «Investigaciones Internet».</p>
    <p>Datos consultados el ${fecha(ctx.builtAt)}${ctx.fromSnapshot ? ' (copia de respaldo: la API no respondió durante la última publicación)' : ''}. Los precios son de oferta publicada, no de cierre.</p>
  </div>
</footer>
${scripts}
</body>
</html>`;
}

// ---------- Inicio: listado + filtros ----------

export function homePage(ctx, ofertas, stats) {
  const initial = ofertas.slice(0, ctx.pageSize);
  const tipos = stats.tipos.map((t) => t.nombre);
  const comunas = [...stats.comunas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const opt = (v, label = v) => `<option value="${esc(v)}">${esc(label)}</option>`;

  const body = `
<section class="hero wrap" aria-labelledby="h1">
  <p class="eyebrow">Datos abiertos · Alcaldía de Medellín</p>
  <h1 id="h1">¿Cuánto cuesta vivir en cada barrio de Medellín?</h1>
  <p class="lede">${entero(stats.total)} ofertas de vivienda en venta y arriendo recopiladas por el Observatorio Inmobiliario de la ciudad. Filtra por comuna, estrato, precio y tamaño, y compara cada inmueble con lo que se pide en su zona.</p>
  <ul class="kpis">
    <li><strong>${entero(stats.venta)}</strong><span>en venta</span></li>
    <li><strong>${entero(stats.arriendo)}</strong><span>en arriendo</span></li>
    <li><strong>${precioCorto(stats.m2Venta)}</strong><span>mediana por m² (venta)</span></li>
    <li><strong>${precioCorto(stats.medianaArriendo)}</strong><span>arriendo mediano al mes</span></li>
  </ul>
</section>

<section class="wrap" aria-labelledby="h-ofertas">
  <h2 id="h-ofertas" class="sr-only">Ofertas</h2>
  <form class="filters" id="filtros" role="search" aria-label="Filtrar ofertas">
    <div class="filters-grid">
      <div class="field full">
        <label for="q">Barrio o comuna</label>
        <input type="search" id="q" name="q" placeholder="Ej: Laureles, Belén, El Poblado" autocomplete="off" enterkeyhint="search">
      </div>
      <fieldset class="field full">
        <legend>Operación</legend>
        <div class="seg">
          <label><input type="radio" name="op" value="" checked>Todas</label>
          <label><input type="radio" name="op" value="Venta">Venta</label>
          <label><input type="radio" name="op" value="Arriendo">Arriendo</label>
        </div>
      </fieldset>
      <button type="button" class="btn more-filters full" id="mas-filtros" aria-expanded="false" aria-controls="extra">Más filtros</button>
      <div class="extra" id="extra">
      <div class="field">
        <label for="tipo">Tipo</label>
        <select id="tipo" name="tipo"><option value="">Todos</option>${tipos.map((t) => opt(t)).join('')}</select>
      </div>
      <div class="field">
        <label for="comuna">Comuna</label>
        <select id="comuna" name="comuna"><option value="">Todas</option>${comunas.map((c) => opt(c.nombre)).join('')}</select>
      </div>
      <div class="field">
        <label for="estrato">Estrato</label>
        <select id="estrato" name="estrato"><option value="">Todos</option>${[1, 2, 3, 4, 5, 6].map((e) => opt(e, `Estrato ${e}`)).join('')}</select>
      </div>
      <div class="field">
        <label for="hab">Habitaciones</label>
        <select id="hab" name="hab"><option value="">Cualquiera</option>${[1, 2, 3, 4].map((n) => opt(n, `${n}+`)).join('')}</select>
      </div>
      <div class="field">
        <label for="max">Precio máximo (millones)</label>
        <input type="number" id="max" name="max" inputmode="decimal" min="0" step="0.1" placeholder="Sin límite">
      </div>
      <div class="field">
        <label for="orden">Ordenar</label>
        <select id="orden" name="orden">
          <option value="reciente">Más recientes</option>
          <option value="precio-asc">Menor precio</option>
          <option value="precio-desc">Mayor precio</option>
          <option value="m2-asc">Menor precio por m²</option>
          <option value="area-desc">Mayor área</option>
        </select>
      </div>
      </div>
    </div>
    <div class="filters-foot">
      <p class="count" id="count" aria-live="polite"><strong>${entero(stats.total)}</strong> ofertas</p>
      <button type="reset" class="btn-link">Limpiar filtros</button>
    </div>
  </form>
  <div id="estado" role="status"></div>
  <div class="grid" id="resultados">
${initial.map(cardHTML).join('\n')}
  </div>
  <div class="more"><button type="button" class="btn" id="mas"${ofertas.length > ctx.pageSize ? '' : ' hidden'}>Ver más ofertas</button></div>
  <noscript><p class="notice">Sin JavaScript puedes explorar las ofertas por <a href="/comunas/">comuna</a>.</p></noscript>
</section>`;

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: ctx.siteUrl,
      inLanguage: 'es-CO',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'Oferta comercial de vivienda en Medellín (OIME)',
      description: 'Ofertas de vivienda en venta y arriendo recopiladas por el Observatorio Inmobiliario de Medellín.',
      url: SOURCE_URL,
      creator: { '@type': 'GovernmentOrganization', name: 'Alcaldía de Medellín' },
      spatialCoverage: { '@type': 'Place', name: 'Medellín, Antioquia, Colombia' },
      ...(stats.rangoFechas ? { temporalCoverage: `${stats.rangoFechas[0]}/${stats.rangoFechas[1]}` } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: initial.map((o, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: new URL(`/oferta/${o.id}/`, ctx.siteUrl).href,
        name: titulo(o),
      })),
    },
  ];

  return layout(ctx, {
    title: 'Vivienda en venta y arriendo en Medellín | Vitrina Inmobiliaria',
    description: `Explora ${entero(stats.total)} ofertas de vivienda en Medellín con datos abiertos del Observatorio Inmobiliario: precios por comuna, estrato y m².`,
    path: '/',
    nav: 'home',
    head: `<link rel="preload" href="/data/ofertas.json?v=${ctx.version}" as="fetch" crossorigin fetchpriority="low">${ld.map(jsonLd).join('')}`,
    body,
    scripts: `<script type="module" src="/assets/app.js?v=${ctx.version}"></script>`,
  });
}

// ---------- Detalle ----------

export function detailPage(ctx, o, stats, similares) {
  const comunaStats = stats.comunas.find((c) => c.nombre === o.comuna);
  const cmp = compareToComuna(o, comunaStats);
  const t = titulo(o);
  const facts = [
    ['Área', o.area ? `${entero(o.area)} m²` : null],
    ['Precio por m²', o.area ? precioLargo(o.precio / o.area) : null],
    ['Habitaciones', o.habitaciones],
    ['Baños', o.banos],
    ['Parqueaderos', o.parqueaderos],
    ['Estrato', o.estrato],
    ['Piso', o.piso],
    ['Antigüedad', o.antiguedad],
    ['Administración', o.administracion ? precioLargo(o.administracion) : null],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');

  let cmpHtml = '';
  if (cmp) {
    const pct = Math.round(Math.abs(cmp.diff) * 100);
    const dir = cmp.diff > 0.02 ? 'por encima de' : cmp.diff < -0.02 ? 'por debajo de' : 'en línea con';
    cmpHtml = `<section class="panel compare${cmp.diff > 0.02 ? ' up' : ''}" aria-labelledby="h-cmp">
  <h2 id="h-cmp">Frente a su comuna</h2>
  <p><strong>${dir === 'en línea con' ? 'En la media' : `${pct}% ${dir}`}</strong><br>
  <span class="muted">la mediana de ${esc(o.comuna)} para ${o.operacion.toLowerCase()} (${precioLargo(cmp.ref)} por m²).</span></p>
</section>`;
  }

  const lugar = [o.barrio, o.comuna].filter(Boolean).join(', ');
  const body = `
<div class="wrap">
  <nav class="crumbs" aria-label="Ruta de navegación"><ol>
    <li><a href="/">Ofertas</a></li>
    ${o.comuna ? `<li><a href="/comuna/${slugify(o.comuna)}/">${esc(o.comuna)}</a></li>` : ''}
    <li aria-current="page">${esc(o.tipo)} #${o.id}</li>
  </ol></nav>
  <article class="detail">
    <div>
      <p class="eyebrow">${esc(o.operacion)}${o.estrato ? ` · Estrato ${o.estrato}` : ''}</p>
      <h1>${esc(t)}</h1>
      <p class="muted">${esc(lugar || 'Medellín')}, Medellín</p>
      <p class="price-big">${precioLargo(o.precio)}${o.operacion === 'Arriendo' ? ' <span class="muted small">/ mes</span>' : ''}</p>
      ${o.actualizado ? `<p class="muted small">Registrado o actualizado el <time datetime="${o.actualizado}">${fecha(o.actualizado)}</time>${o.fuente ? ` · Fuente original: ${esc(o.fuente)}` : ''}</p>` : ''}
      <section class="panel" aria-labelledby="h-car" style="margin-top:16px">
        <h2 id="h-car">Características</h2>
        <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      </section>
      ${o.amenidades.length ? `<section class="panel" aria-labelledby="h-am" style="margin-top:16px"><h2 id="h-am">Comodidades</h2><ul class="chips">${o.amenidades.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>` : ''}
      ${o.descripcion ? `<section class="panel" aria-labelledby="h-desc" style="margin-top:16px"><h2 id="h-desc">Descripción del anuncio</h2><p class="desc">${esc(o.descripcion)}</p></section>` : ''}
    </div>
    <aside class="side">
      ${cmpHtml}
      ${o.lat ? `<section class="panel" aria-labelledby="h-ubi">
        <h2 id="h-ubi">Ubicación aproximada</h2>
        <div class="mini-map" id="mini-map" data-lat="${o.lat}" data-lon="${o.lon}">
          <button type="button" class="btn" id="cargar-mapa">Ver en el mapa</button>
        </div>
        <p class="small muted">La ubicación puede ser aproximada al barrio.</p>
      </section>` : ''}
      ${o.enlace ? `<a class="btn btn-primary" href="${esc(o.enlace)}" rel="noopener nofollow" target="_blank">Ver anuncio original ↗</a>` : ''}
    </aside>
  </article>
  ${similares.length ? `<section aria-labelledby="h-sim"><h2 id="h-sim" style="font-family:var(--serif)">Otras ofertas en ${esc(o.barrio || o.comuna)}</h2><div class="grid">${similares.map(cardHTML).join('')}</div></section>` : ''}
</div>`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: t,
    url: new URL(`/oferta/${o.id}/`, ctx.siteUrl).href,
    ...(o.actualizado ? { datePosted: o.actualizado } : {}),
    ...(o.descripcion ? { description: o.descripcion.slice(0, 300) } : {}),
    offers: {
      '@type': 'Offer',
      price: o.precio,
      priceCurrency: 'COP',
      businessFunction: o.operacion === 'Venta' ? 'http://purl.org/goodrelations/v1#Sell' : 'http://purl.org/goodrelations/v1#LeaseOut',
    },
    about: {
      '@type': /apartamento|apartaestudio/i.test(o.tipo) ? 'Apartment' : /casa/i.test(o.tipo) ? 'House' : 'Accommodation',
      ...(o.area ? { floorSize: { '@type': 'QuantitativeValue', value: o.area, unitCode: 'MTK' } } : {}),
      ...(o.habitaciones ? { numberOfRooms: o.habitaciones } : {}),
      ...(o.banos ? { numberOfBathroomsTotal: o.banos } : {}),
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Medellín',
        addressRegion: 'Antioquia',
        addressCountry: 'CO',
        ...(o.barrio ? { streetAddress: `Barrio ${o.barrio}` } : {}),
      },
      ...(o.lat ? { geo: { '@type': 'GeoCoordinates', latitude: o.lat, longitude: o.lon } } : {}),
    },
  };
  const crumbsLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ofertas', item: ctx.siteUrl },
      ...(o.comuna ? [{ '@type': 'ListItem', position: 2, name: o.comuna, item: new URL(`/comuna/${slugify(o.comuna)}/`, ctx.siteUrl).href }] : []),
      { '@type': 'ListItem', position: o.comuna ? 3 : 2, name: t },
    ],
  };

  return layout(ctx, {
    title: `${t} · ${precioCorto(o.precio)}`,
    description: `${t}, Medellín: ${precioLargo(o.precio)}${o.area ? `, ${entero(o.area)} m²` : ''}${o.habitaciones ? `, ${o.habitaciones} habitaciones` : ''}${o.estrato ? `, estrato ${o.estrato}` : ''}. Compara con la mediana de su comuna.`,
    path: `/oferta/${o.id}/`,
    head: jsonLd(ld) + jsonLd(crumbsLd),
    body,
    scripts: o.lat ? `<script type="module" src="/assets/detail.js?v=${ctx.version}"></script>` : '',
  });
}

// ---------- Comunas ----------

export function comunasPage(ctx, stats) {
  const conVenta = stats.comunas.filter((c) => c.m2Venta && c.venta >= 3);
  const max = Math.max(...conVenta.map((c) => c.m2Venta), 1);
  const body = `
<section class="hero wrap">
  <p class="eyebrow">Comparativo</p>
  <h1>Precio por metro cuadrado en cada comuna</h1>
  <p class="lede">Mediana del precio pedido por m² en las ofertas de venta, de la comuna más costosa a la más asequible. Toca una comuna para ver sus ofertas.</p>
  <ul class="bars">
  ${conVenta
    .map(
      (c) => `<li><a href="/comuna/${c.slug}/">
      <strong>${esc(c.nombre)}</strong><span>${precioCorto(c.m2Venta)}/m²</span>
      <span class="bar" aria-hidden="true"><span style="width:${((c.m2Venta / max) * 100).toFixed(1)}%"></span></span>
      <span class="n">${entero(c.venta)} en venta · ${entero(c.arriendo)} en arriendo${c.precioArriendo ? ` · arriendo mediano ${precioCorto(c.precioArriendo)}` : ''}</span>
    </a></li>`,
    )
    .join('')}
  </ul>
  <p class="small muted">Se muestran comunas con al menos 3 ofertas de venta con área registrada. Son precios de oferta, no de transacción.</p>
</section>`;
  return layout(ctx, {
    title: 'Precio del m² por comuna en Medellín',
    description: 'Ranking de comunas y corregimientos de Medellín según la mediana del precio por metro cuadrado en ofertas de vivienda.',
    path: '/comunas/',
    nav: 'comunas',
    body,
  });
}

export function comunaPage(ctx, comuna, ofertas) {
  const shown = ofertas.slice(0, 60);
  const body = `
<div class="wrap">
  <nav class="crumbs" aria-label="Ruta de navegación"><ol><li><a href="/comunas/">Comunas</a></li><li aria-current="page">${esc(comuna.nombre)}</li></ol></nav>
  <section class="hero" style="padding-top:12px">
    <h1>Vivienda en ${esc(comuna.nombre)}</h1>
    <ul class="kpis">
      <li><strong>${entero(comuna.total)}</strong><span>ofertas</span></li>
      <li><strong>${precioCorto(comuna.m2Venta)}</strong><span>mediana m² venta</span></li>
      <li><strong>${precioCorto(comuna.precioVenta)}</strong><span>venta mediana</span></li>
      <li><strong>${precioCorto(comuna.precioArriendo)}</strong><span>arriendo mediano</span></li>
    </ul>
  </section>
  <div class="grid">${shown.map(cardHTML).join('')}</div>
  ${ofertas.length > shown.length ? `<div class="more"><a class="btn" href="/?comuna=${encodeURIComponent(comuna.nombre)}">Ver las ${entero(ofertas.length)} ofertas con filtros</a></div>` : ''}
</div>`;
  return layout(ctx, {
    title: `Vivienda en venta y arriendo en ${comuna.nombre}, Medellín`,
    description: `${entero(comuna.total)} ofertas de vivienda en ${comuna.nombre}. Precio mediano por m²: ${precioCorto(comuna.m2Venta)}.`,
    path: `/comuna/${comuna.slug}/`,
    nav: 'comunas',
    body,
  });
}

// ---------- Mapa ----------

export function mapPage(ctx, stats) {
  const body = `
<div class="map-page">
  <div class="map-bar">
    <h1>Mapa de ofertas</h1>
    <div class="legend" role="group" aria-label="Mostrar en el mapa">
      <label><input type="checkbox" id="ver-venta" checked> <span class="dot" style="background:#a8492a"></span>Venta</label>
      <label><input type="checkbox" id="ver-arriendo" checked> <span class="dot" style="background:#2d5a47"></span>Arriendo</label>
    </div>
  </div>
  <div id="map" role="region" aria-label="Mapa de ${entero(stats.total)} ofertas en Medellín"><div class="empty" id="map-estado">Cargando mapa…</div></div>
</div>`;
  return layout(ctx, {
    title: 'Mapa de ofertas de vivienda en Medellín',
    description: 'Mapa interactivo con las ofertas de vivienda en venta y arriendo en Medellín según el Observatorio Inmobiliario.',
    path: '/mapa/',
    nav: 'mapa',
    head: `<link rel="preconnect" href="https://unpkg.com" crossorigin><link rel="preconnect" href="https://tile.openstreetmap.org">`,
    body,
    scripts: `<script type="module" src="/assets/map.js?v=${ctx.version}"></script>`,
  });
}

export function notFoundPage(ctx) {
  return layout(ctx, {
    title: 'Página no encontrada',
    description: 'La oferta que buscas ya no está disponible.',
    path: '/404.html',
    body: `<section class="hero wrap"><h1>Esta oferta ya no está</h1><p class="lede">Puede que el anuncio haya salido del Observatorio en la última actualización.</p><p><a class="btn btn-primary" href="/">Ver ofertas vigentes</a></p></section>`,
  });
}

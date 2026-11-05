// Capa de datos: consulta la capa "Investigaciones Internet" del Observatorio
// Inmobiliario de Medellín (OIME) en el servidor ArcGIS REST de la Alcaldía,
// pagina los resultados y los normaliza a un formato propio y estable.

import { readFile } from 'node:fs/promises';

export const LAYER_URL =
  'https://www.medellin.gov.co/servidormapas/rest/services/vivienda_ciudad_terri/VM_Oferta_Comercial_Oime/MapServer/1';

// Solo pedimos los campos que usamos: la respuesta pesa mucho menos.
const OUT_FIELDS = [
  'objectid', 'commercial_type', 'tipo_comercio', 'type', 'tipo_inmueble', 'category',
  'icono', 'status', 'original_neighborhood', 'neighborhood_calculated', 'commune_calculated',
  'stratum', 'price', 'administration', 'private_area_m2', 'total_area_m2', 'age',
  'bedrooms_number', 'bathrooms_number', 'parking_number', 'floor_number', 'description',
  'source_name', 'link', 'latitude', 'longitude', 'updated_at', 'created_at', 'year',
  'elevator', 'gym', 'swimming_pool', 'sauna', 'turkish', 'jacuzzi', 'green_area', 'balcony',
  'furnished', 'studio', 'laundry_area', 'gas_installation', 'bbq', 'childrens_area',
  'sports_fields', 'coworking', 'communal_hall', 'garden', 'frontdesk', 'cctv',
  'storage_room', 'covered_parking', 'guest_parking', 'external_view', 'integral_kitchen',
  'air_conditioning', 'heater',
].join(',');

const AMENITIES = {
  elevator: 'Ascensor', swimming_pool: 'Piscina', gym: 'Gimnasio', frontdesk: 'Portería',
  cctv: 'Circuito cerrado', balcony: 'Balcón', green_area: 'Zonas verdes',
  childrens_area: 'Zona infantil', bbq: 'BBQ', sauna: 'Sauna', turkish: 'Turco',
  jacuzzi: 'Jacuzzi', sports_fields: 'Canchas', coworking: 'Coworking',
  communal_hall: 'Salón social', garden: 'Jardín', storage_room: 'Cuarto útil',
  covered_parking: 'Parqueadero cubierto', guest_parking: 'Parqueadero visitantes',
  laundry_area: 'Zona de ropas', gas_installation: 'Gas natural', furnished: 'Amoblado',
  studio: 'Estudio', external_view: 'Vista exterior', integral_kitchen: 'Cocina integral',
  air_conditioning: 'Aire acondicionado', heater: 'Calentador',
};

// Caja que contiene Medellín y sus corregimientos: descarta coordenadas erróneas.
const BBOX = { minLat: 6.1, maxLat: 6.45, minLon: -75.8, maxLon: -75.4 };

export const defaultOptions = () => ({
  where: process.env.OIME_WHERE || "icono = 'vivienda' AND price > 0",
  maxRecords: Number(process.env.OIME_MAX_RECORDS || 4000),
  pageSize: 2000,
  timeoutMs: Number(process.env.OIME_TIMEOUT_MS || 45000),
  retries: 3,
});

async function fetchJson(url, { timeoutMs, retries }) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: 'application/json', 'user-agent': 'vive-medellin-build/1.0' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // ArcGIS responde 200 con { error } cuando la consulta falla.
      if (json.error) throw new Error(`ArcGIS: ${json.error.message || 'error'} (${json.error.code})`);
      return json;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const wait = 1500 * 2 ** (attempt - 1);
        console.warn(`  intento ${attempt} falló (${err.message}); reintento en ${wait} ms`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError;
}

/** Descarga los registros crudos (attributes + geometry) paginando con resultOffset. */
export async function fetchRawFeatures(opts = defaultOptions()) {
  const features = [];
  let offset = 0;
  while (features.length < opts.maxRecords) {
    const count = Math.min(opts.pageSize, opts.maxRecords - features.length);
    const params = new URLSearchParams({
      where: opts.where,
      outFields: OUT_FIELDS,
      returnGeometry: 'true',
      outSR: '4326',
      orderByFields: 'updated_at DESC, objectid DESC',
      resultOffset: String(offset),
      resultRecordCount: String(count),
      f: 'json',
    });
    const page = await fetchJson(`${LAYER_URL}/query?${params}`, opts);
    const batch = page.features || [];
    features.push(...batch);
    console.log(`  página offset=${offset}: ${batch.length} registros`);
    if (batch.length < count && !page.exceededTransferLimit) break;
    offset += batch.length;
    if (!batch.length) break;
  }
  return features;
}

export async function readSnapshot(path) {
  const json = JSON.parse(await readFile(path, 'utf8'));
  return Array.isArray(json) ? json : json.features;
}

// ---------- Normalización ----------

const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v);
const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const titleCase = (s) =>
  s ? s.toLowerCase().replace(/(^|[\s(/-])([\p{L}])/gu, (m, a, b) => a + b.toUpperCase()) : s;

export function normalizeOperation(...values) {
  const s = values.filter(Boolean).join(' ').toLowerCase();
  if (/arriend|alquil|rent|lease/.test(s)) return 'Arriendo';
  if (/vent|sale|sell|compr/.test(s)) return 'Venta';
  return null;
}

function stripHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +([,.;:])/g, '$1')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function safeLink(s) {
  try {
    const u = new URL(String(s));
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Convierte un feature de ArcGIS en un registro limpio, o null si no sirve. */
export function normalizeFeature(feature) {
  const a = feature.attributes || {};
  const g = feature.geometry || {};
  const lat = num(a.latitude) ?? num(g.y);
  const lon = num(a.longitude) ?? num(g.x);
  const precio = num(a.price);
  const operacion = normalizeOperation(a.tipo_comercio, a.commercial_type);
  if (!a.objectid || !precio || precio <= 0 || !operacion) return null;

  // Rangos razonables en COP para filtrar errores de digitación evidentes.
  if (operacion === 'Arriendo' && (precio < 200_000 || precio > 80_000_000)) return null;
  if (operacion === 'Venta' && (precio < 15_000_000 || precio > 60_000_000_000)) return null;

  const area = num(a.private_area_m2) || num(a.total_area_m2) || null;
  const validGeo =
    lat !== null && lon !== null &&
    lat > BBOX.minLat && lat < BBOX.maxLat && lon > BBOX.minLon && lon < BBOX.maxLon;
  const estrato = num(a.stratum);
  const fecha = num(a.updated_at) || num(a.created_at);

  return {
    id: a.objectid,
    operacion,
    tipo: titleCase(clean(a.tipo_inmueble || a.type || a.category)) || 'Inmueble',
    comuna: titleCase(clean(a.commune_calculated)) || null,
    barrio: titleCase(clean(a.neighborhood_calculated || a.original_neighborhood)) || null,
    estrato: estrato >= 1 && estrato <= 6 ? estrato : null,
    precio,
    administracion: num(a.administration) > 0 ? num(a.administration) : null,
    area: area && area > 8 && area < 5000 ? Math.round(area * 10) / 10 : null,
    habitaciones: num(a.bedrooms_number),
    banos: num(a.bathrooms_number),
    parqueaderos: num(a.parking_number),
    piso: num(a.floor_number),
    antiguedad: clean(a.age) || null,
    amenidades: Object.entries(AMENITIES).filter(([k]) => Number(a[k]) === 1).map(([, v]) => v),
    descripcion: stripHtml(a.description).slice(0, 1500),
    fuente: clean(a.source_name) || null,
    enlace: safeLink(a.link),
    lat: validGeo ? Math.round(lat * 1e5) / 1e5 : null,
    lon: validGeo ? Math.round(lon * 1e5) / 1e5 : null,
    actualizado: fecha ? new Date(fecha).toISOString().slice(0, 10) : null,
  };
}

export function normalizeAll(features) {
  const seen = new Set();
  const out = [];
  for (const f of features) {
    const o = normalizeFeature(f);
    if (o && !seen.has(o.id)) {
      seen.add(o.id);
      out.push(o);
    }
  }
  return out;
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFeature, normalizeOperation, normalizeAll } from '../src/oime.mjs';
import { median, computeStats, compareToComuna, slugify } from '../src/stats.mjs';
import { toCompact, fromCompact, precioCorto, esc, cardHTML } from '../public/assets/shared.js';

const base = {
  objectid: 1, tipo_comercio: 'VENTA', tipo_inmueble: 'APARTAMENTO', price: 450_000_000,
  private_area_m2: 90, commune_calculated: 'LAURELES ESTADIO', neighborhood_calculated: 'LOS CONQUISTADORES',
  stratum: 5, latitude: 6.245, longitude: -75.59, updated_at: Date.UTC(2026, 9, 1), elevator: 1, gym: 0,
};
const f = (attrs = {}, geometry) => ({ attributes: { ...base, ...attrs }, geometry });

test('normaliza un registro válido', () => {
  const o = normalizeFeature(f());
  assert.equal(o.operacion, 'Venta');
  assert.equal(o.tipo, 'Apartamento');
  assert.equal(o.comuna, 'Laureles Estadio');
  assert.equal(o.barrio, 'Los Conquistadores');
  assert.deepEqual(o.amenidades, ['Ascensor']);
  assert.equal(o.actualizado, '2026-10-01');
});

test('detecta la operación con distintos textos', () => {
  assert.equal(normalizeOperation('ARRIENDO'), 'Arriendo');
  assert.equal(normalizeOperation(null, 'sale'), 'Venta');
  assert.equal(normalizeOperation('otro'), null);
});

test('descarta precios absurdos y registros sin operación', () => {
  assert.equal(normalizeFeature(f({ price: 1 })), null);
  assert.equal(normalizeFeature(f({ tipo_comercio: 'ARRIENDO', price: 900_000_000 })), null);
  assert.equal(normalizeFeature(f({ tipo_comercio: null, commercial_type: null })), null);
});

test('usa la geometría si faltan lat/lon y descarta coordenadas fuera de Medellín', () => {
  const g = normalizeFeature(f({ latitude: null, longitude: null }, { x: -75.57, y: 6.25 }));
  assert.equal(g.lat, 6.25);
  const out = normalizeFeature(f({ latitude: 4.6, longitude: -74.08 }));
  assert.equal(out.lat, null);
});

test('limpia HTML y rechaza enlaces no http', () => {
  const o = normalizeFeature(f({ description: 'Hola <b>mundo</b> , bonito', link: 'javascript:alert(1)' }));
  assert.equal(o.descripcion, 'Hola mundo, bonito');
  assert.equal(o.enlace, null);
});

test('deduplica por objectid', () => {
  assert.equal(normalizeAll([f(), f()]).length, 1);
});

test('mediana y comparación con la comuna', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
  const ofertas = normalizeAll([f(), f({ objectid: 2, price: 540_000_000 }), f({ objectid: 3, price: 360_000_000 })]);
  const stats = computeStats(ofertas);
  assert.equal(stats.comunas[0].m2Venta, 5_000_000);
  const cmp = compareToComuna(ofertas[1], stats.comunas[0]);
  assert.ok(Math.abs(cmp.diff - 0.2) < 1e-9);
});

test('formato compacto ida y vuelta', () => {
  const o = normalizeFeature(f());
  const back = fromCompact(toCompact(o));
  assert.equal(back.precio, o.precio);
  assert.equal(back.comuna, o.comuna);
});

test('utilidades de presentación', () => {
  assert.equal(slugify('Belén'), 'belen');
  assert.equal(precioCorto(450_000_000), '$ 450 M');
  assert.equal(esc('<a "x">'), '&lt;a &quot;x&quot;&gt;');
  assert.ok(!cardHTML({ ...normalizeFeature(f()), barrio: '<script>' }).includes('<script>'));
});

test('consulta balanceada: pide arriendo y venta por separado', async () => {
  const { fetchBalancedFeatures } = await import('../src/oime.mjs');
  const wheres = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const where = new URL(url).searchParams.get('where');
    wheres.push(where);
    const n = /ARRIEND/.test(where) ? 3 : 5;
    const features = Array.from({ length: n }, (_, i) => ({ attributes: { objectid: i } }));
    return { ok: true, json: async () => ({ features }) };
  };
  try {
    const out = await fetchBalancedFeatures({ where: '1=1', maxRecords: 10, pageSize: 2000, timeoutMs: 1000, retries: 1 });
    assert.equal(out.length, 8);
    assert.match(wheres[0], /ARRIEND/);
    assert.match(wheres[1], /VENT/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('consulta balanceada: si el servidor rechaza el filtro, usa la consulta simple', async () => {
  const { fetchBalancedFeatures } = await import('../src/oime.mjs');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const where = new URL(url).searchParams.get('where');
    if (/LIKE/.test(where)) return { ok: true, json: async () => ({ error: { code: 400, message: 'Invalid query' } }) };
    return { ok: true, json: async () => ({ features: [{ attributes: { objectid: 1 } }] }) };
  };
  try {
    const out = await fetchBalancedFeatures({ where: '1=1', maxRecords: 10, pageSize: 2000, timeoutMs: 1000, retries: 1 });
    assert.equal(out.length, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

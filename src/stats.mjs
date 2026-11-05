// Indicadores calculados en tiempo de build: no cuestan nada al navegador.

export const median = (arr) => {
  const v = arr.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

export const slugify = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const m2 = (o) => (o.area ? o.precio / o.area : null);

export function computeStats(ofertas) {
  const venta = ofertas.filter((o) => o.operacion === 'Venta');
  const arriendo = ofertas.filter((o) => o.operacion === 'Arriendo');

  const byComuna = new Map();
  for (const o of ofertas) {
    if (!o.comuna) continue;
    if (!byComuna.has(o.comuna)) byComuna.set(o.comuna, []);
    byComuna.get(o.comuna).push(o);
  }

  const comunas = [...byComuna.entries()]
    .map(([nombre, list]) => {
      const v = list.filter((o) => o.operacion === 'Venta');
      const a = list.filter((o) => o.operacion === 'Arriendo');
      return {
        nombre,
        slug: slugify(nombre),
        total: list.length,
        venta: v.length,
        arriendo: a.length,
        m2Venta: median(v.map(m2)),
        m2Arriendo: median(a.map(m2)),
        precioVenta: median(v.map((o) => o.precio)),
        precioArriendo: median(a.map((o) => o.precio)),
        estratoTipico: median(list.map((o) => o.estrato)),
      };
    })
    .sort((x, y) => (y.m2Venta || 0) - (x.m2Venta || 0));

  const fechas = ofertas.map((o) => o.actualizado).filter(Boolean).sort();

  return {
    total: ofertas.length,
    venta: venta.length,
    arriendo: arriendo.length,
    medianaVenta: median(venta.map((o) => o.precio)),
    medianaArriendo: median(arriendo.map((o) => o.precio)),
    m2Venta: median(venta.map(m2)),
    m2Arriendo: median(arriendo.map(m2)),
    comunas,
    tipos: count(ofertas.map((o) => o.tipo)),
    rangoFechas: fechas.length ? [fechas[0], fechas[fechas.length - 1]] : null,
  };
}

function count(values) {
  const c = new Map();
  for (const v of values) if (v) c.set(v, (c.get(v) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([nombre, n]) => ({ nombre, n }));
}

/** Compara el precio por m² de una oferta con la mediana de su comuna. */
export function compareToComuna(o, comunaStats) {
  if (!o.area || !comunaStats) return null;
  const ref = o.operacion === 'Venta' ? comunaStats.m2Venta : comunaStats.m2Arriendo;
  if (!ref) return null;
  const diff = (o.precio / o.area - ref) / ref;
  return { ref, diff };
}

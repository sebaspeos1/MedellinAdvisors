// Código compartido entre el generador (Node) y el navegador.
// La misma función pinta las tarjetas en el HTML estático y al filtrar,
// así el marcado nunca se desincroniza.

export const COMPACT_FIELDS = [
  'id', 'operacion', 'tipo', 'comuna', 'barrio', 'estrato', 'precio',
  'area', 'habitaciones', 'banos', 'parqueaderos', 'lat', 'lon', 'actualizado',
];

export const toCompact = (o) => COMPACT_FIELDS.map((k) => o[k] ?? null);
export const fromCompact = (row) =>
  Object.fromEntries(COMPACT_FIELDS.map((k, i) => [k, row[i]]));

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/** $ 450 M, $ 1.250 M, $ 2,4 mil M… legible en tarjetas pequeñas. */
export function precioCorto(n) {
  if (n == null) return '—';
  if (n >= 1e9) return `$ ${(n / 1e9).toLocaleString('es-CO', { maximumFractionDigits: 2 })} mil M`;
  if (n >= 1e6) return `$ ${(n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
  return cop.format(n);
}
export const precioLargo = (n) => (n == null ? '—' : cop.format(n));
export const entero = (n) => (n == null ? '—' : Math.round(n).toLocaleString('es-CO'));

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  bed: '<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 15h18M7 10V7h4v3"/>',
  bath: '<path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM6 12V6a2 2 0 0 1 4 0"/>',
  area: '<path d="M4 4h16v16H4zM4 9h5M15 20v-5"/>',
  car: '<path d="M5 16V11l2-5h10l2 5v5M5 16h14M7 16v2M17 16v2"/>',
};
export const icon = (name) =>
  `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

export const titulo = (o) =>
  `${o.tipo} en ${o.operacion.toLowerCase()}${o.barrio ? ` en ${o.barrio}` : o.comuna ? ` en ${o.comuna}` : ''}`;

export function cardHTML(o) {
  const lugar = [o.barrio, o.comuna].filter(Boolean).join(' · ') || 'Medellín';
  const m2 = o.area ? `${precioCorto(o.precio / o.area)}/m²` : '';
  const specs = [
    o.area ? `<li>${icon('area')}${entero(o.area)} m²</li>` : '',
    o.habitaciones ? `<li>${icon('bed')}${o.habitaciones} hab.</li>` : '',
    o.banos ? `<li>${icon('bath')}${o.banos} ${o.banos === 1 ? 'baño' : 'baños'}</li>` : '',
    o.parqueaderos ? `<li>${icon('car')}${o.parqueaderos} parq.</li>` : '',
  ].join('');
  return `<article class="card" data-op="${o.operacion === 'Venta' ? 'v' : 'a'}">
  <a class="card-link" href="/oferta/${o.id}/">
    <div class="card-top"><span class="tag">${esc(o.operacion)}</span>${o.estrato ? `<span class="estrato" title="Estrato ${o.estrato}">E${o.estrato}</span>` : ''}</div>
    <h3 class="card-title">${esc(o.tipo)}<span> en ${esc(o.barrio || o.comuna || 'Medellín')}</span></h3>
    <p class="card-place">${esc(lugar)}</p>
    <p class="card-price">${precioCorto(o.precio)}${o.operacion === 'Arriendo' ? '<small>/mes</small>' : ''}</p>
    ${m2 ? `<p class="card-m2">${m2}</p>` : ''}
    ${specs ? `<ul class="specs">${specs}</ul>` : ''}
  </a>
</article>`;
}

import { loadLeaflet, baseMap, COLORS } from './leaflet-loader.js';
import { fromCompact, precioCorto, esc, titulo } from './shared.js';

const el = document.getElementById('map');
const estado = document.getElementById('map-estado');
const version = new URL(import.meta.url).searchParams.get('v') || '';

function showError(msg) {
  estado.hidden = false;
  estado.innerHTML = `<p><strong>${esc(msg)}</strong></p><button class="btn" type="button" id="reintentar">Reintentar</button>`;
  document.getElementById('reintentar').onclick = () => location.reload();
}

try {
  const [L, json] = await Promise.all([
    loadLeaflet(),
    fetch(`/data/ofertas.json?v=${version}`).then((r) => {
      if (!r.ok) throw new Error('No se pudieron cargar las ofertas');
      return r.json();
    }),
  ]);
  estado.remove();
  const map = baseMap(L, el, [6.2476, -75.5658], 12);
  const renderer = L.canvas({ padding: 0.5 });
  const layers = { Venta: L.layerGroup(), Arriendo: L.layerGroup() };

  for (const row of json.rows) {
    const o = fromCompact(row);
    if (o.lat == null || !layers[o.operacion]) continue;
    L.circleMarker([o.lat, o.lon], {
      renderer,
      radius: 5,
      weight: 1,
      color: '#fff',
      fillColor: COLORS[o.operacion],
      fillOpacity: 0.85,
    })
      .bindPopup(
        () =>
          `<strong>${esc(titulo(o))}</strong><br>${precioCorto(o.precio)}${o.operacion === 'Arriendo' ? '/mes' : ''}${o.area ? ` · ${Math.round(o.area)} m²` : ''}<br><a href="/oferta/${o.id}/">Ver detalle</a>`,
      )
      .addTo(layers[o.operacion]);
  }
  Object.values(layers).forEach((l) => l.addTo(map));

  const toggle = (id, op) =>
    document.getElementById(id).addEventListener('change', (e) => {
      e.target.checked ? layers[op].addTo(map) : map.removeLayer(layers[op]);
    });
  toggle('ver-venta', 'Venta');
  toggle('ver-arriendo', 'Arriendo');
} catch (err) {
  console.error(err);
  showError(err.message || 'No se pudo cargar el mapa');
}

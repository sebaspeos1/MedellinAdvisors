// Mapa del detalle: se carga solo cuando la persona lo pide o cuando el
// recuadro entra en pantalla, para no afectar la carga inicial.
import { loadLeaflet, baseMap } from './leaflet-loader.js';

const box = document.getElementById('mini-map');
const btn = document.getElementById('cargar-mapa');
let started = false;

async function start() {
  if (started) return;
  started = true;
  btn.textContent = 'Cargando…';
  btn.disabled = true;
  try {
    const L = await loadLeaflet();
    const ll = [Number(box.dataset.lat), Number(box.dataset.lon)];
    box.innerHTML = '';
    const map = baseMap(L, box, ll, 15);
    L.circle(ll, { radius: 120, color: '#a8492a', fillOpacity: 0.25 }).addTo(map);
  } catch (err) {
    started = false;
    btn.disabled = false;
    btn.textContent = 'No se pudo cargar. Reintentar';
  }
}

btn.addEventListener('click', start);
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      // Esperar a que la página esté inactiva para no competir con el contenido.
      (window.requestIdleCallback || setTimeout)(start);
    }
  }, { rootMargin: '100px' });
  io.observe(box);
}

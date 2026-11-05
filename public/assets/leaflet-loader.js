// Carga Leaflet bajo demanda desde un CDN con integridad (SRI).
// Así las páginas que no muestran mapa no pagan sus ~150 KB.
const VERSION = '1.9.4';
const BASE = `https://unpkg.com/leaflet@${VERSION}/dist`;
const JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
const CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';

let promise;
export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    Object.assign(css, { rel: 'stylesheet', href: `${BASE}/leaflet.css`, integrity: CSS_SRI, crossOrigin: '' });
    document.head.append(css);
    const s = document.createElement('script');
    Object.assign(s, { src: `${BASE}/leaflet.js`, integrity: JS_SRI, crossOrigin: '', async: true });
    s.onload = () => resolve(window.L);
    s.onerror = () => {
      promise = null;
      reject(new Error('No se pudo cargar la librería del mapa'));
    };
    document.head.append(s);
  });
  return promise;
}

export function baseMap(L, el, center, zoom) {
  const map = L.map(el, { preferCanvas: true, scrollWheelZoom: false }).setView(center, zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  // En escritorio, permitir zoom con la rueda solo tras hacer clic en el mapa.
  map.once('focus click', () => map.scrollWheelZoom.enable());
  return map;
}

export const COLORS = { Venta: '#a8492a', Arriendo: '#2d5a47' };

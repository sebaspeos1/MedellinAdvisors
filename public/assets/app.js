// Filtros del listado. El HTML ya trae las primeras tarjetas; este script
// descarga el índice compacto (/data/ofertas.json) en segundo plano y filtra
// en memoria, sin volver a llamar a la API pública.
import { cardHTML, fromCompact, entero } from './shared.js';

const PAGE = 24;
const form = document.getElementById('filtros');
const grid = document.getElementById('resultados');
const countEl = document.getElementById('count');
const moreBtn = document.getElementById('mas');
const estado = document.getElementById('estado');
const version = new URL(import.meta.url).searchParams.get('v') || '';

let data = null;
let loading = null;
let results = [];
let shown = 0;

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function loadData() {
  if (data) return Promise.resolve(data);
  if (loading) return loading;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  loading = fetch(`/data/ofertas.json?v=${version}`, { signal: ctrl.signal })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((json) => {
      data = json.rows.map((row) => {
        const o = fromCompact(row);
        o._q = norm(`${o.barrio} ${o.comuna} ${o.tipo}`);
        o._m2 = o.area ? o.precio / o.area : Infinity;
        return o;
      });
      data.forEach((o, i) => (o._i = i)); // orden original = más reciente primero
      return data;
    })
    .catch((err) => {
      loading = null;
      throw err;
    })
    .finally(() => clearTimeout(timer));
  return loading;
}

function readFilters() {
  const f = new FormData(form);
  return {
    q: norm(f.get('q')).trim(),
    op: f.get('op') || '',
    tipo: f.get('tipo') || '',
    comuna: f.get('comuna') || '',
    estrato: Number(f.get('estrato')) || 0,
    hab: Number(f.get('hab')) || 0,
    max: Number(f.get('max')) > 0 ? Number(f.get('max')) * 1e6 : 0,
    orden: f.get('orden') || 'reciente',
  };
}

const SORTS = {
  reciente: (a, b) => a._i - b._i,
  'precio-asc': (a, b) => a.precio - b.precio,
  'precio-desc': (a, b) => b.precio - a.precio,
  'm2-asc': (a, b) => a._m2 - b._m2,
  'area-desc': (a, b) => (b.area || 0) - (a.area || 0),
};

function apply() {
  const f = readFilters();
  const terms = f.q.split(/\s+/).filter(Boolean);
  results = data.filter(
    (o) =>
      (!f.op || o.operacion === f.op) &&
      (!f.tipo || o.tipo === f.tipo) &&
      (!f.comuna || o.comuna === f.comuna) &&
      (!f.estrato || o.estrato === f.estrato) &&
      (!f.hab || (o.habitaciones || 0) >= f.hab) &&
      (!f.max || o.precio <= f.max) &&
      terms.every((t) => o._q.includes(t)),
  );
  results.sort(SORTS[f.orden] || SORTS.reciente);
  shown = 0;
  grid.innerHTML = '';
  renderMore();
  countEl.innerHTML = `<strong>${entero(results.length)}</strong> ${results.length === 1 ? 'oferta' : 'ofertas'}`;
  if (!results.length) {
    grid.innerHTML = '<p class="empty">No hay ofertas con esos filtros. Prueba ampliando el precio o quitando el estrato.</p>';
  }
  syncUrl(f);
}

function renderMore() {
  const next = results.slice(shown, shown + PAGE);
  grid.insertAdjacentHTML('beforeend', next.map(cardHTML).join(''));
  shown += next.length;
  moreBtn.hidden = shown >= results.length;
}

function syncUrl(f) {
  const p = new URLSearchParams();
  const raw = new FormData(form);
  for (const [k, v] of raw) if (v && !(k === 'orden' && v === 'reciente')) p.set(k, v);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function restoreFromUrl() {
  const p = new URLSearchParams(location.search);
  let any = false;
  for (const [k, v] of p) {
    const el = form.elements[k];
    if (!el) continue;
    any = true;
    if (el instanceof RadioNodeList) {
      for (const r of el) r.checked = r.value === v;
    } else {
      el.value = v;
    }
  }
  return any;
}

let slowTimer;
async function run() {
  if (!data) {
    slowTimer = setTimeout(() => {
      estado.innerHTML = '<div class="grid" aria-hidden="true"><div class="skeleton"></div><div class="skeleton"></div></div><p class="sr-only">Cargando ofertas…</p>';
    }, 300);
  }
  try {
    await loadData();
    estado.innerHTML = '';
    apply();
  } catch (err) {
    estado.innerHTML = `<div class="notice error"><p><strong>No pudimos cargar el índice de ofertas.</strong> Revisa tu conexión; mientras tanto ves las más recientes.</p><button type="button" class="btn" id="reintentar">Reintentar</button></div>`;
    document.getElementById('reintentar').onclick = run;
    console.error(err);
  } finally {
    clearTimeout(slowTimer);
  }
}

const extra = document.getElementById('extra');
const toggleBtn = document.getElementById('mas-filtros');
function setExtra(open) {
  extra.classList.toggle('open', open);
  toggleBtn.setAttribute('aria-expanded', String(open));
  toggleBtn.textContent = open ? 'Menos filtros' : 'Más filtros';
}
toggleBtn.addEventListener('click', () => setExtra(!extra.classList.contains('open')));

let debounce;
form.addEventListener('input', (e) => {
  clearTimeout(debounce);
  debounce = setTimeout(run, e.target.type === 'search' || e.target.type === 'number' ? 200 : 0);
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  run();
});
form.addEventListener('reset', () => setTimeout(run, 0));
moreBtn.addEventListener('click', async () => {
  if (!data) await run();
  else renderMore();
});

// Si llegan con filtros en la URL (p. ej. desde una comuna), aplicarlos ya.
// Si no, precargar el índice cuando el navegador esté libre.
if (restoreFromUrl()) {
  if ([...extra.querySelectorAll('select,input')].some((el) => el.value && !(el.name === 'orden' && el.value === 'reciente'))) setExtra(true);
  run();
}
else {
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
  idle(() => loadData().catch(() => {}));
  form.addEventListener('focusin', () => loadData().catch(() => {}), { once: true });
}

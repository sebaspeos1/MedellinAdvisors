# Vitrina Inmobiliaria Medellín

Sitio web que muestra la oferta de vivienda en venta y arriendo de Medellín a partir de los datos abiertos del **Observatorio Inmobiliario de Medellín (OIME)**, y responde una pregunta concreta: *¿cuánto se pide por vivir en cada barrio y comuna, y esta oferta está cara o barata frente a su zona?*

- **Demo:** `https://<tu-proyecto>.vercel.app` <!-- reemplazar al desplegar -->
- **Páginas:** listado con filtros · detalle por oferta · mapa interactivo · ranking de precio del m² por comuna · página por comuna

## Qué API usé y por qué

**Servidor de mapas de la Alcaldía de Medellín (ArcGIS REST)** → servicio `VM_Oferta_Comercial_Oime`, capa 1 *Investigaciones Internet*:

```
https://www.medellin.gov.co/servidormapas/rest/services/vivienda_ciudad_terri/VM_Oferta_Comercial_Oime/MapServer/1/query
```

La elegí sobre los conjuntos del DANE en datos.gov.co porque:

1. **Es dato a nivel de inmueble**, no agregado: precio, área, habitaciones, baños, estrato, comuna, barrio, coordenadas, comodidades y descripción. Eso permite tarjetas, detalle y mapa reales; los datos del DANE suelen ser series o índices municipales.
2. **Es de Medellín y está georreferenciado** (WGS84), ideal para el mapa con Leaflet.
3. **La API soporta lo necesario para consumirla bien**: paginación (`resultOffset`), `orderByFields`, selección de campos (`outFields`) y filtros SQL (`where`).

Consulta usada (simplificada):

```
where=icono='vivienda' AND price>0
outFields=<solo los ~55 campos que se usan>
orderByFields=updated_at DESC, objectid DESC
resultOffset=0&resultRecordCount=2000&f=json
```

## Cómo correr el proyecto

Requisitos: **Node.js 20 o superior**. No hay dependencias que instalar.

```bash
git clone https://github.com/<usuario>/vitrina-medellin.git
cd vitrina-medellin
npm run dev        # consulta la API, genera dist/ y abre http://localhost:4321
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run build` | Consulta la API y genera el sitio estático en `dist/` |
| `npm run preview` | Sirve `dist/` en `http://localhost:4321` |
| `npm test` | Pruebas unitarias de normalización, estadísticas y formato |
| `npm run snapshot` | Guarda la respuesta de la API en `data/snapshot.json` (respaldo) |

Variables de entorno opcionales:

| Variable | Por defecto | Uso |
|---|---|---|
| `SITE_URL` | URL que da Vercel/Netlify/Cloudflare | URLs canónicas, sitemap y datos estructurados |
| `OIME_MAX_RECORDS` | `4000` | Máximo de ofertas a descargar (las más recientes) |
| `OIME_WHERE` | `icono = 'vivienda' AND price > 0` | Filtro SQL enviado a ArcGIS |
| `OIME_TIMEOUT_MS` | `45000` | Tiempo máximo por página de la API |
| `OIME_OFFLINE` | — | Con `1`, usa solo la copia de respaldo |

### Despliegue

**Vercel** (recomendado): importar el repositorio; `vercel.json` ya define el build (`npm run build`), la carpeta (`dist`) y las cabeceras de caché. **Netlify** y **Cloudflare Pages** también funcionan (`netlify.toml` y `public/_headers`).

## Decisiones técnicas

### 1. Generación estática: la API se consulta al publicar, no al visitar

Las APIs públicas pueden tardar varios segundos. Si el navegador del visitante la consultara, el LCP dependería del servidor de la Alcaldía. Por eso **el build consulta la API una vez** y genera HTML completo para cada página. El visitante recibe archivos estáticos desde el CDN.

```
API ArcGIS ──(build)──▶ normaliza + calcula estadísticas ──▶ HTML + índice JSON ──▶ CDN ──▶ visitante
```

- La primera pantalla del listado ya viene con 24 tarjetas en el HTML: no hay *spinner* en la carga inicial.
- Para filtrar, el navegador descarga en segundo plano (`requestIdleCallback` / al enfocar el formulario) un índice compacto `data/ofertas.json` y filtra **en memoria**, sin ir a la red en cada cambio. El índice usa arreglos en vez de objetos: unos 17 KB comprimidos por cada ~900 ofertas.
- Una misma función (`cardHTML` en `public/assets/shared.js`) pinta las tarjetas en el servidor y en el navegador, así el marcado nunca se desincroniza.

### 2. Datos frescos y resistentes a fallos

- **Reintentos con espera exponencial** y *timeout* por página de la API.
- **Copia de respaldo** (`data/snapshot.json`): una GitHub Action la actualiza a diario. Si la API falla durante un build, se usa la copia y el pie de página lo indica.
- Si no hay API ni copia, **el build falla a propósito**: Vercel/Netlify mantienen en línea la última versión buena en vez de publicar un sitio vacío.
- Como la Action hace commit solo cuando los datos cambian, ese commit dispara un nuevo despliegue: el sitio se actualiza solo, una vez al día.

### 3. Rendimiento (PageSpeed móvil)

- **Cero dependencias y cero frameworks**: el generador es Node puro y el cliente es JavaScript nativo en módulos (~4 KB comprimidos para el listado).
- **CSS crítico en línea** en cada página (≈ 4 KB comprimido): ningún recurso bloquea el renderizado.
- **Fuentes del sistema**: no se descargan tipografías.
- **Leaflet se carga bajo demanda** desde unpkg con integridad SRI, solo en `/mapa/` o cuando el recuadro del detalle se acerca a la pantalla. El mapa usa `preferCanvas` y `L.canvas` para pintar miles de puntos sin crear miles de nodos DOM.
- `content-visibility: auto` en las tarjetas, `modulepreload` del código compartido y `preload` de baja prioridad del índice.
- **Caché**: assets con `immutable` (cada build versiona las URLs con `?v=`, incluidos los `import` internos) y el índice JSON con `stale-while-revalidate`.

Peso medido de la página de inicio sobre la red: HTML ≈ 7 KB + JS ≈ 4 KB (gzip).

### 4. Limpieza de datos

Los anuncios vienen de portales y tienen ruido. `src/oime.mjs` normaliza cada registro:

- Unifica la operación (*Venta* / *Arriendo*) a partir de `tipo_comercio` o `commercial_type`.
- Descarta precios imposibles (p. ej., arriendos de miles de millones) y áreas fuera de rango.
- Descarta coordenadas fuera de Medellín y usa la geometría si faltan `latitude`/`longitude`.
- Limpia HTML de las descripciones y acepta solo enlaces `http(s)`.
- Elimina duplicados por `objectid`.

### 5. De datos a algo útil

- **"Frente a su comuna"**: cada detalle compara el precio por m² de la oferta con la **mediana** de su comuna para la misma operación (p. ej., *"12 % por debajo de la mediana de Belén"*). Se usa la mediana y no el promedio porque unos pocos inmuebles de lujo distorsionan la media.
- **Ranking de comunas** por precio mediano del m² y página por comuna con sus indicadores.
- **Filtros compartibles**: el estado de los filtros vive en la URL (`/?comuna=Belén&op=Arriendo`).

### 6. SEO y accesibilidad

- HTML semántico (`header`, `nav`, `main`, `article`, `aside`, `dl`, migas de pan con `nav`).
- `title`, `description`, canonical y Open Graph por página; `sitemap.xml` y `robots.txt` generados.
- Datos estructurados JSON-LD: `WebSite`, `Dataset`, `ItemList`, `RealEstateListing` con `Offer` y `GeoCoordinates`, y `BreadcrumbList`.
- Cada oferta y cada comuna tiene su propia URL indexable, generada en estático.
- Etiquetas en todos los campos, foco visible, contraste AA, enlace "Saltar al contenido", modo oscuro y `prefers-reduced-motion`.

### 7. Manejo de errores y estados de carga

- Si el índice tarda más de 300 ms aparece un esqueleto; si falla (o pasa de 15 s), un aviso con botón **Reintentar**, y las ofertas iniciales siguen visibles.
- El mapa muestra su propio estado de carga y error con reintento.
- Sin JavaScript el sitio sigue siendo navegable: inicio, comunas y detalle son HTML completo.

## Estructura

```
scripts/
  build.mjs        Generador: API → normalización → páginas en dist/
  snapshot.mjs     Guarda la copia de respaldo de la API
  serve.mjs        Servidor local de vista previa
src/
  oime.mjs         Cliente de la API ArcGIS (paginación, reintentos) y normalización
  stats.mjs        Medianas por comuna y comparación de precios
  pages.mjs        Plantillas HTML, metadatos y JSON-LD
public/assets/
  shared.js        Formato y tarjeta (compartido servidor/navegador)
  app.js           Filtros, orden, paginación y estado en la URL
  map.js           Mapa de todas las ofertas
  detail.js        Mapa perezoso del detalle
  leaflet-loader.js Carga de Leaflet bajo demanda con SRI
  styles.css       Estilos (se insertan en línea en cada página)
test/              Pruebas con node:test
.github/workflows/ CI y actualización diaria de datos
```

## Cómo usé herramientas de IA

Usé **Claude (Anthropic)** como asistente durante todo el desarrollo:

- **Exploración de la API**: revisar el directorio ArcGIS de la Alcaldía, identificar la capa del OIME y su esquema de ~80 campos, y confirmar sus capacidades (paginación, orden, `maxRecordCount` de 10.000).
- **Arquitectura**: discutir el enfoque estático vs. consultar la API desde el navegador, y la estrategia de respaldo ante fallos.
- **Código**: generar la primera versión del generador, las plantillas, los filtros y las pruebas, que luego revisé, probé y ajusté.
- **Revisión visual**: capturas en móvil y escritorio con un navegador sin interfaz para corregir detalles (encabezado que se partía en dos líneas en móvil, filtros secundarios plegables, plurales).

Lo que verifiqué yo: <!-- ajustar con tu experiencia real -->
- Que los valores reales de `tipo_comercio` y `tipo_inmueble` se normalizan bien.
- Que los rangos de precio para descartar datos erróneos tienen sentido para el mercado de Medellín.
- La medición en PageSpeed Insights del despliegue final.

## Limitaciones

- Son **precios de oferta publicados en portales**, no precios de cierre.
- La ubicación puede ser aproximada al barrio.
- Se generan las 4.000 ofertas más recientes por defecto (ajustable con `OIME_MAX_RECORDS`) para mantener el build rápido.

## Licencia

MIT. Los datos pertenecen a la Alcaldía de Medellín y se usan según su política de datos abiertos.

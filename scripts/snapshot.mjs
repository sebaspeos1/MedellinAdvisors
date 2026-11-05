// Guarda una copia de la respuesta de la API en data/snapshot.json.
// Se usa SOLO si la API falla durante un build. La genera la API (local o
// GitHub Actions), nunca se edita a mano.
import { writeFile, mkdir } from 'node:fs/promises';
import { fetchRawFeatures, defaultOptions } from '../src/oime.mjs';

const features = await fetchRawFeatures(defaultOptions());
if (!features.length) {
  console.error('La API respondió sin registros; no se sobrescribe la copia.');
  process.exit(1);
}
await mkdir('data', { recursive: true });
await writeFile(
  'data/snapshot.json',
  JSON.stringify({ fetchedAt: new Date().toISOString(), count: features.length, features }),
);
console.log(`✓ data/snapshot.json con ${features.length} registros`);

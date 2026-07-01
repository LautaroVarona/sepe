#!/usr/bin/env node
/**
 * Genera XML SEPE desde fuentes/:
 *   - tmp22E8.xls          → maestro trabajadores A3
 *   - 00. 2026...xlsx      → movimientos Alta/Baja
 *
 * Uso: npm run generate:fuentes
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { generateAndWriteXml } from '../src/services/sepe-llamamientos/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const fuentes = join(root, 'fuentes');

const masterPath = join(fuentes, 'tmp22E8.xls');
const movementPath = join(fuentes, '00. 2026 GR. EL ALTO - Llamamientos.xlsx');
const outputDir = join(root, 'data', 'generated');

for (const p of [masterPath, movementPath]) {
  if (!existsSync(p)) {
    console.error(`No encontrado: ${p}`);
    process.exit(1);
  }
}

const result = generateAndWriteXml({
  movementPaths: [movementPath],
  masterPath,
  outputDir,
  outputBaseName: '00._2026_GR._EL_ALTO_-_Llamamientos',
  empresa: {
    nifEmpresa: 'B96562467',
    ccc: '46109049727',
    codigoEmpresaA3: '96280',
  },
});

console.log('\n=== Estadísticas ===');
console.log(JSON.stringify(result.stats, null, 2));

console.log('\n=== Log ===');
for (const entry of result.logs) {
  const prefix = entry.level.toUpperCase().padEnd(5);
  const loc = [entry.file, entry.row, entry.dni].filter(Boolean).join(' · ');
  console.log(`${prefix} ${entry.message}${loc ? ` (${loc})` : ''}`);
}

if (!result.ok) {
  process.exit(1);
}

console.log(`\n✓ ${result.stats.recordsGenerated} llamamientos → ${result.files.length} XML(s)`);
for (const f of result.files) {
  console.log(`  - ${join(outputDir, f.name)} (${f.count} registros)`);
}

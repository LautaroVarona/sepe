/**
 * Rellena fecha_nacimiento en trabajadores existentes desde un Excel A3.
 * Uso: node scripts/backfill-fechas-from-xls.js "data/PRUEBA EL ALTO.xls"
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getStore } from '../src/lib/store.js';
import { backfillFechasFromExcelBuffer } from '../src/lib/services/worker-fecha-backfill-service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_FILE = join(__dirname, '..', 'data', 'db.json');

const xlsPath = process.argv[2] || 'data/PRUEBA EL ALTO.xls';
if (!existsSync(xlsPath)) {
  console.error(`No existe: ${xlsPath}`);
  process.exit(1);
}

const buf = readFileSync(xlsPath);
const db = getStore();
const result = backfillFechasFromExcelBuffer(buf, { headerRow: 1, store: db });

mkdirSync(dirname(DB_FILE), { recursive: true });
writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');

console.log(`Excel: ${result.dnisConFechaEnExcel} DNIs con fecha (fila cabecera ${result.meta.headerRowUsed})`);
console.log(`Actualizados: ${result.updated}`);
console.log(`Ya correctos: ${result.alreadyOk}`);
console.log(`Sin fecha en Excel: ${result.noEnExcel}`);
console.log('Listo.');

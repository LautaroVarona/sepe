/**
 * Prueba del procesador Excel A3 trabajadores (fuente parcial).
 */
import XLSX from 'xlsx';
import assert from 'node:assert/strict';
import { processA3WorkerExcel } from '../src/lib/a3-worker-excel/process.js';
import { normalizeFechaYmd, normalizeIndIncorpora } from '../src/lib/a3-worker-excel/normalize.js';
import { normalizeExcelRow } from '../src/lib/a3-worker-excel/map-to-store.js';
import { readA3WorkerExcelBuffer } from '../src/lib/a3-worker-excel/reader.js';

function buildWorkbookBuffer(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Trabajadores');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

assert.equal(normalizeFechaYmd('16/12/1985'), '19851216');
assert.equal(normalizeFechaYmd('1985-12-16T00:00:00.000Z'), '19851216');
assert.equal(normalizeFechaYmd('16.12.1985'), '19851216');
assert.equal(normalizeFechaYmd('1/5/1985'), '19850501');
assert.equal(normalizeFechaYmd(31397), '19851216');
assert.equal(normalizeFechaYmd('31397'), '19851216');
assert.equal(normalizeIndIncorpora(''), 'S');
assert.equal(normalizeIndIncorpora('n'), 'N');

const serialBuffer = buildWorkbookBuffer([
  ['DNI', 'NOMBRE', 'PRIMER APELLIDO', 'FECHA NACIMIENTO'],
  ['06271886Q', 'VICTOR', 'ARRAEZ', 31397],
]);
const serialRead = readA3WorkerExcelBuffer(serialBuffer);
assert.equal(
  normalizeExcelRow(serialRead.rows[0].record).fechaNacimientoYmd,
  '19851216',
);

function buildFormattedDateWorkbook() {
  const wb = XLSX.utils.book_new();
  const ws = {};
  ws.A1 = { t: 's', v: 'DNI' };
  ws.B1 = { t: 's', v: 'NOMBRE' };
  ws.C1 = { t: 's', v: 'PRIMER APELLIDO' };
  ws.D1 = { t: 's', v: 'FECHA NACIMIENTO' };
  ws.A2 = { t: 's', v: '06271886Q' };
  ws.B2 = { t: 's', v: 'VICTOR' };
  ws.C2 = { t: 's', v: 'ARRAEZ' };
  ws.D2 = { t: 'n', v: 31397, z: 'dd/mm/yyyy' };
  ws['!ref'] = 'A1:D2';
  XLSX.utils.book_append_sheet(wb, ws, 'Trabajadores');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const fmtRead = readA3WorkerExcelBuffer(buildFormattedDateWorkbook());
assert.equal(fmtRead.rows[0].record.FECHA_NACIMIENTO, '19851216');

// Cabecera con espacio duro (NBSP) como algunos Excel
const nbspBuf = buildWorkbookBuffer([
  ['DNI', 'NOMBRE', 'PRIMER APELLIDO', 'FECHA\u00a0NACIMIENTO'],
  ['49182751B', 'TEST', 'USER', '25/09/2004'],
]);
const nbspRead = readA3WorkerExcelBuffer(nbspBuf);
assert.equal(nbspRead.rows[0].record.FECHA_NACIMIENTO, '20040925');
assert.ok(nbspRead.meta.detectedColumns.includes('FECHA_NACIMIENTO'));

const typoHeaderBuffer = buildWorkbookBuffer([
  [
    'DNI/NIE',
    'PRIMER APELLIDO',
    'SEGUNDO APELLIDO',
    'NOMBRE',
    'SEXO',
    'NACIONALIDAD',
    'MUNICIPIO',
    'FECHA NACHIMIENTO',
    'NIVEL DE ESTUDIOS',
  ],
  ['06271886Q', 'ARRAEZ', 'ABAD', 'VICTOR', 'Hombre', '724', '46250', '16/12/1985', '32'],
]);
const typoResult = processA3WorkerExcel(typoHeaderBuffer, { originalFileName: 'typo.xlsx' });
assert.ok(typoResult.meta.detectedColumns.includes('FECHA_NACIMIENTO'));
assert.equal(typoResult.registros[0].trabajador.fecha_nacimiento, '19851216');

const STANDARD_HEADER = [
  'DNI/NIE',
  'PRIMER APELLIDO',
  'SEGUNDO APELLIDO',
  'NOMBRE',
  'SEXO',
  'NACIONALIDAD',
  'MUNICIPIO',
  'FECHA NACIMIENTO',
  'NIVEL DE ESTUDIOS',
];

const buffer = buildWorkbookBuffer([
  STANDARD_HEADER,
  ['12345678Z', 'García', 'López', 'Ana', 'Mujer', '724', '46001', '15/03/1990', '3'],
  ['12345678Z', 'Garcia', 'López', 'Anna', 'Mujer', '724', '46002', '15/03/1990', '4'],
  ['X1234567L', 'Pérez', '', 'Juan', 'Hombre', '724', '28001', '01/01/1985', '2'],
  ['INVALIDO', 'Ruiz', '', 'Pedro', 'Hombre', '724', '41001', '01/01/1980', '1'],
]);

const result = processA3WorkerExcel(buffer, { originalFileName: 'test.xlsx' });

assert.equal(result.ok, true);
assert.equal(result.stats.filasValidas, 3);
assert.equal(result.stats.personasConInconsistencias, 1);
assert.equal(result.inconsistencias.length, 1);
assert.equal(result.inconsistencias[0].dni, '12345678Z');
assert.ok(result.inconsistencias[0].conflictos.length >= 1);
assert.ok(result.inconsistencias[0].conflictos[0].camposDistintos.length > 0);
assert.equal(result.descartadas.length, 1);
assert.equal(result.descartadas[0].filaExcel, 5);
assert.ok(!result.warnings.some((w) => w.includes('inconsistencias')));
assert.ok(result.info.some((m) => m.includes('esperado')));

const victor = result.registros.find((r) => r.trabajador.identificador_pfisica === 'X1234567L');
assert.equal(victor.trabajador.fecha_nacimiento, '19850101');
assert.equal(victor.trabajador.ind_incorpora_actividad, 'S');

console.log('OK — Excel A3 fuente parcial + detalle revisión + fechas');
console.log(JSON.stringify(result.stats, null, 2));

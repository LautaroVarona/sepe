import { readFileSync } from 'fs';
import XLSX from 'xlsx';
import { readA3WorkerExcelBuffer } from '../src/lib/a3-worker-excel/reader.js';
import { processA3WorkerExcel } from '../src/lib/a3-worker-excel/process.js';
import { resolveA3WorkerHeader } from '../src/config/a3-worker-excel.js';
import { normalizeFechaYmdFromCell } from '../src/lib/a3-worker-excel/normalize.js';

const path = 'data/PRUEBA EL ALTO.xls';
const buf = readFileSync(path);

const parsed = readA3WorkerExcelBuffer(buf, { headerRow: 1 });
console.log('=== META ===');
console.log(JSON.stringify({
  headerRowUsed: parsed.meta.headerRowUsed,
  detectedColumns: parsed.meta.detectedColumns,
  fechaNacimientoDetectada: parsed.meta.fechaNacimientoDetectada,
  filasConFecha: parsed.meta.filasConFecha,
  filasTotal: parsed.rows.length,
}, null, 2));

const withFecha = parsed.rows.filter((r) => r.record.FECHA_NACIMIENTO);
console.log('rows with fecha:', withFecha.length);
console.log('first 3 with fecha:', withFecha.slice(0, 3).map((r) => ({
  row: r.excelRowNumber,
  dni: r.record.DNI,
  fecha: r.record.FECHA_NACIMIENTO,
})));

const victor = parsed.rows.find((r) =>
  String(r.record.DNI).replace(/\s/g, '').includes('06271886'),
);
console.log('VICTOR:', victor?.record?.FECHA_NACIMIENTO, 'row', victor?.excelRowNumber);

const wb = XLSX.read(buf, { type: 'buffer', cellDates: true, cellNF: true });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rowsFmt = XLSX.utils.sheet_to_json(sheet, {
  header: 1,
  defval: '',
  raw: false,
  dateNF: 'dd/mm/yyyy',
});
const rowsRaw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });

console.log('\n=== HEADER ROWS (first 5) ===');
for (let i = 0; i < 5; i++) {
  console.log(`Row ${i + 1} (${rowsFmt[i]?.length} cols):`, rowsFmt[i]?.slice(0, 15));
}

const hdrIdx = (parsed.meta.headerRowUsed ?? 1) - 1;
const hdr = rowsFmt[hdrIdx] ?? [];
console.log('\n=== FECHA-related headers ===');
hdr.forEach((h, i) => {
  const s = String(h).trim();
  if (/fecha|nac/i.test(s)) {
    console.log(`  col ${i} (${XLSX.utils.encode_col(i)}):`, JSON.stringify(s), '->', resolveA3WorkerHeader(s));
  }
});

let fechaColIdx = -1;
for (let i = 0; i < hdr.length; i++) {
  if (resolveA3WorkerHeader(hdr[i]) === 'FECHA_NACIMIENTO') {
    fechaColIdx = i;
    break;
  }
}
console.log('\nfechaColIdx:', fechaColIdx, XLSX.utils.encode_col(fechaColIdx));

const dataSheetRow = hdrIdx + 1;
for (const excelRow of [dataSheetRow, dataSheetRow + 1, dataSheetRow + 100]) {
  const addr = XLSX.utils.encode_cell({ r: excelRow, c: fechaColIdx });
  const cell = sheet[addr];
  console.log(`\nCell ${addr} (excel row ${excelRow + 1}):`, cell);
  console.log('  format_cell:', cell ? XLSX.utils.format_cell(cell) : 'N/A');
  console.log('  normalizeFechaYmdFromCell:', normalizeFechaYmdFromCell(cell));
  console.log('  rowFmt:', rowsFmt[excelRow]?.[fechaColIdx], typeof rowsFmt[excelRow]?.[fechaColIdx]);
  console.log('  rowRaw:', rowsRaw[excelRow]?.[fechaColIdx], typeof rowsRaw[excelRow]?.[fechaColIdx]);
}

const proc = processA3WorkerExcel(buf);
console.log('\n=== PROCESS sample ===');
const reg = proc.registros?.find((r) =>
  r.trabajador.identificador_pfisica?.includes('06271886'),
);
console.log('victor trabajador fecha:', reg?.trabajador?.fecha_nacimiento);

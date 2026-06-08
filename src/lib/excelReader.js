import XLSX from 'xlsx';
import { ALL_FIELDS, EXCEL_AUX_FIELDS, resolveHeaderToField } from '../config/mapping.js';

const EXCEL_READ_FIELDS = [...ALL_FIELDS, ...EXCEL_AUX_FIELDS];

export function readExcel(filePath, options = {}) {
  const workbook = XLSX.readFile(filePath, { cellDates: true, raw: false });
  return readExcelFromWorkbook(workbook, options);
}

export function readExcelBuffer(buffer, options = {}) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    raw: false,
  });
  return readExcelFromWorkbook(workbook, options);
}

function readExcelFromWorkbook(workbook, { sheetIndex = 0, headerRow = 1 } = {}) {
  const sheetName = workbook.SheetNames[sheetIndex];
  if (!sheetName) {
    throw new Error('El archivo Excel no contiene hojas');
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  if (rows.length < headerRow) {
    throw new Error(`Se esperaba cabecera en la fila ${headerRow}`);
  }

  const rawHeaders = rows[headerRow - 1];
  const { headerIndex, detectedColumns, unknownHeaders } = buildHeaderMap(rawHeaders);

  const dataRows = rows.slice(headerRow);
  const records = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (isEmptyRow(row)) continue;

    const excelRowNumber = headerRow + 1 + i;
    const record = emptyRecord();
    for (const field of EXCEL_READ_FIELDS) {
      const colIdx = headerIndex[field];
      if (colIdx === undefined) continue;
      const cell = row[colIdx];
      record[field] = cell === undefined || cell === null ? '' : cell;
    }
    const codigo =
      record.CODIGO_TRABAJADOR ||
      record.CODIGO_DEL_TRABAJADOR ||
      record.CODIGO_INTERNO_A3 ||
      '';
    if (codigo) {
      record.CODIGO_TRABAJADOR = codigo;
      record.CODIGO_INTERNO_A3 = codigo;
      record.CODIGO_DEL_TRABAJADOR = codigo;
    }
    records.push({ record, excelRowNumber });
  }

  const missingColumns = ALL_FIELDS.filter((f) => !detectedColumns.includes(f));

  return {
    rows: records,
    meta: {
      detectedColumns,
      missingColumns,
      unknownHeaders,
      sheetName,
    },
  };
}

function emptyRecord() {
  const r = {};
  for (const f of EXCEL_READ_FIELDS) r[f] = '';
  return r;
}

function buildHeaderMap(headerRow) {
  const headerIndex = {};
  const detectedColumns = [];
  const unknownHeaders = [];

  headerRow.forEach((h, idx) => {
    const raw = String(h ?? '').trim();
    if (!raw) return;
    const field = resolveHeaderToField(raw);
    if (field) {
      if (headerIndex[field] === undefined) {
        headerIndex[field] = idx;
        detectedColumns.push(field);
      }
    } else {
      unknownHeaders.push(raw);
    }
  });

  return { headerIndex, detectedColumns, unknownHeaders };
}

function isEmptyRow(row) {
  if (!row || row.length === 0) return true;
  return row.every((c) => c === '' || c === null || c === undefined);
}

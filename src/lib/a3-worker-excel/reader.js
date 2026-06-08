import XLSX from 'xlsx';
import {
  A3_WORKER_COLUMNS,
  buildA3PartialColumnMeta,
  resolveA3WorkerHeader,
} from '../../config/a3-worker-excel.js';
import {
  normalizeFechaYmd,
  normalizeFechaYmdFromCell,
} from './normalize.js';

const DATE_COLUMNS = new Set([
  'FECHA_NACIMIENTO',
  'FECHA_INICIO_CONTRATO',
  'FECHA_FIN_CONTRATO',
  'FECHA_INICIO',
  'FECHA_FIN',
]);

const EXCEL_DATE_NF = 'dd/mm/yyyy';
const HEADER_SCAN_ROWS = 10;

export function readA3WorkerExcelBuffer(buffer, { sheetIndex = 0, headerRow = 1 } = {}) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellNF: true,
    raw: false,
  });
  return readA3WorkerExcelWorkbook(workbook, { sheetIndex, headerRow });
}

function getRowCell(row, colIdx) {
  if (row == null) return undefined;
  if (Array.isArray(row)) return row[colIdx];
  return row[colIdx];
}

function pickCellValue(formatted, raw) {
  const hasFormatted =
    formatted !== undefined && formatted !== null && String(formatted).trim() !== '';
  const hasRaw = raw !== undefined && raw !== null && String(raw).trim() !== '';

  if (hasFormatted) return formatted;
  if (hasRaw) return raw;
  return '';
}

function readSheetCell(sheet, rowIndex, colIndex) {
  const addr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
  return sheet[addr] ?? null;
}

function normalizeCellValue(field, sheet, sheetRowIndex, colIndex, formatted, raw) {
  if (DATE_COLUMNS.has(field)) {
    const cell = readSheetCell(sheet, sheetRowIndex, colIndex);
    const fromCell = normalizeFechaYmdFromCell(cell);
    if (fromCell) return fromCell;

    const value = pickCellValue(formatted, raw);
    if (value !== '') {
      const ymd = normalizeFechaYmd(value);
      if (ymd) return ymd;
    }

    if (raw !== undefined && raw !== null && raw !== '' && raw !== value) {
      const ymdRaw = normalizeFechaYmd(raw);
      if (ymdRaw) return ymdRaw;
    }

    return '';
  }

  const value = pickCellValue(formatted, raw);
  if (value === '') return '';
  if (value instanceof Date) return normalizeFechaYmd(value);
  return value;
}

function scoreHeaderRow(headerRow) {
  const { detectedColumns } = buildHeaderMap(headerRow);
  let score = detectedColumns.length;
  if (detectedColumns.includes('DNI')) score += 5;
  if (detectedColumns.includes('NOMBRE')) score += 2;
  if (detectedColumns.includes('PRIMER_APELLIDO')) score += 2;
  if (detectedColumns.includes('FECHA_NACIMIENTO')) score += 4;
  return { score, detectedColumns };
}

function detectHeaderRowIndex(rowsFormatted, preferredHeaderRow) {
  const preferredIdx = preferredHeaderRow - 1;
  let bestIdx = preferredIdx;
  let bestScore = -1;

  const scanUntil = Math.min(HEADER_SCAN_ROWS, rowsFormatted.length);
  for (let i = 0; i < scanUntil; i++) {
    const { score } = scoreHeaderRow(rowsFormatted[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  if (bestScore < 3) return preferredIdx;
  return bestIdx;
}

function resolveHeaderFlexible(raw) {
  const trimmed = String(raw ?? '')
    .trim()
    .replace(/\u00a0/g, ' ')
    .replace(/\uFEFF/g, '');
  if (!trimmed) return null;

  const field = resolveA3WorkerHeader(trimmed);
  if (field) return field;

  const norm = trimmed
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (
    norm.includes('FECHA') &&
    (norm.includes('NACIMIENTO') ||
      norm.includes('NACHIMIENTO') ||
      norm.includes('NAC'))
  ) {
    return 'FECHA_NACIMIENTO';
  }

  return null;
}

function buildHeaderMap(headerRow) {
  const headerIndex = {};
  const detectedColumns = [];
  const unknownHeaders = [];

  headerRow.forEach((h, idx) => {
    const raw = String(h ?? '')
      .trim()
      .replace(/\u00a0/g, ' ')
      .replace(/\uFEFF/g, '');
    if (!raw) return;
    const field = resolveHeaderFlexible(raw);
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

function readA3WorkerExcelWorkbook(workbook, { sheetIndex, headerRow }) {
  const sheetName = workbook.SheetNames[sheetIndex];
  if (!sheetName) {
    throw new Error('El archivo Excel no contiene hojas');
  }

  const sheet = workbook.Sheets[sheetName];

  const rowsFormatted = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    dateNF: EXCEL_DATE_NF,
  });

  const rowsRaw = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });

  if (rowsFormatted.length === 0) {
    throw new Error('El archivo Excel está vacío');
  }

  const headerRowIndex = detectHeaderRowIndex(rowsFormatted, headerRow);

  if (headerRowIndex >= rowsFormatted.length) {
    throw new Error(`Se esperaba cabecera en la fila ${headerRow}`);
  }

  const { headerIndex, detectedColumns, unknownHeaders } = buildHeaderMap(
    rowsFormatted[headerRowIndex],
  );

  const dataRowsFormatted = rowsFormatted.slice(headerRowIndex + 1);
  const dataRowsRaw = rowsRaw.slice(headerRowIndex + 1);
  const rawRows = [];

  let fechasLeidas = 0;
  let filasConFecha = 0;

  for (let i = 0; i < dataRowsFormatted.length; i++) {
    const rowFmt = dataRowsFormatted[i] ?? [];
    const rowRaw = dataRowsRaw[i] ?? [];
    if (isEmptyRow(rowFmt) && isEmptyRow(rowRaw)) continue;

    const excelRowNumber = headerRowIndex + 2 + i;
    const sheetRowIndex = headerRowIndex + 1 + i;
    const record = {};

    for (const col of A3_WORKER_COLUMNS) {
      const colIdx = headerIndex[col];
      if (colIdx === undefined) {
        record[col] = '';
        continue;
      }
      record[col] = normalizeCellValue(
        col,
        sheet,
        sheetRowIndex,
        colIdx,
        getRowCell(rowFmt, colIdx),
        getRowCell(rowRaw, colIdx),
      );
    }

    if (record.FECHA_NACIMIENTO) {
      filasConFecha += 1;
      fechasLeidas += 1;
    }

    rawRows.push({ record, excelRowNumber });
  }

  const columnMeta = buildA3PartialColumnMeta(detectedColumns);

  return {
    rows: rawRows,
    meta: {
      sheetName,
      unknownHeaders,
      headerRowUsed: headerRowIndex + 1,
      fechasLeidas,
      filasConFecha,
      fechaNacimientoDetectada: detectedColumns.includes('FECHA_NACIMIENTO'),
      ...columnMeta,
    },
  };
}

function isEmptyRow(row) {
  if (!row || row.length === 0) return true;
  const cells = Array.isArray(row) ? row : Object.values(row);
  return cells.every((c) => c === '' || c === null || c === undefined);
}

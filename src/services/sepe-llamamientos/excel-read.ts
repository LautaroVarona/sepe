import { readFileSync } from 'node:fs';
import XLSX from 'xlsx';

export function readWorkbookFromPath(filePath: string): XLSX.WorkBook {
  const buf = readFileSync(filePath);
  return XLSX.read(buf, { type: 'buffer', cellDates: true, cellNF: true, raw: false });
}

export function sheetToMatrix(
  workbook: XLSX.WorkBook,
  sheetIndex = 0,
): { sheetName: string; rows: unknown[][] } {
  const sheetName = workbook.SheetNames[sheetIndex];
  if (!sheetName) throw new Error('El archivo no contiene hojas');
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    dateNF: 'yyyy-mm-dd',
  }) as unknown[][];
  return { sheetName, rows };
}

export function normalizeHeaderName(name: unknown): string {
  return String(name ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_');
}

export function cellStr(val: unknown): string {
  if (val === undefined || val === null) return '';
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).trim();
}

export function buildColumnIndex(
  headerRow: unknown[],
  aliases: Record<string, string[]>,
): Record<string, number> {
  const index: Record<string, number> = {};
  headerRow.forEach((h, idx) => {
    const norm = normalizeHeaderName(h);
    for (const [key, names] of Object.entries(aliases)) {
      if (names.some((a) => normalizeHeaderName(a) === norm)) {
        if (index[key] === undefined) index[key] = idx;
      }
    }
  });
  return index;
}

export function getCell(row: unknown[], colIdx: Record<string, number>, key: string): string {
  const idx = colIdx[key];
  if (idx === undefined) return '';
  return cellStr(row[idx]);
}

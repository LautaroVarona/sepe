import XLSX from 'xlsx';

const DNI_NIF_REGEX = /^[0-9]{8}[A-Z]$/;
const DNI_NIE_REGEX = /^[XYZ][0-9]{7}[A-Z]$/;

const SEXO_MAP = new Map([
  ['HOMBRE', '1'],
  ['MUJER', '2'],
]);

const EXCEL_DATE_SERIAL_MIN = 1;
const EXCEL_DATE_SERIAL_MAX = 100000;

export function normalizeString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim().toUpperCase();
}

export function normalizeDni(value) {
  const raw = normalizeString(value).replace(/[\s-]/g, '');
  if (!raw) return { valid: false, normalized: '', reason: 'DNI vacío' };
  if (!DNI_NIF_REGEX.test(raw) && !DNI_NIE_REGEX.test(raw)) {
    return { valid: false, normalized: raw, reason: 'Formato DNI/NIE no válido' };
  }
  return { valid: true, normalized: raw };
}

export function normalizeSexoStore(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (SEXO_MAP.has(upper)) return SEXO_MAP.get(upper);
  if (/^[12]$/.test(raw)) return raw;
  return upper;
}

export function normalizeNss(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return '';
  }
  return String(value).trim().replace(/[\s-]/g, '');
}

export function normalizeIndIncorpora(value) {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === 'S' || v === 'N') return v;
  return 'S';
}

/**
 * Fecha en YYYYMMDD (SEPE, formulario trabajadores, mergeRecord).
 */
export function normalizeFechaYmd(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return '';
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const serial = dateToExcelSerial(value);
    const fromSerial = excelSerialToYmd(serial);
    if (fromSerial) return fromSerial;
    return formatYmdUtc(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return excelSerialToYmd(value);
  }

  let raw = String(value).trim().replace(/\u00a0/g, ' ');

  if (/^\d{8}$/.test(raw)) return raw;

  const isoPrefix = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefix) {
    const y = Number(isoPrefix[1]);
    const m = Number(isoPrefix[2]);
    const d = Number(isoPrefix[3]);
    if (isValidCalendarDate(y, m, d)) {
      return `${y}${isoPrefix[2]}${isoPrefix[3]}`;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw.replace(/-/g, '');
  }

  const slashYmd = parseSlashDate(raw);
  if (slashYmd) return slashYmd;

  const dotYmd = parseDotDate(raw);
  if (dotYmd) return dotYmd;

  const dashYmd = parseDashDate(raw);
  if (dashYmd) return dashYmd;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const ymd = excelSerialToYmd(Number(raw));
    if (ymd) return ymd;
  }

  return '';
}

/** Intenta obtener YYYYMMDD desde una celda Excel cruda. */
export function normalizeFechaYmdFromCell(cell) {
  if (!cell) return '';

  const candidates = [];

  if (cell.w != null && String(cell.w).trim() !== '') {
    candidates.push(String(cell.w).trim());
  }

  try {
    const formatted = XLSX.utils.format_cell(cell);
    if (formatted && String(formatted).trim() !== '') {
      candidates.push(String(formatted).trim());
    }
  } catch {
    /* format_cell puede fallar en celdas raras */
  }

  if (cell.v instanceof Date) {
    candidates.push(cell.v);
  } else if (typeof cell.v === 'number' && Number.isFinite(cell.v)) {
    candidates.push(cell.v);
  } else if (cell.v != null && String(cell.v).trim() !== '') {
    candidates.push(cell.v);
  }

  for (const c of candidates) {
    const ymd = normalizeFechaYmd(c);
    if (ymd) return ymd;
  }

  return '';
}

function parseSlashDate(raw) {
  const cleaned = raw.replace(/\u00a0/g, ' ').trim();
  const m = cleaned.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
  if (!m) return '';

  let dd = Number(m[1]);
  let mm = Number(m[2]);
  let yyyy = Number(m[3]);
  if (yyyy < 100) yyyy += yyyy >= 70 ? 1900 : 2000;

  if (mm > 12 && dd <= 12) {
    [dd, mm] = [mm, dd];
  }

  if (!isValidCalendarDate(yyyy, mm, dd)) return '';
  return `${yyyy}${String(mm).padStart(2, '0')}${String(dd).padStart(2, '0')}`;
}

function parseDotDate(raw) {
  const m = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!m) return '';
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  let yyyy = Number(m[3]);
  if (yyyy < 100) yyyy += yyyy >= 70 ? 1900 : 2000;
  if (!isValidCalendarDate(yyyy, mm, dd)) return '';
  return `${yyyy}${String(mm).padStart(2, '0')}${String(dd).padStart(2, '0')}`;
}

function parseDashDate(raw) {
  const m = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return '';
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!isValidCalendarDate(yyyy, mm, dd)) return '';
  return `${yyyy}${String(mm).padStart(2, '0')}${String(dd).padStart(2, '0')}`;
}

function isValidCalendarDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function isExcelDateSerial(serial) {
  if (!Number.isFinite(serial)) return false;
  const whole = Math.floor(serial);
  return whole >= EXCEL_DATE_SERIAL_MIN && whole <= EXCEL_DATE_SERIAL_MAX;
}

function excelSerialToYmd(serial) {
  if (!isExcelDateSerial(serial)) return '';
  const parsed = XLSX.SSF.parse_date_code(Math.floor(serial));
  if (!parsed?.y || !parsed?.m || !parsed?.d) return '';
  return `${parsed.y}${String(parsed.m).padStart(2, '0')}${String(parsed.d).padStart(2, '0')}`;
}

function dateToExcelSerial(date) {
  const epoch = Date.UTC(1899, 11, 30);
  return Math.round((date.getTime() - epoch) / 86400000);
}

function formatYmdUtc(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

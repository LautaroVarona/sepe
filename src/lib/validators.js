import { ALL_FIELDS, MISSING_PLACEHOLDER } from '../config/mapping.js';

const NIF_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const NIF_REGEX = /^(\d{8}|[XYZ]\d{7})[A-Z]$/i;
const CIF_REGEX = /^[ABCDEFGHJNPQRSUVW]\d{7}[\dA-J]$/i;

function isEmpty(val) {
  return val === undefined || val === null || String(val).trim() === '';
}

export function validateNif(value, { allowCif = true } = {}) {
  if (isEmpty(value)) {
    return { valid: true, normalized: '' };
  }

  const nif = String(value).trim().toUpperCase().replace(/[\s-]/g, '').replace(/^[DEUW](?=[0-9XYZ])/i, '');

  if (NIF_REGEX.test(nif)) {
    const niePrefix = { X: '0', Y: '1', Z: '2' };
    let digits = nif.slice(0, 8);
    const letter = nif[8];
    if (/^[XYZ]/.test(nif)) {
      digits = niePrefix[nif[0]] + nif.slice(1, 8);
    }
    const expected = NIF_LETTERS[parseInt(digits, 10) % 23];
    if (letter !== expected) {
      return { valid: false, error: `Letra de control incorrecta (esperada ${expected})` };
    }
    return { valid: true, normalized: nif };
  }

  if (allowCif && CIF_REGEX.test(nif)) {
    return { valid: true, normalized: nif };
  }

  return { valid: false, error: 'Formato de NIF/NIE/CIF no válido' };
}

export function validateNss(value) {
  if (isEmpty(value)) {
    return { valid: true, normalized: '' };
  }

  const nss = String(value).trim().replace(/[\s-]/g, '');
  if (!/^\d{12}$/.test(nss)) {
    return { valid: false, error: 'NSS debe tener 12 dígitos numéricos' };
  }
  return { valid: true, normalized: nss };
}

export function validateAndFormatDate(value, fieldName) {
  if (isEmpty(value)) {
    return { valid: true, normalized: '' };
  }

  let ymd;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    ymd = formatDateParts(value);
  } else if (typeof value === 'number') {
    const d = excelSerialToDate(value);
    if (!d) {
      return { valid: false, error: `${fieldName}: fecha Excel inválida` };
    }
    ymd = formatDateParts(d);
  } else {
    const raw = String(value).trim();
    if (raw === MISSING_PLACEHOLDER) {
      return { valid: true, normalized: '' };
    }
    if (/^\d{8}$/.test(raw)) {
      ymd = raw;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      ymd = raw.replace(/-/g, '');
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [dd, mm, yyyy] = raw.split('/');
      ymd = `${yyyy}${mm}${dd}`;
    } else {
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        return { valid: false, error: `${fieldName}: formato no reconocido` };
      }
      ymd = formatDateParts(parsed);
    }
  }

  const y = parseInt(ymd.slice(0, 4), 10);
  const m = parseInt(ymd.slice(4, 6), 10);
  const d = parseInt(ymd.slice(6, 8), 10);
  const check = new Date(y, m - 1, d);
  if (
    check.getFullYear() !== y ||
    check.getMonth() !== m - 1 ||
    check.getDate() !== d
  ) {
    return { valid: false, error: `${fieldName}: fecha inválida` };
  }

  return { valid: true, normalized: ymd };
}

function formatDateParts(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function excelSerialToDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function validateIndIncorpora(value) {
  if (isEmpty(value)) {
    return { valid: true, normalized: '' };
  }
  const v = String(value).trim().toUpperCase();
  if (v === 'S' || v === 'N') {
    return { valid: true, normalized: v };
  }
  return { valid: false, error: 'IND_INCORPORA_ACTIVIDAD debe ser S o N' };
}

const FIELD_LABELS = Object.fromEntries(ALL_FIELDS.map((f) => [f, f]));

/**
 * Solo avisos; no bloquea la generación. Campos vacíos o inválidos quedan para rellenar con ???????.
 */
export function validateRecordSoft(record, rowNumber) {
  const warnings = [];
  const out = { ...record };

  const nifEmp = validateNif(out.NIF_EMPRESA, { allowCif: true });
  if (!nifEmp.valid) {
    warnings.push(`Fila ${rowNumber}: NIF_EMPRESA - ${nifEmp.error} (se usará ${MISSING_PLACEHOLDER})`);
    out.NIF_EMPRESA = '';
  } else {
    out.NIF_EMPRESA = nifEmp.normalized;
  }

  const nifTrab = validateNif(out.IDENTIFICADORPFISICA, { allowCif: false });
  if (!nifTrab.valid && !isEmpty(out.IDENTIFICADORPFISICA)) {
    warnings.push(
      `Fila ${rowNumber}: IDENTIFICADORPFISICA - ${nifTrab.error} (se usará ${MISSING_PLACEHOLDER})`,
    );
    out.IDENTIFICADORPFISICA = '';
  } else {
    out.IDENTIFICADORPFISICA = nifTrab.normalized;
  }

  const nss = validateNss(out.NUMERO_SEGURIDAD_SOCIAL);
  if (!nss.valid && !isEmpty(out.NUMERO_SEGURIDAD_SOCIAL)) {
    warnings.push(
      `Fila ${rowNumber}: NUMERO_SEGURIDAD_SOCIAL - ${nss.error} (se usará ${MISSING_PLACEHOLDER})`,
    );
    out.NUMERO_SEGURIDAD_SOCIAL = '';
  } else {
    out.NUMERO_SEGURIDAD_SOCIAL = nss.normalized;
  }

  for (const field of ['FECHA_NACIMIENTO', 'FECHA_INICIO', 'FECHA_FIN']) {
    const r = validateAndFormatDate(out[field], field);
    if (!r.valid) {
      warnings.push(`Fila ${rowNumber}: ${r.error} (se usará ${MISSING_PLACEHOLDER})`);
      out[field] = '';
    } else {
      out[field] = r.normalized;
    }
  }

  if (
    out.FECHA_INICIO &&
    out.FECHA_FIN &&
    out.FECHA_INICIO !== MISSING_PLACEHOLDER &&
    out.FECHA_FIN !== MISSING_PLACEHOLDER &&
    out.FECHA_INICIO > out.FECHA_FIN
  ) {
    const tmp = out.FECHA_INICIO;
    out.FECHA_INICIO = out.FECHA_FIN;
    out.FECHA_FIN = tmp;
    warnings.push(`Fila ${rowNumber}: FECHA_INICIO posterior a FECHA_FIN (fechas invertidas)`);
  }

  const ind = validateIndIncorpora(out.IND_INCORPORA_ACTIVIDAD);
  if (!ind.valid && !isEmpty(out.IND_INCORPORA_ACTIVIDAD)) {
    warnings.push(`Fila ${rowNumber}: ${ind.error} (se usará ${MISSING_PLACEHOLDER})`);
    out.IND_INCORPORA_ACTIVIDAD = '';
  } else {
    out.IND_INCORPORA_ACTIVIDAD = ind.normalized;
  }

  if (!isEmpty(out.CCC)) {
    out.CCC = String(out.CCC).trim().replace(/[\s-]/g, '');
  }

  const missingFields = ALL_FIELDS.filter((f) => isEmpty(out[f]));
  for (const f of missingFields) {
    warnings.push(
      `Fila ${rowNumber}: falta ${FIELD_LABELS[f] ?? f} (en XML: ${MISSING_PLACEHOLDER})`,
    );
  }

  if (
    isEmpty(out.IDENTIFICADORPFISICA) &&
    isEmpty(out.NUMERO_SEGURIDAD_SOCIAL)
  ) {
    warnings.push(
      `Fila ${rowNumber}: sin DNI/NIE ni NSS; revisa el Excel o el registro de trabajadores`,
    );
  }

  return {
    record: out,
    errors: [],
    warnings,
    missingFields,
    complete: missingFields.length === 0,
  };
}

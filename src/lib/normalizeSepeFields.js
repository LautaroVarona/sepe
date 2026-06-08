import { mapNacionalidadToCodigo } from '../config/nacionalidad-codes.js';
import { mapSexoCode } from './parsers/worker-field-extractor.js';
import {
  normalizeFechaYmd as normalizeFechaYmdA3,
  normalizeIndIncorpora as normalizeIndIncorporaA3,
} from './a3-worker-excel/normalize.js';

export { mapNacionalidadToCodigo };

/** Hombre/H/M → 1, Mujer/M → 2 */
export function normalizeSexo(value) {
  return mapSexoCode(value);
}

/** Código numérico INE; default España 724 si vacío. */
export function normalizePaisResidencia(value, defaultCode = '724') {
  const raw = String(value ?? '').trim();
  if (!raw) return defaultCode;

  if (/^\d{3}$/.test(raw)) return raw;

  const mapped = mapNacionalidadToCodigo(raw);
  if (mapped.recognized && /^\d{3}$/.test(mapped.code)) {
    return mapped.code;
  }

  return raw;
}

/** Código municipio INE: solo dígitos. */
export function normalizeMunicipio(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits;
}

/** Fecha en YYYYMMDD. */
export function normalizeFechaYmd(value) {
  return normalizeFechaYmdA3(value);
}

/** S/N; default S. */
export function normalizeIndIncorpora(value) {
  return normalizeIndIncorporaA3(value);
}

const DATE_FIELDS = ['FECHA_NACIMIENTO', 'FECHA_INICIO', 'FECHA_FIN'];

/**
 * Aplica normalizaciones SEPE al registro mergeado.
 * @returns {{ record: object, warnings: string[] }}
 */
export function normalizeRecordForSepe(record) {
  const out = { ...record };
  const warnings = [];

  if (!isEmpty(out.SEXO)) {
    out.SEXO = normalizeSexo(out.SEXO);
  }

  if (!isEmpty(out.NACIONALIDAD)) {
    const mapped = mapNacionalidadToCodigo(out.NACIONALIDAD);
    if (!mapped.recognized) {
      warnings.push(
        `NACIONALIDAD no reconocida: "${out.NACIONALIDAD}" (se mantiene tal cual)`,
      );
    }
    out.NACIONALIDAD = mapped.code;
  }

  out.PAIS_RESIDENCIA = normalizePaisResidencia(out.PAIS_RESIDENCIA);

  if (!isEmpty(out.MUNICIPIO_RESIDENCIA)) {
    out.MUNICIPIO_RESIDENCIA = normalizeMunicipio(out.MUNICIPIO_RESIDENCIA);
  }

  for (const field of DATE_FIELDS) {
    if (!isEmpty(out[field])) {
      const normalized = normalizeFechaYmd(out[field]);
      if (!normalized) {
        warnings.push(`${field}: formato de fecha no reconocido`);
        out[field] = '';
      } else {
        out[field] = normalized;
      }
    }
  }

  out.IND_INCORPORA_ACTIVIDAD = normalizeIndIncorpora(out.IND_INCORPORA_ACTIVIDAD);

  if (isEmpty(out.NUMERO_SEGURIDAD_SOCIAL)) {
    out.NUMERO_SEGURIDAD_SOCIAL = '';
  } else {
    out.NUMERO_SEGURIDAD_SOCIAL = String(out.NUMERO_SEGURIDAD_SOCIAL)
      .trim()
      .replace(/[\s-]/g, '');
  }

  return { record: out, warnings };
}

function isEmpty(val) {
  return val === undefined || val === null || String(val).trim() === '';
}

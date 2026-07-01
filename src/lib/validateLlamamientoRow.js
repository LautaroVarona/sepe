import { normalizeFechaYmd } from './normalizeSepeFields.js';

function isEmpty(val) {
  return val === undefined || val === null || String(val).trim() === '';
}

/**
 * Comprueba que el trabajador exista en el maestro.
 * @returns {{ ok: true } | { ok: false, reason: string, message: string }}
 */
export function validateTrabajadorJoin({ trabajador, record, rowLabel }) {
  const prefix = rowLabel ? `Fila ${rowLabel}: ` : '';

  if (!trabajador) {
    const codigo = record.CODIGO_TRABAJADOR || record.CODIGO_INTERNO_A3 || '';
    const dni = record.IDENTIFICADORPFISICA || '';
    const hint = codigo
      ? `código ${codigo}`
      : dni
        ? `DNI ${dni}`
        : 'sin identificador';
    return {
      ok: false,
      reason: 'no_trabajador',
      message: `${prefix}trabajador no encontrado en maestro (${hint})`,
    };
  }

  return { ok: true };
}

/**
 * Validaciones duras de datos de llamamiento (post-merge).
 * @returns {{ ok: true } | { ok: false, reason: string, message: string }}
 */
export function validateRequiredLlamamiento({ record, rowLabel, movementPair }) {
  const prefix = rowLabel ? `Fila ${rowLabel}: ` : '';

  if (movementPair === 'baja-sin-alta') {
    const fechaFin = normalizeFechaYmd(record.FECHA_FIN);
    if (!fechaFin) {
      return {
        ok: false,
        reason: 'no_fecha_fin',
        message: `${prefix}falta FECHA_FIN obligatoria (Baja sin Alta emparejada)`,
      };
    }
    return { ok: true };
  }

  const fechaInicio = normalizeFechaYmd(record.FECHA_INICIO);
  if (!fechaInicio) {
    return {
      ok: false,
      reason: 'no_fecha_inicio',
      message: `${prefix}falta FECHA_INICIO obligatoria`,
    };
  }

  if (isEmpty(record.CLAVE_CONTRATO_TRANS)) {
    return {
      ok: false,
      reason: 'no_contrato',
      message: `${prefix}falta CLAVE_CONTRATO_TRANS obligatoria`,
    };
  }

  return { ok: true };
}

/**
 * Resume filas descartadas por motivo.
 * @param {Array<{ reason: string }>} discardedRows
 */
export function buildDiscardSummary(discardedRows) {
  const byReason = {};
  for (const row of discardedRows) {
    const key = row.reason ?? 'unknown';
    byReason[key] = (byReason[key] || 0) + 1;
  }
  return {
    discarded: discardedRows.length,
    byReason,
  };
}

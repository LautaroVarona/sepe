function isEmpty(val) {
  return val === undefined || val === null || String(val).trim() === '';
}

/**
 * Normaliza DNI/NIE: quita ceros a la izquierda si lo siguiente es una letra (NIE).
 * Ej: 0Z3160179F → Z3160179F. También 048714799V → 48714799V (DNI con 0 extra).
 */
export function normalizeNieIdentificador(value) {
  let d = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '');
  if (!d) return '';
  if (/^0\d{8}[A-Z]$/.test(d)) d = d.slice(1);
  return d.replace(/^0+(?=[A-Z])/, '');
}

/**
 * Si FECHA_INICIO > FECHA_FIN (YYYYMMDD), intercambia ambas.
 * @returns {{ FECHA_INICIO: string, FECHA_FIN: string, swapped: boolean }}
 */
export function fixFechaChronology(fechaInicio, fechaFin) {
  const inicio = String(fechaInicio ?? '').trim();
  const fin = String(fechaFin ?? '').trim();
  if (
    !inicio ||
    !fin ||
    !/^\d{8}$/.test(inicio) ||
    !/^\d{8}$/.test(fin)
  ) {
    return { FECHA_INICIO: inicio, FECHA_FIN: fin, swapped: false };
  }
  if (inicio > fin) {
    return { FECHA_INICIO: fin, FECHA_FIN: inicio, swapped: true };
  }
  return { FECHA_INICIO: inicio, FECHA_FIN: fin, swapped: false };
}

function truncateNameFields(record) {
  return {
    NOMBRE: String(record.NOMBRE ?? '').substring(0, 15),
    PRIMER_APELLIDO: String(record.PRIMER_APELLIDO ?? '').substring(0, 20),
    SEGUNDO_APELLIDO: String(record.SEGUNDO_APELLIDO ?? '').substring(0, 20),
  };
}

/**
 * Aplica reglas de limpieza a un registro SEPE (post-merge).
 * @returns {{ record: object, warnings: string[] }}
 */
export function cleanLlamamientoRecord(record) {
  const out = { ...record };
  const warnings = [];

  if (!isEmpty(out.IDENTIFICADORPFISICA)) {
    const normalized = normalizeNieIdentificador(out.IDENTIFICADORPFISICA);
    if (normalized !== String(out.IDENTIFICADORPFISICA).trim().toUpperCase().replace(/[\s-]/g, '')) {
      warnings.push(
        `IDENTIFICADORPFISICA normalizado (${out.IDENTIFICADORPFISICA} → ${normalized})`,
      );
    }
    out.IDENTIFICADORPFISICA = normalized;
  }

  const { FECHA_INICIO, FECHA_FIN, swapped } = fixFechaChronology(
    out.FECHA_INICIO,
    out.FECHA_FIN,
  );
  if (swapped) {
    warnings.push('FECHA_INICIO posterior a FECHA_FIN: fechas invertidas automáticamente');
  }
  out.FECHA_INICIO = FECHA_INICIO;
  out.FECHA_FIN = FECHA_FIN;

  const names = truncateNameFields(out);
  out.NOMBRE = names.NOMBRE;
  out.PRIMER_APELLIDO = names.PRIMER_APELLIDO;
  out.SEGUNDO_APELLIDO = names.SEGUNDO_APELLIDO;

  return { record: out, warnings };
}

/**
 * Pipeline inmutable sobre filas del Excel (cada una con .record).
 */
export function cleanLlamamientoRows(rows) {
  return rows
    .map((row) => {
      const { record, warnings } = cleanLlamamientoRecord(row.record ?? row);
      return { ...row, record, cleanWarnings: warnings };
    })
    .filter((row) => {
      const r = row.record ?? {};
      return (
        !isEmpty(r.IDENTIFICADORPFISICA) ||
        !isEmpty(r.FECHA_INICIO) ||
        !isEmpty(r.FECHA_FIN)
      );
    });
}

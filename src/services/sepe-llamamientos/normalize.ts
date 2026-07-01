/** Longitudes máximas según esquema SEPE / XSD */
export const FIELD_LIMITS = {
  NOMBRE: 15,
  PRIMER_APELLIDO: 20,
  SEGUNDO_APELLIDO: 20,
} as const;

export function normalizeNieIdentificador(value: string | undefined | null): string {
  let d = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '');
  if (!d) return '';
  if (/^0\d{8}[A-Z]$/.test(d)) d = d.slice(1);
  return d.replace(/^0+(?=[A-Z])/, '');
}

export function normalizeFechaYmd(value: unknown): string {
  if (value === undefined || value === null || String(value).trim() === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
  const raw = String(value).trim();
  if (/^\d{8}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/-/g, '');
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}${m[2]}${m[1]}`;
  return raw.replace(/\D/g, '').slice(0, 8);
}

export function monthKeyYmd(ymd: string): string {
  return ymd.length >= 6 ? ymd.slice(0, 6) : '';
}

export function fixFechaChronology(
  fechaInicio: string,
  fechaFin: string,
): { FECHA_INICIO: string; FECHA_FIN: string; swapped: boolean } {
  const inicio = String(fechaInicio ?? '').trim();
  const fin = String(fechaFin ?? '').trim();
  if (!/^\d{8}$/.test(inicio) || !/^\d{8}$/.test(fin)) {
    return { FECHA_INICIO: inicio, FECHA_FIN: fin, swapped: false };
  }
  if (inicio > fin) {
    return { FECHA_INICIO: fin, FECHA_FIN: inicio, swapped: true };
  }
  return { FECHA_INICIO: inicio, FECHA_FIN: fin, swapped: false };
}

export function truncateNameFields(record: {
  NOMBRE?: string;
  PRIMER_APELLIDO?: string;
  SEGUNDO_APELLIDO?: string;
}): {
  NOMBRE: string;
  PRIMER_APELLIDO: string;
  SEGUNDO_APELLIDO: string;
} {
  return {
    NOMBRE: String(record.NOMBRE ?? '').substring(0, FIELD_LIMITS.NOMBRE),
    PRIMER_APELLIDO: String(record.PRIMER_APELLIDO ?? '').substring(
      0,
      FIELD_LIMITS.PRIMER_APELLIDO,
    ),
    SEGUNDO_APELLIDO: String(record.SEGUNDO_APELLIDO ?? '').substring(
      0,
      FIELD_LIMITS.SEGUNDO_APELLIDO,
    ),
  };
}

export function normalizeSexo(value: string | undefined): string {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === 'HOMBRE' || v === 'H' || v === '1') return '1';
  if (v === 'MUJER' || v === 'M' || v === '2') return '2';
  if (/^[12]$/.test(v)) return v;
  return v;
}

export function normalizeNss(value: string | undefined): string {
  const raw = String(value ?? '').trim().replace(/[\s-]/g, '');
  if (!raw) return '';
  if (/^\d+$/.test(raw) && raw.length < 12) return raw.padStart(12, '0');
  return raw;
}

/** CNO en export A3: 4 dígitos + espacios hasta 8 */
export function formatCodigoOcupacion(value: string | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';
  return digits.padEnd(8, ' ');
}

export function splitNombreCompleto(nombre: string): {
  nombre: string;
  primerApellido: string;
  segundoApellido: string;
} {
  const parts = nombre.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    return {
      nombre: parts[0] ?? '',
      primerApellido: parts[1] ?? '',
      segundoApellido: parts.slice(2).join(' '),
    };
  }
  if (parts.length === 2) {
    return { nombre: parts[0] ?? '', primerApellido: parts[1] ?? '', segundoApellido: '' };
  }
  return { nombre: parts[0] ?? '', primerApellido: '', segundoApellido: '' };
}

export function parseMovementType(value: string): 'alta' | 'baja' | null {
  const t = value.trim().toUpperCase();
  if (t === 'ALTA' || t.startsWith('ALTA')) return 'alta';
  if (t === 'BAJA' || t.startsWith('BAJA')) return 'baja';
  return null;
}

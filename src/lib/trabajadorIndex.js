/**
 * Índice y búsqueda de trabajadores guardados para completar filas del Excel.
 */

import { normalizeNieIdentificador } from './cleanLlamamientoPipeline.js';

export function normText(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

export function normId(val) {
  return String(val ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/^[DEUW](?=[0-9XYZ])/i, '');
}

export function normNss(val) {
  if (val === undefined || val === null || String(val).trim() === '') {
    return '';
  }
  let raw = val;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    raw = String(Math.round(raw));
  } else {
    raw = String(raw).trim().replace(/[\s-]/g, '');
  }
  if (/^\d+$/.test(raw) && raw.length > 0 && raw.length < 12) {
    return raw.padStart(12, '0');
  }
  return raw;
}

export function personNameKey(nombre, apellido1, apellido2) {
  return normText(
    [nombre, apellido1, apellido2].filter((p) => String(p ?? '').trim()).join(' '),
  );
}

export function workerFullNameKey(t) {
  return personNameKey(t.nombre, t.primer_apellido, t.segundo_apellido);
}

/** Normaliza NSS y nombre del Excel antes de buscar en el maestro. */
export function normalizeExcelRecordForMatch(record) {
  const out = { ...record };
  if (!isEmpty(out.NUMERO_SEGURIDAD_SOCIAL)) {
    out.NUMERO_SEGURIDAD_SOCIAL = normNss(out.NUMERO_SEGURIDAD_SOCIAL);
  }
  for (const f of ['NOMBRE', 'PRIMER_APELLIDO', 'SEGUNDO_APELLIDO']) {
    if (!isEmpty(out[f])) out[f] = normText(out[f]);
  }
  if (!isEmpty(out.IDENTIFICADORPFISICA)) {
    out.IDENTIFICADORPFISICA = normalizeNieIdentificador(out.IDENTIFICADORPFISICA);
  }
  return out;
}

function isEmpty(val) {
  return val === undefined || val === null || String(val).trim() === '';
}

function splitNombreCompleto(nombre) {
  const parts = normText(nombre).split(' ').filter(Boolean);
  if (parts.length >= 3) {
    return {
      nombre: parts[0],
      primer_apellido: parts[1],
      segundo_apellido: parts.slice(2).join(' '),
    };
  }
  if (parts.length === 2) {
    return { nombre: parts[0], primer_apellido: parts[1], segundo_apellido: '' };
  }
  return { nombre: parts[0] ?? '', primer_apellido: '', segundo_apellido: '' };
}

export function excelNameKeys(record) {
  const keys = new Set();
  const direct = personNameKey(
    record.NOMBRE,
    record.PRIMER_APELLIDO,
    record.SEGUNDO_APELLIDO,
  );
  if (direct) keys.add(direct);

  const soloNombre = normText(record.NOMBRE);
  if (soloNombre && isEmpty(record.PRIMER_APELLIDO) && isEmpty(record.SEGUNDO_APELLIDO)) {
    keys.add(soloNombre);
    const split = splitNombreCompleto(record.NOMBRE);
    const splitKey = personNameKey(
      split.nombre,
      split.primer_apellido,
      split.segundo_apellido,
    );
    if (splitKey) keys.add(splitKey);
  }
  return [...keys];
}

export function normCodigo(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';
  if (/^\d+$/.test(raw) && raw.length < 6) {
    return raw.padStart(6, '0');
  }
  return raw;
}

export function buildTrabajadorIndex(trabajadores) {
  const byCodigo = new Map();
  const byDni = new Map();
  const byNss = new Map();
  const byName = new Map();

  for (const t of trabajadores) {
    const codigo = normCodigo(t.codigo_interno_a3);
    if (codigo) byCodigo.set(codigo, t);

    const dni = normId(t.identificador_pfisica);
    if (dni) byDni.set(dni, t);

    const nss = normNss(t.numero_seguridad_social);
    if (nss && nss.length >= 8) byNss.set(nss, t);

    const nameKey = workerFullNameKey(t);
    if (nameKey) {
      if (!byName.has(nameKey)) byName.set(nameKey, []);
      byName.get(nameKey).push(t);
    }
  }

  return { byCodigo, byDni, byNss, byName };
}

function pickUnique(candidates) {
  if (!candidates?.length) return null;
  if (candidates.length === 1) return candidates[0];
  return null;
}

function resolveCodigoFromRecord(record) {
  const codigo = normCodigo(record.CODIGO_TRABAJADOR ?? record.CODIGO_INTERNO_A3);
  return codigo || '';
}

export function findTrabajadorInIndex(index, record) {
  const codigo = resolveCodigoFromRecord(record);
  if (codigo && index.byCodigo?.has(codigo)) {
    return { trabajador: index.byCodigo.get(codigo), matchBy: 'codigo' };
  }

  const dni = normId(record.IDENTIFICADORPFISICA);
  if (dni && index.byDni.has(dni)) {
    return { trabajador: index.byDni.get(dni), matchBy: 'dni' };
  }

  if (!codigo && !dni) {
    const nss = normNss(record.NUMERO_SEGURIDAD_SOCIAL);
    if (nss && index.byNss.has(nss)) {
      return { trabajador: index.byNss.get(nss), matchBy: 'nss' };
    }

    for (const key of excelNameKeys(record)) {
      const candidates = index.byName.get(key);
      const picked = pickUnique(candidates);
      if (picked) return { trabajador: picked, matchBy: 'nombre' };
    }
  }

  return { trabajador: null, matchBy: null };
}

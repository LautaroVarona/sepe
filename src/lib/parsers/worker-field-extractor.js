/**
 * Segmentación y extracción de campos de fichas de trabajador A3 (por etiquetas).
 */
import {
  normalizeLabel,
  softenAcronymsInLabel,
  matchFolded,
  toMatchableText,
} from '../pdf/company-text-normalizer.js';

export const WORKER_MARKER = 'ficha del trabajador';

const NOISE_VALUE =
  /ficha del|datos de|tablas|pagina|listado|observaciones|domicilio del|ampliacion|a3ges|empresa\s*[-–]?\s*\d/i;

const NIF_RE = /\b[0-9]{8}[A-Z]\b|\b[XYZ][0-9]{7}[A-Z]\b/i;
const NSS_RE = /\b\d{2}\s*\d{8}\s*\d{2}\b|\b\d{12}\b/;
const DATE_RE = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/;

export const EMPTY_WORKER_EXTRACTED = () => ({
  codigoInterno: '',
  nifNie: '',
  nombreCompleto: '',
  nombre: '',
  primerApellido: '',
  segundoApellido: '',
  numeroSeguridadSocial: '',
  sexo: '',
  fechaNacimiento: '',
  nacionalidad: '',
  municipio: '',
  pais: '',
  estadoCivil: '',
  numeroHijos: '',
  domicilio: '',
  categoria: '',
  puestoTrabajo: '',
  grupoTarifa: '',
  codigoOcupacion: '',
  nivelFormativo: '',
  tipoContrato: '',
  fechaInicioContrato: '',
  fechaFinContrato: '',
  codigoEmpresaA3: '',
  nombreEmpresa: '',
});

const LABEL_TO_FIELD = [
  ['codigo del trabajador', 'codigoInterno'],
  ['codigo trabajador', 'codigoInterno'],
  ['n i f', 'nifNie'],
  ['n i f n i e', 'nifNie'],
  ['nif nie', 'nifNie'],
  ['nombre del trabajador', 'nombre'],
  ['nombre trabajador', 'nombre'],
  ['nombre completo', 'nombreCompleto'],
  ['nombre', 'nombre'],
  ['primer apellido', 'primerApellido'],
  ['segundo apellido', 'segundoApellido'],
  ['apellido 1', 'primerApellido'],
  ['apellido 2', 'segundoApellido'],
  ['numero de la seguridad social', 'numeroSeguridadSocial'],
  ['numero seguridad social', 'numeroSeguridadSocial'],
  ['n seg social', 'numeroSeguridadSocial'],
  ['nss', 'numeroSeguridadSocial'],
  ['sexo', 'sexo'],
  ['fecha nacimiento', 'fechaNacimiento'],
  ['fecha de nacimiento', 'fechaNacimiento'],
  ['nacionalidad', 'nacionalidad'],
  ['municipio', 'municipio'],
  ['pais', 'pais'],
  ['pais de residencia', 'pais'],
  ['municipio de residencia', 'municipio'],
  ['estado civil', 'estadoCivil'],
  ['numero de hijos', 'numeroHijos'],
  ['num hijos', 'numeroHijos'],
  ['domicilio', 'domicilio'],
  ['categoria', 'categoria'],
  ['puesto de trabajo', 'puestoTrabajo'],
  ['puesto trabajo', 'puestoTrabajo'],
  ['grupo tarifa', 'grupoTarifa'],
  ['codigo ocupacion', 'codigoOcupacion'],
  ['codigo de ocupacion', 'codigoOcupacion'],
  ['nivel formativo', 'nivelFormativo'],
  ['tipo de contrato', 'tipoContrato'],
  ['tipo contrato', 'tipoContrato'],
  ['fecha inicio', 'fechaInicioContrato'],
  ['fecha inicio contrato', 'fechaInicioContrato'],
  ['fecha fin', 'fechaFinContrato'],
  ['fecha fin contrato', 'fechaFinContrato'],
  ['fecha finalizacion', 'fechaFinContrato'],
];

const LABEL_MAP = new Map(
  LABEL_TO_FIELD.map(([label, key]) => [label, key]),
);

function resolveLabel(rawLabel) {
  const norm = normalizeLabel(softenAcronymsInLabel(rawLabel));
  if (LABEL_MAP.has(norm)) return LABEL_MAP.get(norm);
  for (const [label, key] of LABEL_MAP) {
    if (norm.startsWith(label) || norm.includes(label)) return key;
  }
  return null;
}

function cleanValue(val) {
  return String(val ?? '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s:]+/, '')
    .trim();
}

function isNoiseValue(value) {
  const v = String(value ?? '').trim();
  if (!v || v.length > 200) return true;
  if (NOISE_VALUE.test(v)) return true;
  return false;
}

/** DD/MM/YYYY → YYYYMMDD */
export function formatDateYmd(raw) {
  const v = cleanValue(raw);
  const m = v.match(DATE_RE);
  if (!m) return v.replace(/\D/g, '').length === 8 ? v.replace(/\D/g, '') : '';
  let [, d, mo, y] = m;
  if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`;
  return `${y}${mo.padStart(2, '0')}${d.padStart(2, '0')}`;
}

/** H / M / Hombre / Mujer → 1 / 2 */
export function mapSexoCode(raw) {
  const v = cleanValue(raw).toUpperCase();
  if (!v) return '';
  if (v === '1' || v.startsWith('H')) return '1';
  if (v === '2' || v.startsWith('M')) return '2';
  return '';
}

export function normalizeNif(raw) {
  return cleanValue(raw).toUpperCase().replace(/[\s.-]/g, '');
}

export function normalizeNss(raw) {
  return cleanValue(raw).replace(/\D/g, '').slice(0, 12);
}

export function splitNombreCompleto(full) {
  const parts = cleanValue(full).split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { nombre: '', primerApellido: '', segundoApellido: '' };
  }
  if (parts.length === 1) {
    return { nombre: parts[0], primerApellido: '', segundoApellido: '' };
  }
  if (parts.length === 2) {
    return { nombre: parts[0], primerApellido: parts[1], segundoApellido: '' };
  }
  if (parts.length === 3) {
    return {
      nombre: parts[0],
      primerApellido: parts[1],
      segundoApellido: parts[2],
    };
  }
  return {
    nombre: parts.slice(0, -2).join(' '),
    primerApellido: parts[parts.length - 2],
    segundoApellido: parts[parts.length - 1],
  };
}

function splitCells(line) {
  if (line.includes('\t')) {
    return line.split('\t').map((c) => c.trim());
  }
  const colon = line.match(/^(.+?)\s*:\s*(.*)$/);
  if (colon) return [colon[1].trim(), colon[2].trim()];
  const gap = line.match(/^(.+?)\s{2,}(.+)$/);
  if (gap) return [gap[1].trim(), gap[2].trim()];
  return [line.trim()];
}

function applyField(result, key, value) {
  const v = cleanValue(value);
  if (!v || isNoiseValue(v)) return;

  switch (key) {
    case 'nifNie': {
      const nif = v.match(NIF_RE)?.[0];
      if (nif) result.nifNie = normalizeNif(nif);
      break;
    }
    case 'numeroSeguridadSocial': {
      const nss = v.match(NSS_RE)?.[0] ?? v.replace(/\D/g, '');
      if (nss.length >= 10) result.numeroSeguridadSocial = normalizeNss(nss);
      break;
    }
    case 'sexo':
      result.sexo = mapSexoCode(v);
      break;
    case 'fechaNacimiento':
    case 'fechaInicioContrato':
    case 'fechaFinContrato': {
      const ymd = formatDateYmd(v);
      if (ymd) result[key] = ymd;
      break;
    }
    case 'numeroHijos':
      result.numeroHijos = v.replace(/\D/g, '') || v;
      break;
    default:
      if (!result[key]?.trim()) result[key] = v;
  }
}

function parseLines(block) {
  const result = EMPTY_WORKER_EXTRACTED();
  const lines = block.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const cells = splitCells(line);
    if (cells.length >= 2) {
      for (let i = 0; i < cells.length - 1; i += 2) {
        const key = resolveLabel(cells[i]);
        if (key) applyField(result, key, cells[i + 1]);
      }
      continue;
    }

    const colon = line.match(/^(.+?)\s*:\s*(.+)$/);
    if (colon) {
      const key = resolveLabel(colon[1]);
      if (key) applyField(result, key, colon[2]);
    }
  }

  return result;
}

/** Cabecera «Trabajador 12345 - APELLIDOS, NOMBRE» */
function parseWorkerHeader(block, result) {
  const folded = toMatchableText(block.slice(0, 1200));
  const trabMatch = folded.match(
    /trabajador\s+(\d+)\s*[-–]\s*([^.\n]+?)(?=\s+empresa|\s+fecha|\s+pagina|\s+ficha|\n|$)/i,
  );
  if (trabMatch) {
    if (!result.codigoInterno) result.codigoInterno = trabMatch[1].trim();
    const namePart = block.match(
      /trabajador\s+\d+\s*[-–]\s*(.+?)(?=\s+empresa|\s+Fecha|\s+Página|\n)/i,
    );
    if (namePart && !result.nombreCompleto) {
      let name = namePart[1].trim();
      if (name.includes(',')) {
        const [apellidos, nombre] = name.split(',').map((s) => s.trim());
        result.nombreCompleto = `${nombre} ${apellidos}`.trim();
      } else {
        result.nombreCompleto = name;
      }
    }
  }

  const empMatch = block.match(
    /empresa\s*[-–]?\s*(\d+)\s*[-–]\s*([^\n]+)/i,
  );
  if (empMatch) {
    result.codigoEmpresaA3 = empMatch[1].trim();
    result.nombreEmpresa = empMatch[2].trim();
  }
}

function mergeNameFields(result) {
  if (result.nombreCompleto?.trim() && !result.nombre?.trim()) {
    if (result.primerApellido?.trim()) {
      result.nombre = result.nombreCompleto.trim();
    } else {
      const split = splitNombreCompleto(result.nombreCompleto);
      result.nombre = split.nombre;
      if (!result.primerApellido?.trim()) result.primerApellido = split.primerApellido;
      if (!result.segundoApellido?.trim()) result.segundoApellido = split.segundoApellido;
    }
  }
  if (
    result.nombre?.trim() &&
    !result.primerApellido?.trim() &&
    result.nombre.includes(' ')
  ) {
    const split = splitNombreCompleto(result.nombre);
    result.nombre = split.nombre;
    result.primerApellido = split.primerApellido;
    result.segundoApellido = split.segundoApellido;
  }
}

function scanOrphanPatterns(block, result) {
  if (!result.nifNie) {
    const nif = block.match(NIF_RE)?.[0];
    if (nif) result.nifNie = normalizeNif(nif);
  }
  if (!result.numeroSeguridadSocial) {
    const nss = block.match(NSS_RE)?.[0];
    if (nss) result.numeroSeguridadSocial = normalizeNss(nss);
  }
}

/**
 * Divide el texto normalizado en bloques (uno por trabajador).
 */
export function segmentWorkerBlocks(normalizedText) {
  const text = normalizedText ?? '';
  const markerRe = /ficha\s+del\s+trabajador/gi;
  const indices = [];
  let m;
  while ((m = markerRe.exec(text)) !== null) {
    indices.push(m.index);
  }

  if (indices.length === 0) {
    const alt = text.split(/(?=trabajador\s+\d+\s*[-–])/i).filter((b) => b.trim().length > 80);
    if (alt.length > 1) return alt;
    return text.trim() ? [text] : [];
  }

  const blocks = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = indices[i + 1] ?? text.length;
    blocks.push(text.slice(start, end));
  }
  return blocks;
}

/**
 * @param {string} block Texto de un trabajador (filiación + contrato).
 */
export function extractWorkerFields(block) {
  const result = parseLines(block ?? '');
  parseWorkerHeader(block, result);
  scanOrphanPatterns(block, result);
  mergeNameFields(result);

  if (result.sexo && result.sexo.length > 1) {
    result.sexo = mapSexoCode(result.sexo);
  }

  return result;
}

/** ¿Parece un PDF de fichas de trabajador A3? */
export function isA3WorkerFicha(text) {
  return matchFolded(text, /ficha\s+del\s+trabajador/) !== null;
}

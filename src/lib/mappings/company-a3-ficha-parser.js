/**
 * Parser específico para «Ficha de empresa» exportada desde A3.
 * Soporta layout de dos columnas (celdas separadas por tabulador).
 */
import {
  normalizeLabel,
  softenAcronymsInLabel,
} from '../pdf/company-text-normalizer.js';
import {
  parseA3FichaInlineText,
  looksLikeNif,
  findNifInText,
} from './company-a3-inline-parser.js';
const EMPTY_ADDRESS = () => ({
  sigla: '',
  via: '',
  numero: '',
  escalera: '',
  piso: '',
  puerta: '',
  municipio: '',
  provincia: '',
  codigoPostal: '',
});

const NOISE_VALUE =
  /domicilio|tablas|ampliacion|a3ges|conceptos|imputacion|identificacion|ficha de|listado|pagina|observaciones/i;

const LABEL_TO_FIELD = [
  ['codigo de la empresa', 'codigoEmpresaA3', 'simple'],
  ['nombre de la empresa', 'nombreEmpresa', 'simple'],
  ['n i f c i f de la empresa', 'nifEmpresa', 'simple'],
  ['nif cif de la empresa', 'nifEmpresa', 'simple'],
  ['sigla', 'sigla', 'address'],
  ['via publica', 'via', 'address'],
  ['numero', 'numero', 'address'],
  ['esc', 'escalera', 'address'],
  ['escalera', 'escalera', 'address'],
  ['piso puerta', 'piso', 'address'],
  ['puerta', 'puerta', 'address'],
  ['municipio', 'municipio', 'address'],
  ['provincia', 'provincia', 'address'],
  ['cod postal', 'codigoPostal', 'address'],
  ['codigo postal', 'codigoPostal', 'address'],
  ['telefono', 'telefono', 'simple'],
  ['e mail', 'email', 'simple'],
  ['email', 'email', 'simple'],
  ['fecha alta empresa', 'fechaAltaEmpresa', 'simple'],
  ['tipo de pago i r p f', 'tipoPagoIRPF', 'simple'],
  ['tipo de pago irpf', 'tipoPagoIRPF', 'simple'],
  ['codigo centro gestion', 'codigoCentroGestion', 'simple'],
  ['tipo de empresario', 'tipoEmpresario', 'simple'],
];

const LABEL_MAP = new Map(
  LABEL_TO_FIELD.map(([label, key, kind]) => [
    label,
    { key, kind },
  ]),
);

function resolveA3Label(rawLabel) {
  let norm = normalizeLabel(softenAcronymsInLabel(rawLabel));
  if (LABEL_MAP.has(norm)) return LABEL_MAP.get(norm);
  if (norm === 'piso' || norm.startsWith('piso ')) {
    return LABEL_MAP.get('piso puerta') ?? { key: 'piso', kind: 'address' };
  }
  for (const [label, meta] of LABEL_MAP) {
    if (norm === label) return meta;
  }
  return null;
}

function isNoiseValue(value) {
  const v = String(value ?? '').trim();
  if (!v || v.length > 120) return true;
  if (NOISE_VALUE.test(v)) return true;
  if (/^datos\s/i.test(v)) return true;
  return false;
}

function cleanValue(val) {
  return String(val ?? '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s:]+/, '')
    .trim();
}

function looksLikeEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

function looksLikePhone(val) {
  const d = val.replace(/\D/g, '');
  return d.length >= 9 && d.length <= 15;
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

function applyField(result, meta, value, addressTarget) {
  const v = cleanValue(value);
  if (!v || isNoiseValue(v)) return;

  if (meta.kind === 'simple') {
    if (meta.key === 'nifEmpresa') {
      if (!looksLikeNif(v)) return;
      result.nifEmpresa = v.toUpperCase().replace(/\s/g, '');
      return;
    }
    if (meta.key === 'nombreEmpresa') {
      if (
        looksLikeNif(v) ||
        NOISE_VALUE.test(v) ||
        /n\s*i\s*f|cif de la empresa/i.test(v)
      ) {
        return;
      }
      result.nombreEmpresa = v;
      return;
    }
    if (meta.key === 'email') {
      if (!looksLikeEmail(v)) return;
      result.email = v;
      return;
    }
    if (meta.key === 'telefono') {
      if (!looksLikePhone(v)) return;
      if (!result.telefono) result.telefono = v.replace(/\D/g, '').slice(-9);
      return;
    }
    if (meta.key === 'codigoEmpresaA3') {
      if (!/^\d{3,8}$/.test(v)) return;
    }
    if (!result[meta.key]) result[meta.key] = v;
    return;
  }

  if (meta.kind === 'address' && addressTarget) {
    if (meta.key === 'piso') addressTarget.piso = v;
    else if (!addressTarget[meta.key]) addressTarget[meta.key] = v;
  }
}

function applyLabelValuePair(label, value, result, addressSide) {
  const meta = resolveA3Label(label);
  if (!meta) return;
  const addr =
    addressSide === 'fiscal'
      ? result.domicilioFiscal
      : addressSide === 'envio'
        ? result.domicilioEnvio
        : null;
  applyField(result, meta, value, addr);
}

function extractHeader(result, text) {
  const patterns = [
    /empresa\s*[-–]\s*(\d{3,8})\s+(.+?)(?=\s+fecha\s+listado|\n)/is,
    /(?:empresa\s+)?(\d{3,8})\s*[-–]\s*([^\n\t]+)/i,
    /(\d{3,8})\s*[-–]\s*(EL\s+[^\n\t]+|[^\n\t]{3,})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      if (!result.codigoEmpresaA3) result.codigoEmpresaA3 = m[1].trim();
      if (!result.nombreEmpresa) result.nombreEmpresa = cleanValue(m[2]);
      return;
    }
  }
}

function getIdentificacionBlock(text) {
  const m = text.match(
    /datos de identificaci[oó]n de la empresa([\s\S]*?)(?=domicilio envio|domicilio fiscal|tablas\b)/i,
  );
  return m?.[1] ?? '';
}

function looksLikeLabelLine(line) {
  const norm = normalizeLabel(softenAcronymsInLabel(line));
  if (lineMode(norm)) return true;
  return resolveA3Label(line) !== null || /^datos de/i.test(norm);
}

/**
 * Bloque «Datos de identificación»: etiqueta y valor a menudo en líneas distintas.
 */
export function extractIdentificacionFields(text) {
  const block = getIdentificacionBlock(text);
  const fields = {
    codigoEmpresaA3: '',
    nombreEmpresa: '',
    nifEmpresa: '',
  };
  if (!block) return fields;

  const identDual = block.match(
    /c[oó]digo\s+de\s+la\s+empresa\s+nombre\s+de\s+la\s+empresa\s+(\d{3,8})\s+(.+?)(?=\s*n\.?\s*i\.?\s*f|\n|$)/is,
  );
  if (identDual) {
    fields.codigoEmpresaA3 = identDual[1].trim();
    const name = cleanValue(identDual[2]);
    if (name && !looksLikeNif(name)) fields.nombreEmpresa = name;
  }

  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('\t')) {
      const cells = line.split('\t').map((c) => c.trim()).filter((c) => c !== '');
      if (cells.length >= 2) {
        applyLabelValuePair(cells[0], cells[1], fields, null);
      }
      continue;
    }

    const colon = line.match(/^(.+?)\s*:\s*(.+)$/);
    if (colon) {
      applyLabelValuePair(colon[1], colon[2], fields, null);
      continue;
    }

    const meta = resolveA3Label(line);
    if (
      meta?.kind === 'simple' &&
      ['codigoEmpresaA3', 'nombreEmpresa', 'nifEmpresa'].includes(meta.key)
    ) {
      const next = lines[i + 1] ?? '';
      if (next && !looksLikeLabelLine(next)) {
        applyLabelValuePair(line, next, fields, null);
        i++;
      }
      continue;
    }

    if (/^\d{3,8}$/.test(line) && !fields.codigoEmpresaA3) {
      fields.codigoEmpresaA3 = line;
    }
  }

  const flat = block.replace(/\s+/g, ' ');
  if (!fields.codigoEmpresaA3) {
    const cm = flat.match(
      /codigo\s+de\s+la\s+empresa\s*[:\s]*(\d{3,8})\b/i,
    );
    if (cm) fields.codigoEmpresaA3 = cm[1];
  }
  if (!fields.nombreEmpresa && identDual) {
    fields.nombreEmpresa = cleanValue(identDual[2]);
  }
  if (!fields.nifEmpresa) {
    fields.nifEmpresa = findNifInText(flat);
  }

  return fields;
}

function lineMode(normLine) {
  if (/^datos de identificacion/.test(normLine)) return 'ident';
  if (/^domicilio envio/.test(normLine) || /^domicilio fiscal/.test(normLine)) {
    return 'address';
  }
  if (/^enlace con a3ges/.test(normLine)) return 'a3ges';
  if (/^datos varios/.test(normLine)) return 'varios';
  if (/^datos de ampliacion/.test(normLine)) return 'skip';
  if (/^tablas$/.test(normLine) || /^conceptos$/.test(normLine)) return 'tablas';
  return null;
}

/**
 * @param {string} text — texto normalizado del PDF
 */
const emptyResult = () => ({
  codigoEmpresaA3: '',
  nombreEmpresa: '',
  nifEmpresa: '',
  telefono: '',
  email: '',
  fechaAltaEmpresa: '',
  tipoPagoIRPF: '',
  codigoCentroGestion: '',
  tipoEmpresario: '',
  ccc: '',
  domicilioFiscal: EMPTY_ADDRESS(),
  domicilioEnvio: EMPTY_ADDRESS(),
});

function mergeSimpleFields(target, source) {
  for (const key of [
    'codigoEmpresaA3',
    'nombreEmpresa',
    'nifEmpresa',
    'telefono',
    'email',
    'fechaAltaEmpresa',
    'tipoPagoIRPF',
    'codigoCentroGestion',
    'tipoEmpresario',
    'ccc',
  ]) {
    if (!target[key]?.trim() && source[key]?.trim()) target[key] = source[key];
  }
}

export function extractA3FichaCompany(text) {
  const result = emptyResult();

  parseA3FichaInlineText(text, result);
  extractHeader(result, text);
  mergeSimpleFields(result, extractIdentificacionFields(text));

  let mode = 'header';
  let dualAddress = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const cells = splitCells(line);
    const normFull = normalizeLabel(line);

    const newMode = lineMode(normFull);
    if (newMode === 'skip') {
      mode = 'skip';
      continue;
    }
    if (newMode === 'tablas') {
      mode = 'tablas';
      continue;
    }
    if (newMode) {
      mode = newMode;
      if (mode === 'address') {
        dualAddress =
          cells.length >= 2 &&
          /domicilio envio/i.test(cells[0]) &&
          /domicilio fiscal/i.test(cells[1] ?? cells[0]);
      }
      if (mode === 'address' && cells.length >= 2 && dualAddress) continue;
    }

    if (mode === 'skip' || mode === 'tablas') continue;

    const IDENT_SIMPLE = new Set(['codigoEmpresaA3', 'nombreEmpresa', 'nifEmpresa']);

    if (cells.length >= 2) {
      const identMeta = resolveA3Label(cells[0]);
      if (identMeta?.kind === 'simple' && IDENT_SIMPLE.has(identMeta.key)) {
        applyLabelValuePair(cells[0], cells[1], result, null);
        continue;
      }
    }

    if (cells.length >= 4 && (mode === 'address' || dualAddress)) {
      applyLabelValuePair(cells[0], cells[1], result, 'envio');
      applyLabelValuePair(cells[2], cells[3], result, 'fiscal');
      continue;
    }

    if (cells.length >= 2) {
      const label = cells[0];
      const value = cells[1];
      const normLabel = normalizeLabel(softenAcronymsInLabel(label));

      if (mode === 'ident') {
        applyLabelValuePair(label, value, result, null);
        continue;
      }
      if (mode === 'address') {
        if (/domicilio (envio|fiscal)/i.test(label)) continue;
        let side = 'envio';
        if (/telefono/i.test(normLabel)) side = 'fiscal';
        else if (/e mail|email/i.test(normLabel)) side = 'envio';
        else if (/domicilio fiscal/i.test(normLabel)) side = 'fiscal';
        applyLabelValuePair(label, value, result, side);
        continue;
      }
      if (mode === 'a3ges' || mode === 'varios') {
        applyLabelValuePair(label, value, result, null);
        continue;
      }
    }

    if (mode === 'ident' && cells.length === 1) {
      const colon = line.match(/^(.+?)\s*:\s*(.+)$/);
      if (colon) applyLabelValuePair(colon[1], colon[2], result, null);
    }
  }

  if (!result.telefono && looksLikePhone(result.domicilioFiscal?.telefono ?? '')) {
    result.telefono = result.domicilioFiscal.telefono;
  }
  if (!result.email && looksLikeEmail(result.domicilioEnvio?.email ?? '')) {
    result.email = result.domicilioEnvio.email;
  }

  const contactZone = text.slice(
    0,
    text.search(/tablas|datos de ampliacion/i) > 0
      ? text.search(/tablas|datos de ampliacion/i)
      : text.length,
  );
  if (!result.email) {
    const emailMatch = contactZone.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    );
    if (emailMatch) result.email = emailMatch[0];
  }
  if (!result.nifEmpresa) {
    const identEnd = contactZone.search(/domicilio\s+envio|domicilio\s+fiscal/i);
    const identZone =
      identEnd > 0 ? contactZone.slice(0, identEnd) : contactZone.slice(0, 1200);
    result.nifEmpresa = findNifInText(identZone);
  }

  return result;
}

/** Indica si el texto parece una ficha A3 (para priorizar este parser). */
export function isA3FichaEmpresa(text) {
  const t = normalizeLabel(text);
  return (
    t.includes('ficha de empresa') ||
    t.includes('datos de identificacion de la empresa') ||
    (t.includes('domicilio envio') && t.includes('domicilio fiscal'))
  );
}

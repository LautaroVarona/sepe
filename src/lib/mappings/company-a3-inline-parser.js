/**
 * Parser para texto de ficha A3 (layout inline / Ctrl+C / pdf-parse).
 */
import {
  matchFolded,
  toMatchableText,
} from '../pdf/company-text-normalizer.js';

const NIF_PATTERN =
  /\b([abcdefghjklmnprsuvw])\s*(\d{7,8})\s*([0-9a-j])?\b/gi;
const PAGE_FOOTER = /^--\s*\d+\s+of\s+\d+\s*--$/i;

function cleanValue(val) {
  return String(val ?? '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s:]+/, '')
    .trim();
}

export function looksLikeNif(val) {
  const v = String(val).replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]\d{7,8}[A-Z0-9]?$/.test(v)) return false;
  if (/^DOMICILIO|ENVIO|FISCAL|TABLAS|EMPRESA$/i.test(v)) return false;
  return true;
}

export function findNifInText(text) {
  const folded = toMatchableText(text);
  const matches = [...folded.matchAll(NIF_PATTERN)];
  for (const m of matches) {
    const candidate = `${m[1]}${m[2]}${m[3] ?? ''}`.toUpperCase();
    if (looksLikeNif(candidate)) return candidate;
  }
  const tight = [...text.matchAll(/\b([ABCDEFGHJKLMNPQRSUVW]\d{7,8}[0-9A-J])\b/gi)];
  for (const m of tight) {
    const candidate = m[1].toUpperCase();
    if (looksLikeNif(candidate)) return candidate;
  }
  return '';
}

function restoreNombreFromOriginal(text) {
  const header = text.match(
    /empresa\s*[-–]\s*\d{3,8}\s+(.+?)(?=\s+fecha\s+listado|\n|domicilio)/is,
  );
  if (header) return cleanValue(header[1]);

  const sl = text.match(
    /\b([A-ZÁÉÍÓÚ][A-Za-záéíóúñ0-9\s,.ºª-]{3,60}?\s+S\.?\s*L\.?)\b/i,
  );
  if (sl) return cleanValue(sl[1]);

  return '';
}

function isGarbageValue(val) {
  const v = cleanValue(val);
  if (!v || PAGE_FOOTER.test(v)) return true;
  if (/^--|of\s+\d+$/i.test(v)) return true;
  if (/^(domicilio|envio|fiscal|tablas|pagina|observaciones)$/i.test(v)) return true;
  return false;
}

/** Si ya tenemos NIF, inferir código y nombre en la ventana anterior. */
export function inferIdentFromContext(text, knownNif) {
  const folded = toMatchableText(text);
  const nif = knownNif.toLowerCase();
  const nifPos = folded.indexOf(nif);
  if (nifPos < 0) return {};

  const before = folded.slice(Math.max(0, nifPos - 800), nifPos);
  const out = { codigoEmpresaA3: '', nombreEmpresa: '' };

  const dual = before.match(
    /codigo\s+de\s+la\s+empresa\s+nombre\s+de\s+la\s+empresa\s+(\d{3,8})\s+(.+)$/i,
  );
  if (dual) {
    out.codigoEmpresaA3 = dual[1];
    out.nombreEmpresa = cleanValue(dual[2]);
    return out;
  }

  const codigoLabel = before.match(/codigo\s+de\s+la\s+empresa\s+(\d{3,8})\b/i);
  if (codigoLabel) out.codigoEmpresaA3 = codigoLabel[1];

  const nombreLabel = before.match(
    /nombre\s+de\s+la\s+empresa\s+(.+)$/i,
  );
  if (nombreLabel) {
    const name = cleanValue(nombreLabel[1]);
    if (name && !looksLikeNif(name)) out.nombreEmpresa = name;
  }

  if (!out.codigoEmpresaA3) {
    const nums = [...before.matchAll(/\b(\d{4,8})\b/g)];
    for (let i = nums.length - 1; i >= 0; i--) {
      const n = nums[i][1];
      if (n.length >= 4 && !/^20\d{2}$/.test(n) && n !== '46002') {
        out.codigoEmpresaA3 = n;
        break;
      }
    }
  }

  if (!out.nombreEmpresa && out.codigoEmpresaA3) {
    const afterCode = before.match(
      new RegExp(`${out.codigoEmpresaA3}\\s+(.+)$`, 'i'),
    );
    if (afterCode) {
      const name = cleanValue(afterCode[1]);
      if (name && !looksLikeNif(name) && name.length > 3) out.nombreEmpresa = name;
    }
  }

  const sl = text.match(
    /([A-ZÁÉÍÓÚ][A-Za-záéíóúñ0-9\s,.ºª-]{4,}?\s+S\.?\s*L\.?)/i,
  );
  if (sl && !out.nombreEmpresa) out.nombreEmpresa = cleanValue(sl[1]);

  return out;
}

export function parseA3FichaInlineText(text, result) {
  const t = text ?? '';
  const flat = toMatchableText(t).replace(/\n/g, ' ');

  const header = matchFolded(
    t,
    /empresa\s*[-–]\s*(\d{3,8})\s+(.+?)(?=\s+fecha\s+listado|\n|domicilio)/is,
  );
  if (header) {
    result.codigoEmpresaA3 = header[1].trim();
    result.nombreEmpresa = cleanValue(header[2]);
  }

  const headerAlt = matchFolded(
    t,
    /empresa\s+(\d{3,8})\s*[-–]\s*(.+?)(?=\s+fecha\s+listado|\n|domicilio)/is,
  );
  if (headerAlt) {
    if (!result.codigoEmpresaA3) result.codigoEmpresaA3 = headerAlt[1].trim();
    if (!result.nombreEmpresa) result.nombreEmpresa = cleanValue(headerAlt[2]);
  }

  const identDual = flat.match(
    /codigo\s+de\s+la\s+empresa\s+nombre\s+de\s+la\s+empresa\s+(\d{3,8})\s+(.+?)(?=\s*n[\s./]*i[\s./]*f|\s*domicilio|$)/i,
  );
  if (identDual) {
    result.codigoEmpresaA3 = identDual[1].trim();
    const name = cleanValue(identDual[2]);
    if (name && !looksLikeNif(name) && !isGarbageValue(name)) {
      result.nombreEmpresa = name;
    }
  }

  const codigoSolo = flat.match(/codigo\s+de\s+la\s+empresa\s+(\d{3,8})\b/i);
  if (codigoSolo && !result.codigoEmpresaA3) {
    result.codigoEmpresaA3 = codigoSolo[1];
  }

  const nombreSolo = flat.match(
    /nombre\s+de\s+la\s+empresa\s+(.+?)(?=\s*n[\s./]*i[\s./]*f|\s*domicilio|$)/i,
  );
  if (nombreSolo && !result.nombreEmpresa) {
    const name = cleanValue(nombreSolo[1]);
    if (name && !looksLikeNif(name) && !isGarbageValue(name)) {
      result.nombreEmpresa = name;
    }
  }

  const nifLabel = flat.match(
    /n[\s./]*i[\s./]*f[\s./]*c[\s./]*i[\s./]*f\s+de\s+la\s+empresa\s+([a-z]\d{7,8}[0-9a-j])/i,
  );
  if (nifLabel && looksLikeNif(nifLabel[1].toUpperCase())) {
    result.nifEmpresa = nifLabel[1].toUpperCase();
  }
  if (!result.nifEmpresa) {
    const identEnd = flat.search(/domicilio\s+envio/);
    const identPart =
      identEnd > 0 ? text.slice(0, identEnd) : text.slice(0, 1200);
    result.nifEmpresa = findNifInText(identPart);
  }

  if (result.nifEmpresa && (!result.codigoEmpresaA3 || !result.nombreEmpresa)) {
    const inferred = inferIdentFromContext(text, result.nifEmpresa);
    if (!result.codigoEmpresaA3 && inferred.codigoEmpresaA3) {
      result.codigoEmpresaA3 = inferred.codigoEmpresaA3;
    }
    if (!result.nombreEmpresa && inferred.nombreEmpresa) {
      result.nombreEmpresa = inferred.nombreEmpresa;
    }
  }

  const email = t.match(
    /e-?mail\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
  );
  if (email) result.email = email[1];

  const foldedLines = toMatchableText(t);
  const phones = [...foldedLines.matchAll(/telefono\s+(\d{9,15})/gi)];
  if (phones.length) {
    result.telefono = phones[phones.length - 1][1];
  }

  const fechaAlta = matchFolded(t, /fecha\s+alta\s+empresa\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (fechaAlta) result.fechaAltaEmpresa = fechaAlta[1];

  const irpf = flat.match(
    /tipo\s+de\s+pago\s+i[\s.]*r[\s.]*p[\s.]*f[\s.]*\s+([a-z]+)/i,
  );
  if (irpf && !/^\d+$/.test(irpf[1])) result.tipoPagoIRPF = irpf[1];

  const centro = flat.match(/codigo\s+centro\s+gestion\s+(\d{3,8})/i);
  if (centro) result.codigoCentroGestion = centro[1];

  const empresario = flat.match(
    /tipo\s+de\s+empresario\s+(.+?)(?=\s*tablas|\s*enlace|\s*--\s*\d|$)/i,
  );
  if (empresario) {
    const te = cleanValue(empresario[1]);
    if (te && !isGarbageValue(te) && !PAGE_FOOTER.test(te)) {
      result.tipoEmpresario = te;
    }
  }

  parseDualColumnAddresses(t, result);

  if (
    !result.nombreEmpresa ||
    result.nombreEmpresa === result.nombreEmpresa.toLowerCase()
  ) {
    const restored = restoreNombreFromOriginal(t);
    if (restored) result.nombreEmpresa = restored;
  }
}

function parseDualColumnAddresses(text, result) {
  const folded = toMatchableText(text);
  const blockStart = folded.search(/domicilio\s+envio\s+documentacion/);
  const blockEnd = folded.search(/tablas|enlace con a3ges/);
  if (blockStart < 0) return;

  const chunk = folded.slice(
    blockStart,
    blockEnd > blockStart ? blockEnd : undefined,
  );

  const tryFlat = (re, apply) => {
    const m = chunk.match(re);
    if (m) apply(m);
  };

  tryFlat(/sigla\s+(\S+)\s+sigla\s+(\S+)/i, (m) => {
    result.domicilioEnvio.sigla = m[1].toUpperCase();
    result.domicilioFiscal.sigla = m[2].toUpperCase();
  });
  tryFlat(
    /via\s+publica\s+(.+?)\s+via\s+publica\s+(.+?)(?=numero|municipio|$)/i,
    (m) => {
      result.domicilioEnvio.via = cleanValue(m[1]).toUpperCase();
      result.domicilioFiscal.via = cleanValue(m[2]).toUpperCase();
    },
  );
  tryFlat(/municipio\s+(\S+)\s+municipio\s+(\S+)/i, (m) => {
    result.domicilioEnvio.municipio = m[1].toUpperCase();
    result.domicilioFiscal.municipio = m[2].toUpperCase();
  });
  tryFlat(
    /numero\s+esc\.?\s+piso\.?\s+puerta\.?\s+numero\s+esc\.?\s+piso\.?\s+puerta\.?\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i,
    (m) => {
      result.domicilioEnvio.numero = m[1];
      result.domicilioEnvio.piso = m[2];
      result.domicilioFiscal.numero = m[3];
      result.domicilioFiscal.piso = m[4];
    },
  );
  tryFlat(
    /provincia\s+cod\.?\s*postal\s+provincia\s+cod\.?\s*postal\s+(\S+)\s+(\d{5})\s+(\S+)\s+(\d{5})/i,
    (m) => {
      result.domicilioEnvio.provincia = m[1].toUpperCase();
      result.domicilioEnvio.codigoPostal = m[2];
      result.domicilioFiscal.provincia = m[3].toUpperCase();
      result.domicilioFiscal.codigoPostal = m[4];
    },
  );
}

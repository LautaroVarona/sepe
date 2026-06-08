import {
  extractA3FichaCompany,
  extractIdentificacionFields,
  isA3FichaEmpresa,
} from './company-a3-ficha-parser.js';

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

export const EMPTY_COMPANY_EXTRACTED = () => ({
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

function mergeExtracted(primary, secondary) {
  const out = { ...primary };
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
    if (!out[key]?.trim() && secondary[key]?.trim()) out[key] = secondary[key];
  }
  for (const side of ['domicilioFiscal', 'domicilioEnvio']) {
    out[side] = { ...out[side] };
    for (const k of Object.keys(out[side])) {
      if (!out[side][k]?.trim() && secondary[side]?.[k]?.trim()) {
        out[side][k] = secondary[side][k];
      }
    }
  }
  return out;
}

function extractIdentFallback(text) {
  return extractIdentificacionFields(text);
}

/**
 * @param {string} normalizedText
 */
export function extractCompanyFields(normalizedText) {
  const text = normalizedText ?? '';

  if (isA3FichaEmpresa(text)) {
    const a3 = extractA3FichaCompany(text);
    const ident = extractIdentFallback(text);
    const merged = mergeExtracted(a3, {
      ...EMPTY_COMPANY_EXTRACTED(),
      ...ident,
      domicilioFiscal: a3.domicilioFiscal,
      domicilioEnvio: a3.domicilioEnvio,
    });
    if (merged.nifEmpresa) {
      merged.nifEmpresa = merged.nifEmpresa.toUpperCase().replace(/\s/g, '');
    }
    return merged;
  }

  const legacy = extractIdentFallback(text);
  const result = { ...EMPTY_COMPANY_EXTRACTED(), ...legacy };
  if (result.nifEmpresa) {
    result.nifEmpresa = result.nifEmpresa.toUpperCase().replace(/\s/g, '');
  }
  return result;
}

/** Mantenido por compatibilidad con tests internos. */
export function extractValueByLabels() {
  return '';
}

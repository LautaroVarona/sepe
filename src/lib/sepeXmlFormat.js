import { normalizeNieIdentificador } from './cleanLlamamientoPipeline.js';

/** Clave de transmisión válida: E + 15 dígitos (16 caracteres). */
export function isValidClaveContratoTrans(value) {
  return /^E\d{15}$/.test(String(value ?? '').trim());
}

/**
 * Prefijo D/E exigido por XSD Contrat@ en IDENTIFICADORPFISICA.
 * DNI → D + 8 dígitos + letra; NIE (X/Y/Z) → E + cuerpo.
 */
export function formatIdentificadorPfisicaForXml(value) {
  let id = normalizeNieIdentificador(value);
  if (!id) return '';
  if (/^[DEUW]/i.test(id)) return id.toUpperCase();
  if (/^[XYZ]/i.test(id)) return `E${id.toUpperCase()}`;
  return `D${id.toUpperCase()}`;
}

/** CNO: exactamente 8 caracteres, espacios a la derecha. */
export function formatCodigoOcupacionForXml(value) {
  if (value === undefined || value === null || String(value).trim() === '') return '';
  const raw = String(value).trim();
  if (raw === '???????') return raw;
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (!digits) return raw.substring(0, 8).padEnd(8, ' ');
  return digits.padEnd(8, ' ');
}

/** Devuelve la clave válida o cadena vacía (omitir etiqueta en XML). */
export function sanitizeClaveContratoTrans(value) {
  return isValidClaveContratoTrans(value) ? String(value).trim() : '';
}

/**
 * Aplica reglas XSD de exportación al registro (post-validación).
 */
export function applySepeXmlFormatRules(record) {
  const out = { ...record };

  if (!isEmpty(out.IDENTIFICADORPFISICA)) {
    out.IDENTIFICADORPFISICA = formatIdentificadorPfisicaForXml(out.IDENTIFICADORPFISICA);
  }

  if (!isEmpty(out.CODIGO_OCUPACION)) {
    out.CODIGO_OCUPACION = formatCodigoOcupacionForXml(out.CODIGO_OCUPACION);
  }

  out.CLAVE_CONTRATO_TRANS = sanitizeClaveContratoTrans(out.CLAVE_CONTRATO_TRANS);

  return out;
}

function isEmpty(val) {
  return val === undefined || val === null || String(val).trim() === '';
}

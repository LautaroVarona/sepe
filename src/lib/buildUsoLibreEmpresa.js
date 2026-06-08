import {
  DEFAULT_USOLIBRE_EMPRESA_CONFIG,
  USOLIBRE_SEGMENT_PLACEHOLDERS,
} from '../config/usolibre-empresa.js';

function isEmpty(val) {
  return val === undefined || val === null || String(val).trim() === '';
}

/**
 * Añade al registro campos auxiliares usados solo para construir USOLIBRE (no van al XML).
 * @param {object} record
 * @param {{ trabajador?: object, empresa?: object }} [context]
 */
export function enrichRecordForUsoLibre(record, { trabajador, empresa } = {}) {
  const out = { ...record };

  if (isEmpty(out.CODIGO_EMPRESA_A3)) {
    out.CODIGO_EMPRESA_A3 =
      empresa?.codigo_empresa_a3?.trim() ||
      trabajador?.codigo_empresa_a3?.trim() ||
      '';
  }

  // Bloque T: código de trabajador A3 (codigo_interno_a3 o token legacy).
  if (isEmpty(out.A3_WORKER_TOKEN)) {
    const fromWorker =
      trabajador?.codigo_interno_a3?.trim() ||
      trabajador?.a3_worker_token?.trim() ||
      record.CODIGO_INTERNO_A3?.trim() ||
      record.CODIGO_TRABAJADOR?.trim() ||
      record.a3WorkerToken?.trim() ||
      '';
    if (fromWorker) out.A3_WORKER_TOKEN = fromWorker;
  }

  return out;
}

function normalizeFechaInicioYmd(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length >= 8) return digits.slice(0, 8);
  return digits;
}

function resolveCodigoEmpresaA3(record) {
  return String(record.CODIGO_EMPRESA_A3 ?? '').trim();
}

function normalizeWorkerCodeForUsoLibre(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';
  if (/^\d+$/.test(raw) && raw.length < 6) {
    return raw.padStart(6, '0');
  }
  return raw;
}

function resolveWorkerToken(record, config) {
  const explicit = normalizeWorkerCodeForUsoLibre(
    record.A3_WORKER_TOKEN?.trim() ||
      record.a3WorkerToken?.trim() ||
      record.CODIGO_TRABAJADOR?.trim() ||
      record.CODIGO_INTERNO_A3?.trim() ||
      '',
  );
  if (explicit) return { value: explicit, usedPlaceholder: false };
  return {
    value: config.placeholders.token,
    usedPlaceholder: true,
  };
}

function resolveContractCode(record, config) {
  const resolver = config.resolveContractCode;
  const resolved = typeof resolver === 'function' ? resolver(record) : '';
  const value = String(resolved ?? '').trim();
  if (value) return { value, usedPlaceholder: false };
  return {
    value: config.placeholders.contract,
    usedPlaceholder: true,
  };
}

function resolveFechaInicio(record, config) {
  const normalized = normalizeFechaInicioYmd(record.FECHA_INICIO);
  if (normalized.length === 8) {
    return { value: normalized, usedPlaceholder: false };
  }
  return {
    value: config.placeholders.fecha,
    usedPlaceholder: true,
  };
}

/**
 * Construye USOLIBRE_EMPRESA según el patrón A3 observado en exportaciones L2606002.
 *
 * Confirmado (muestras A3):
 * - Prefijo E + código de empresa A3 (ej. E96280…)
 * - Prefijo F + FECHA_INICIO en YYYYMMDD (ej. …F20260310)
 *
 * Hipótesis / parametrizable:
 * - Bloque T + token de trabajador (ej. T019916): origen exacto aún no cerrado
 * - Bloque C + código contractual corto (ej. C300): no coincide con CLAVE_CONTRATO_TRANS completa
 *
 * @param {object} record Registro SEPE; puede incluir CODIGO_EMPRESA_A3, A3_WORKER_TOKEN, CODIGO_CONTRATO_CORTO.
 * @param {import('../config/usolibre-empresa.js').UsoLibreEmpresaConfig} [config]
 * @returns {{
 *   value: string,
 *   warnings: string[],
 *   segments: { empresa: string, token: string, contract: string, fecha: string },
 *   complete: boolean,
 * }}
 */
export function buildUsoLibreEmpresa(record, config = DEFAULT_USOLIBRE_EMPRESA_CONFIG) {
  const cfg = {
    placeholders: {
      ...USOLIBRE_SEGMENT_PLACEHOLDERS,
      ...config.placeholders,
    },
    resolveContractCode:
      config.resolveContractCode ?? DEFAULT_USOLIBRE_EMPRESA_CONFIG.resolveContractCode,
  };

  const warnings = [];
  const codigoEmpresa = resolveCodigoEmpresaA3(record);
  let empresaSegment = codigoEmpresa;
  let empresaPlaceholder = false;

  if (isEmpty(codigoEmpresa)) {
    warnings.push(
      'USOLIBRE_EMPRESA: falta código de empresa A3 (CODIGO_EMPRESA_A3); se usa placeholder en bloque E',
    );
    empresaSegment = cfg.placeholders.empresa;
    empresaPlaceholder = true;
  }

  const token = resolveWorkerToken(record, cfg);
  if (token.usedPlaceholder) {
    warnings.push(
      'USOLIBRE_EMPRESA: falta código de trabajador A3 (codigo_interno_a3 / A3_WORKER_TOKEN); se usa placeholder en bloque T',
    );
  }

  const contract = resolveContractCode(record, cfg);
  if (contract.usedPlaceholder) {
    warnings.push(
      'USOLIBRE_EMPRESA: falta código contractual corto (CODIGO_CONTRATO_CORTO o resolveContractCode); se usa placeholder en bloque C',
    );
  }

  const fecha = resolveFechaInicio(record, cfg);
  if (fecha.usedPlaceholder) {
    warnings.push(
      'USOLIBRE_EMPRESA: falta o es inválida FECHA_INICIO (YYYYMMDD); se usa placeholder en bloque F',
    );
  }

  const segments = {
    empresa: empresaSegment,
    token: token.value,
    contract: contract.value,
    fecha: fecha.value,
  };

  const value = `E${segments.empresa}T${segments.token}C${segments.contract}F${segments.fecha}`;

  const complete =
    !empresaPlaceholder &&
    !token.usedPlaceholder &&
    !contract.usedPlaceholder &&
    !fecha.usedPlaceholder;

  return { value, warnings, segments, complete };
}

/**
 * Aplica buildUsoLibreEmpresa al registro de llamamiento (merge + contexto opcional).
 */
export function applyUsoLibreEmpresaToRecord(
  record,
  { trabajador, empresa, config, rowLabel } = {},
) {
  const mergedConfig = { ...DEFAULT_USOLIBRE_EMPRESA_CONFIG, ...config };
  const enriched = enrichRecordForUsoLibre(record, { trabajador, empresa });
  const built = buildUsoLibreEmpresa(enriched, mergedConfig);

  const out = { ...enriched };
  const keepImported =
    !mergedConfig.overwriteImported && !isEmpty(out.USOLIBRE_EMPRESA);

  if (!keepImported) {
    out.USOLIBRE_EMPRESA = built.value;
  }

  const prefix = rowLabel ? `Fila ${rowLabel}: ` : '';
  const warnings = built.warnings.map((w) => `${prefix}${w}`);

  return { record: out, warnings, built };
}

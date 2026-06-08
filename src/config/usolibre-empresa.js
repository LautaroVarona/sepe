/**
 * Configuración de USOLIBRE_EMPRESA (formato A3 deducido por ingeniería inversa).
 *
 * Patrón objetivo: E{codigoEmpresaA3}T{tokenTrabajador}C{codigoContrato}F{fechaInicioYYYYMMDD}
 */

/** Placeholders por segmento cuando falta dato (no rompe el XML). */
export const USOLIBRE_SEGMENT_PLACEHOLDERS = {
  empresa: '?????',
  token: '??????',
  contract: '???',
  fecha: '????????',
};

/**
 * @typedef {object} UsoLibreEmpresaConfig
 * @property {{ empresa: string, token: string, contract: string, fecha: string }} placeholders
 * @property {(record: object) => string} [resolveContractCode] Devuelve código contractual corto (bloque C).
 * @property {boolean} [overwriteImported] Si false, respeta USOLIBRE_EMPRESA ya presente en el registro.
 */

/** @type {UsoLibreEmpresaConfig} */
export const DEFAULT_USOLIBRE_EMPRESA_CONFIG = {
  placeholders: { ...USOLIBRE_SEGMENT_PLACEHOLDERS },
  /**
   * Código contractual corto (bloque C).
   * Prioridad: CODIGO_CONTRATO_CORTO → CLAVE_CONTRATO_TRANS si es numérico corto.
   */
  resolveContractCode(record) {
    const corto = String(record.CODIGO_CONTRATO_CORTO ?? '').trim();
    if (corto) return corto;

    const clave = String(record.CLAVE_CONTRATO_TRANS ?? '').trim();
    if (/^\d{1,4}$/.test(clave)) return clave;

    return '';
  },
  overwriteImported: true,
};

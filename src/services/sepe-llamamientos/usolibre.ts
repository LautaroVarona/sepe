import type { SepeLlamamientoRecord } from './types.js';

const PLACEHOLDERS = {
  empresa: '?????',
  token: '??????',
  contract: '???',
  fecha: '????????',
};

function normalizeWorkerCode(value: string): string {
  const raw = value.trim().toUpperCase();
  if (!raw) return '';
  if (/^\d+$/.test(raw) && raw.length < 6) return raw.padStart(6, '0');
  return raw;
}

function resolveContractCode(record: SepeLlamamientoRecord): string {
  const corto = String(record.CODIGO_CONTRATO_CORTO ?? '').trim();
  if (corto) return corto;
  const clave = String(record.CLAVE_CONTRATO_TRANS ?? '').trim();
  if (/^\d{1,4}$/.test(clave)) return clave;
  return PLACEHOLDERS.contract;
}

/**
 * Patrón A3: E{codigoEmpresa}T{tokenTrabajador}C{contratoCorto}F{fechaInicioYYYYMMDD}
 */
export function buildUsoLibreEmpresa(record: SepeLlamamientoRecord): string {
  const empresa = String(record.CODIGO_EMPRESA_A3 ?? '').trim() || PLACEHOLDERS.empresa;
  const token =
    normalizeWorkerCode(record.CODIGO_INTERNO_A3 ?? '') || PLACEHOLDERS.token;
  const contract = resolveContractCode(record);
  const fechaRaw = String(record.FECHA_INICIO ?? '').replace(/\D/g, '').slice(0, 8);
  const fecha = fechaRaw.length === 8 ? fechaRaw : PLACEHOLDERS.fecha;
  return `E${empresa}T${token}C${contract}F${fecha}`;
}

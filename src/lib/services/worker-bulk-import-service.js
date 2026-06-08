import { processA3WorkerExcel } from '../a3-worker-excel/process.js';
import { bulkCreateTrabajadores } from '../store.js';

/**
 * Construye payloads únicos por DNI (primera fila del Excel por DNI).
 */
export function buildUniqueTrabajadorPayloadsFromProcess(result, { empresaId } = {}) {
  const payloads = [];
  const seenDni = new Set();

  for (const reg of result.registros ?? []) {
    const dni = reg.trabajador.identificador_pfisica;
    if (!dni || seenDni.has(dni)) continue;
    seenDni.add(dni);

    const payload = { ...reg.trabajador };
    if (empresaId) payload.empresa_id = empresaId;
    if (!payload.pais_residencia?.trim()) payload.pais_residencia = '724';
    if (!payload.ind_incorpora_actividad?.trim()) payload.ind_incorpora_actividad = 'S';
    payloads.push(payload);
  }

  return payloads;
}

export function bulkImportFromProcessResult(result, { empresaId } = {}) {
  const payloads = buildUniqueTrabajadorPayloadsFromProcess(result, { empresaId });
  const created = bulkCreateTrabajadores(payloads);
  return {
    ok: true,
    fileName: result.fileName,
    created: created.length,
    skippedDescartadas: result.stats?.filasDescartadas ?? 0,
    stats: {
      ...result.stats,
      personasImportadas: created.length,
    },
    trabajadores: created,
  };
}

/**
 * Importa personas únicas del Excel creando siempre registros nuevos.
 */
export function bulkImportWorkersFromExcelBuffer(buffer, options = {}) {
  const result = processA3WorkerExcel(buffer, options);

  if (!result.ok) {
    return result;
  }

  const empresaId = options.empresaId?.trim() || null;
  return bulkImportFromProcessResult(result, { empresaId });
}

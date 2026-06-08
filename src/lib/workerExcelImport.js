import { labelA3Column } from '../config/a3-worker-excel.js';
import { processA3WorkerExcel } from './a3-worker-excel/process.js';
import {
  buildWorkerImportEntryFromTrabajador,
  buildWorkerPreviewFromPrefill,
} from './services/worker-excel-import-service.js';
import { listTrabajadores, listEmpresas } from './store.js';

function buildFieldSummary(meta) {
  const mapList = (keys) =>
    (keys ?? []).map((key) => ({ key, label: labelA3Column(key) }));
  return {
    partialSource: true,
    availableInFile: mapList(meta?.availableInFile),
    optionalNotInFile: mapList(meta?.optionalNotInFile),
    extendedPresent: mapList(meta?.extendedPresent),
    extendedAbsent: mapList(meta?.extendedAbsent),
  };
}

/**
 * Pipeline: Excel A3 → registros laborales + preview compatible con la UI de importación.
 */
export function importWorkersFromExcelBuffer(buffer, options = {}) {
  const result = processA3WorkerExcel(buffer, {
    ...options,
    store: options.store ?? { empresas: listEmpresas(), trabajadores: listTrabajadores() },
  });

  if (!result.ok) {
    return result;
  }

  const trabajadores = listTrabajadores();
  const empresas = listEmpresas();

  const workers = result.registros.map((reg, index) =>
    buildWorkerImportEntryFromTrabajador(reg, index, { trabajadores, empresas }),
  );

  const preview = workers.map((w) => buildWorkerPreviewFromPrefill(w));

  const seenDni = new Set();
  const personasPreview = [];
  for (const w of workers) {
    const dni = w.prefill?.identificador_pfisica?.trim();
    if (!dni || seenDni.has(dni)) continue;
    seenDni.add(dni);
    personasPreview.push(buildWorkerPreviewFromPrefill(w));
  }

  const duplicates = preview.filter((p) => p.duplicateId).length;

  return {
    ok: true,
    source: 'excel',
    fileName: result.fileName,
    personas: result.personas,
    registros: result.registros,
    descartadas: result.descartadas,
    inconsistencias: result.inconsistencias ?? [],
    workers,
    preview,
    personasPreview,
    warnings: result.warnings,
    info: result.info ?? [],
    meta: result.meta,
    fieldSummary: buildFieldSummary(result.meta),
    stats: {
      ...result.stats,
      duplicates,
      withNif: preview.filter((p) => p.hasNif).length,
      headerRowUsed: result.meta?.headerRowUsed ?? options.headerRow ?? 1,
      fechaNacimientoDetectada: result.meta?.fechaNacimientoDetectada ?? false,
      filasConFecha: result.meta?.filasConFecha ?? 0,
    },
  };
}

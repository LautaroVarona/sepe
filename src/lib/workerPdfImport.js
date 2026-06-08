import { parseWorkerPdf } from './pdf/worker-parser.js';
import { isA3WorkerFicha } from './parsers/worker-field-extractor.js';
import {
  buildWorkerPreviewRow,
  mapExtractedToStorePayload,
  validateExtractedWorker,
} from './store/worker-master-store.js';
import { buildWorkerImportEntry } from './services/worker-merge-service.js';
import { listTrabajadores, listEmpresas } from './store.js';

/**
 * Pipeline: PDF buffer → lista de trabajadores detectados + preview.
 */
export async function importWorkersFromPdfBuffer(buffer) {
  const { normalizedText, workers: rawWorkers } = await parseWorkerPdf(buffer);
  const trabajadores = listTrabajadores();
  const empresas = listEmpresas();

  const warnings = [];
  if (!isA3WorkerFicha(normalizedText)) {
    warnings.push(
      'No se encontró el marcador «Ficha del Trabajador». Los resultados pueden ser incompletos.',
    );
  }

  const entries = rawWorkers.map((extracted, index) =>
    buildWorkerImportEntry(extracted, index, { trabajadores, empresas }),
  );

  const preview = entries.map((e) => ({
    ...buildWorkerPreviewRow(e.extracted, e.index),
    duplicateId: e.duplicate?.id ?? null,
    validation: validateExtractedWorker(e.extracted),
  }));

  const firstEmpresa = rawWorkers.find((w) => w.codigoEmpresaA3);
  const empresaHint = firstEmpresa
    ? {
        codigo: firstEmpresa.codigoEmpresaA3,
        nombre: firstEmpresa.nombreEmpresa,
        matchedEmpresaId:
          empresas.find(
            (e) =>
              String(e.codigo_empresa_a3 ?? '').trim() ===
              String(firstEmpresa.codigoEmpresaA3).trim(),
          )?.id ?? null,
      }
    : null;

  return {
    ok: true,
    workerCount: entries.length,
    workers: entries.map((e) => ({
      index: e.index,
      extracted: e.extracted,
      prefill: e.prefill,
      masterPayload: mapExtractedToStorePayload(e.extracted),
      duplicate: e.duplicate,
      validation: validateExtractedWorker(e.extracted),
    })),
    preview,
    empresaHint,
    warnings,
    textPreview: normalizedText.slice(0, 4000),
    stats: {
      total: entries.length,
      withNif: preview.filter((p) => p.hasNif).length,
      duplicates: preview.filter((p) => p.duplicateId).length,
    },
  };
}

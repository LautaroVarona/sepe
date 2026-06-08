import { PDFParse } from 'pdf-parse';
import { normalizeWorkerPdfText } from './text-normalizer.js';
import { segmentWorkerBlocks } from '../parsers/worker-field-extractor.js';
import { extractWorkerFields } from '../parsers/worker-field-extractor.js';

const TEXT_VARIANTS = [
  {
    lineEnforce: true,
    cellSeparator: '\t',
    cellThreshold: 4,
    lineThreshold: 5,
    pageJoiner: '\n',
  },
  { lineEnforce: true, cellSeparator: '', pageJoiner: '\n' },
  { lineEnforce: true, pageJoiner: '\n' },
];

function scoreWorkerExtraction(workers) {
  let score = 0;
  for (const w of workers) {
    if (w.nifNie?.trim()) score += 3;
    if (w.nombre?.trim() || w.nombreCompleto?.trim()) score += 2;
    if (w.numeroSeguridadSocial?.trim()) score += 2;
    if (w.fechaNacimiento?.trim()) score += 1;
  }
  return score + workers.length * 0.5;
}

/**
 * Extrae texto plano de un PDF de fichas de trabajadores (varias configuraciones).
 */
export async function parseWorkerPdf(buffer) {
  if (!buffer?.length) {
    throw new Error('El archivo PDF está vacío');
  }

  const parser = new PDFParse({ data: buffer });
  let bestRaw = '';
  let bestNormalized = '';
  let bestWorkers = [];
  let bestScore = -1;

  try {
    for (const params of TEXT_VARIANTS) {
      const result = await parser.getText(params);
      const rawText = result.text ?? '';
      if (!rawText.trim()) continue;

      const normalizedText = normalizeWorkerPdfText(rawText);
      const blocks = segmentWorkerBlocks(normalizedText);
      const workers = blocks.map((block) => extractWorkerFields(block));

      const score = scoreWorkerExtraction(workers);
      if (score > bestScore) {
        bestScore = score;
        bestRaw = rawText;
        bestNormalized = normalizedText;
        bestWorkers = workers;
      }
    }

    if (!bestRaw.trim()) {
      throw new Error(
        'No se pudo extraer texto del PDF. ¿Tiene capa de texto o es solo imagen?',
      );
    }

    return {
      rawText: bestRaw,
      normalizedText: bestNormalized,
      workers: bestWorkers,
      pageCount: bestRaw.split(/--\s*\d+\s+of\s+\d+\s*--/i).length,
    };
  } finally {
    await parser.destroy();
  }
}

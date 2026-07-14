import {
  MAX_RECORDS_PER_XML,
  fillMissingForXml,
  buildXmlExportFileName,
} from '../config/mapping.js';
import { buildLlamamientosXml } from './xmlGenerator.js';
import { applySepeXmlFormatRules } from './sepeXmlFormat.js';

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function padPart(num, width) {
  return String(num).padStart(width, '0');
}

/**
 * Genera ficheros XML a partir de filas ya procesadas (merge + validación).
 * @param {Array<{ record: object, complete?: boolean }>} processedRows
 * @param {string} baseName
 * @param {{ maxPerFile?: number, singleFile?: boolean }} [options]
 */
export function buildXmlFilesFromRows(processedRows, baseName, options = {}) {
  const chunkSize =
    options.singleFile || options.maxPerFile === 0
      ? Math.max(processedRows.length, 1)
      : options.maxPerFile ?? MAX_RECORDS_PER_XML;

  const records = processedRows.map((r) => fillMissingForXml(applySepeXmlFormatRules(r.record)));
  const chunks = chunkArray(records, chunkSize);
  const chunkMeta = chunkArray(processedRows, chunkSize);
  const totalParts = chunks.length;

  const files = chunks.map((chunk, i) => {
    const part = i + 1;
    const suffix = totalParts > 1 ? `_${padPart(part, 3)}` : '';
    const name = buildXmlExportFileName(baseName, suffix);
    const xml = buildLlamamientosXml(chunk);
    const rowsInChunk = chunkMeta[i];
    return {
      name,
      xml,
      count: chunk.length,
      part,
      totalParts,
      startRow: i * chunkSize,
      incompleteInFile: rowsInChunk.filter((r) => !r.complete).length,
    };
  });

  return { files, recordCount: records.length };
}

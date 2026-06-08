import { PDFParse } from 'pdf-parse';
import { normalizeCompanyPdfText } from './company-text-normalizer.js';
import { extractCompanyFields } from '../mappings/company-field-extractor.js';

const TEXT_VARIANTS = [
  {
    lineEnforce: true,
    cellSeparator: '\t',
    cellThreshold: 4,
    lineThreshold: 5,
    pageJoiner: '',
  },
  { lineEnforce: true, cellSeparator: '', pageJoiner: '' },
  { lineEnforce: true, pageJoiner: '' },
];

function scoreExtraction(extracted) {
  let score = 0;
  if (extracted.codigoEmpresaA3?.trim()) score += 4;
  if (extracted.nombreEmpresa?.trim()) score += 4;
  if (extracted.nifEmpresa?.trim()) score += 3;
  if (extracted.email?.trim()) score += 1;
  if (extracted.telefono?.trim()) score += 1;
  if (extracted.domicilioFiscal?.municipio?.trim()) score += 1;
  if (extracted.fechaAltaEmpresa?.trim()) score += 1;
  return score;
}

/**
 * Extrae texto plano de un PDF (prueba varias configuraciones de pdf-parse).
 */
export async function parseCompanyPdf(buffer) {
  if (!buffer?.length) {
    throw new Error('El archivo PDF está vacío');
  }

  const parser = new PDFParse({ data: buffer });
  let bestRaw = '';
  let bestNormalized = '';
  let bestScore = -1;

  try {
    for (const params of TEXT_VARIANTS) {
      const result = await parser.getText(params);
      const rawText = result.text ?? '';
      if (!rawText.trim()) continue;

      const normalizedText = normalizeCompanyPdfText(rawText);
      const extracted = extractCompanyFields(normalizedText);
      const score = scoreExtraction(extracted);

      if (score > bestScore) {
        bestScore = score;
        bestRaw = rawText;
        bestNormalized = normalizedText;
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
    };
  } finally {
    await parser.destroy();
  }
}

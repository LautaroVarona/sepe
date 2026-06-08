import { parseCompanyPdf } from './pdf/company-pdf-parser.js';
import { extractCompanyFields } from './mappings/company-field-extractor.js';
import {
  buildFieldStatusList,
  mapExtractedToFormPrefill,
  mapExtractedToStorePayload,
  validateExtractedCompany,
} from './store/company-master-store.js';

/**
 * Pipeline completo: PDF buffer → datos estructurados + prefill + validación.
 */
export async function importCompanyFromPdfBuffer(buffer) {
  const { normalizedText } = await parseCompanyPdf(buffer);
  const extracted = extractCompanyFields(normalizedText);
  const validation = validateExtractedCompany(extracted);
  const prefill = mapExtractedToFormPrefill(extracted);
  const masterPayload = mapExtractedToStorePayload(extracted);

  const missingCore =
    !extracted.codigoEmpresaA3?.trim() ||
    !extracted.nombreEmpresa?.trim() ||
    !extracted.nifEmpresa?.trim();

  return {
    ok: true,
    extracted,
    prefill,
    masterPayload,
    validation,
    fieldStatus: buildFieldStatusList(extracted),
    textPreview: normalizedText.slice(0, 3500),
  };
}

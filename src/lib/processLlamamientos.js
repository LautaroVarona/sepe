import { basename, extname } from 'path';
import { MISSING_PLACEHOLDER } from '../config/mapping.js';
import {
  readLlamamientosExcel,
  readLlamamientosExcelBuffer,
} from './llamamientosExcelReader.js';
import {
  mergeRecord,
  resolveContext,
  buildTrabajadorIndex,
} from './mergeRecord.js';
import { normalizeExcelRecordForMatch } from './trabajadorIndex.js';
import { normalizeRecordForSepe } from './normalizeSepeFields.js';
import { validateRecordSoft } from './validators.js';
import {
  validateTrabajadorJoin,
  validateRequiredLlamamiento,
  buildDiscardSummary,
} from './validateLlamamientoRow.js';
import { buildXmlFilesFromRows } from './xmlFilesFromRows.js';
import { buildWarningSummary } from './warningSummary.js';
import { formatExcelRowLabel } from './saltraLlamamientosReader.js';
import { applyUsoLibreEmpresaToRecord } from './buildUsoLibreEmpresa.js';

function sanitizeBaseName(name) {
  return name.replace(/[^\w.-]/g, '_') || 'LLAMAMIENTOS';
}

export function processLlamamientos(source, options = {}) {
  const {
    sheetIndex = 0,
    headerRow = 1,
    prefix,
    originalFileName = 'LLAMAMIENTOS',
    store = { empresas: [], trabajadores: [] },
    empresaId = null,
  } = options;

  const baseName = sanitizeBaseName(
    prefix ?? basename(originalFileName, extname(originalFileName)),
  );

  let parsed;
  if (Buffer.isBuffer(source)) {
    parsed = readLlamamientosExcelBuffer(source, { sheetIndex, headerRow });
  } else if (typeof source === 'string') {
    parsed = readLlamamientosExcel(source, { sheetIndex, headerRow });
  } else {
    throw new Error('Fuente no válida');
  }

  const { rows, meta } = parsed;

  if (rows.length === 0) {
    return {
      ok: false,
      errors: ['El Excel no contiene filas de datos'],
      meta,
    };
  }

  const trabajadorIndex = buildTrabajadorIndex(store.trabajadores ?? []);
  const allWarnings = [];
  const processedRows = [];
  const discardedRows = [];
  let matchedFromTrabajador = 0;

  if (meta.format === 'saltra-alta-baja') {
    const p = meta.pairing;
    allWarnings.push(
      `Excel Saltra: ${p.excelMovements} movimientos (Alta/Baja) → ${p.llamamientos} llamamientos (${p.pairedAltaBaja} parejas Alta+Baja).`,
    );
    if (p.altaSinBaja > 0) {
      allWarnings.push(
        `${p.altaSinBaja} Alta(s) sin Baja emparejada (solo fecha de inicio).`,
      );
    }
    if (p.bajaSinAlta > 0) {
      allWarnings.push(
        `${p.bajaSinAlta} Baja(s) sin Alta previa (solo fecha de fin).`,
      );
    }
    if (meta.saltraWarnings?.length) {
      const cap = meta.saltraWarnings.slice(0, 40);
      allWarnings.push(...cap);
      if (meta.saltraWarnings.length > 40) {
        allWarnings.push(
          `… y ${meta.saltraWarnings.length - 40} avisos más de emparejamiento`,
        );
      }
    }
  } else if (meta.missingColumns?.length > 0) {
    allWarnings.push(
      `Columnas no detectadas en el Excel (se usará ${MISSING_PLACEHOLDER} donde falte): ${meta.missingColumns.join(', ')}`,
    );
  }

  for (const row of rows) {
    const rawExcelRecord = row.record;
    const rowLabel = formatExcelRowLabel(row);
    const excelRecord = normalizeExcelRecordForMatch(rawExcelRecord);

    const { empresa, trabajador, matchBy } = resolveContext(excelRecord, store, {
      empresaId,
      trabajadorIndex,
    });

    const joinCheck = validateTrabajadorJoin({
      trabajador,
      record: excelRecord,
      rowLabel,
    });

    if (!joinCheck.ok) {
      allWarnings.push(joinCheck.message);
      discardedRows.push({
        excelRowNumber: row.excelRowNumber,
        excelRowEnd: row.excelRowEnd,
        sourceRows: row.sourceRows,
        reason: joinCheck.reason,
        message: joinCheck.message,
        record: excelRecord,
      });
      continue;
    }

    const {
      record: merged,
      filledFrom,
      matchedTrabajador,
      matchedEmpresa,
    } = mergeRecord(excelRecord, { empresa, trabajador, matchBy });

    const required = validateRequiredLlamamiento({
      record: merged,
      rowLabel,
    });

    if (!required.ok) {
      allWarnings.push(required.message);
      discardedRows.push({
        excelRowNumber: row.excelRowNumber,
        excelRowEnd: row.excelRowEnd,
        sourceRows: row.sourceRows,
        reason: required.reason,
        message: required.message,
        record: merged,
      });
      continue;
    }

    if (trabajador) matchedFromTrabajador += 1;

    const normalized = normalizeRecordForSepe(merged);
    for (const w of normalized.warnings) {
      allWarnings.push(`Fila ${rowLabel}: ${w}`);
    }

    const usolibre = applyUsoLibreEmpresaToRecord(normalized.record, {
      trabajador,
      empresa,
      rowLabel,
    });
    allWarnings.push(...usolibre.warnings);

    const validation = validateRecordSoft(usolibre.record, rowLabel);
    allWarnings.push(...validation.warnings);

    if (filledFrom.length > 0) {
      const fromStore = filledFrom.filter(
        (f) => f.source !== 'aviso' && f.field !== '_match',
      );
      if (fromStore.length > 0) {
        allWarnings.push(
          `Filas ${rowLabel}: completado desde sistema (${fromStore.map((f) => f.field).join(', ')})`,
        );
      }
    }

    processedRows.push({
      record: validation.record,
      excelRowNumber: row.excelRowNumber,
      excelRowEnd: row.excelRowEnd,
      sourceRows: row.sourceRows,
      movementPair: row.movementPair,
      complete: validation.complete,
      missingFields: validation.missingFields,
      matchedTrabajador,
      matchedEmpresa,
      matchBy,
      filledFrom: filledFrom.filter(
        (f) => f.source === 'trabajador' || f.source === 'empresa',
      ),
    });
  }

  const { files } = buildXmlFilesFromRows(processedRows, baseName);
  const incompleteCount = processedRows.filter((r) => !r.complete).length;
  const discardSummary = buildDiscardSummary(discardedRows);

  const warnings = [...new Set(allWarnings)];
  const warningSummary = buildWarningSummary(warnings, {
    discardedRows,
    processingLog: {
      excelRows: meta.pairing?.excelMovements ?? rows.length,
      processed: processedRows.length,
      discarded: discardedRows.length,
      byReason: discardSummary.byReason,
    },
  });

  return {
    ok: true,
    baseName,
    files,
    records: processedRows,
    discardedRows,
    recordCount: processedRows.length,
    discardedCount: discardedRows.length,
    fileCount: files.length,
    rowCount: meta.pairing?.excelMovements ?? rows.length,
    excelMovementCount: meta.pairing?.excelMovements,
    incompleteCount,
    completeCount: processedRows.length - incompleteCount,
    matchedFromTrabajador,
    trabajadoresEnSistema: store.trabajadores?.length ?? 0,
    processingLog: {
      excelRows: meta.pairing?.excelMovements ?? rows.length,
      processed: processedRows.length,
      discarded: discardedRows.length,
      byReason: discardSummary.byReason,
    },
    warnings: warnings.length <= 60 ? warnings : [],
    warningSummary,
    meta,
    excelIncomplete: meta.format !== 'saltra-alta-baja' && meta.missingColumns?.length > 0,
  };
}

export function rebuildLlamamientosFromRows(processedRows, baseName) {
  const sanitized = sanitizeBaseName(baseName);
  const rows = processedRows.map((row, i) => {
    const rowLabel = formatExcelRowLabel({
      excelRowNumber: row.excelRowNumber ?? row.row ?? i + 2,
      sourceRows: row.sourceRows,
    });
    const normalized = normalizeRecordForSepe(row.record ?? row);
    const usolibre = applyUsoLibreEmpresaToRecord(normalized.record, { rowLabel });
    const validation = validateRecordSoft(usolibre.record, rowLabel);
    return {
      record: validation.record,
      excelRowNumber: row.excelRowNumber ?? row.row,
      excelRowEnd: row.excelRowEnd,
      sourceRows: row.sourceRows,
      movementPair: row.movementPair,
      complete: validation.complete,
      missingFields: validation.missingFields,
      matchedTrabajador: row.matchedTrabajador ?? null,
      matchedEmpresa: row.matchedEmpresa ?? null,
      matchBy: row.matchBy ?? null,
      filledFrom: row.filledFrom ?? [],
    };
  });

  const incompleteCount = rows.filter((r) => !r.complete).length;
  const { files, recordCount } = buildXmlFilesFromRows(rows, sanitized);

  return {
    ok: true,
    baseName: sanitized,
    files,
    records: rows,
    recordCount,
    fileCount: files.length,
    incompleteCount,
    completeCount: recordCount - incompleteCount,
  };
}

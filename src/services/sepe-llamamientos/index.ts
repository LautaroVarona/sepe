import { writeFileSync, mkdirSync } from 'node:fs';
import type { GenerateOptions, GenerateResult } from './types.js';
import { ingestMovementFiles } from './movements-ingest.js';
import { ingestMasterFile } from './master-ingest.js';
import { pairAndNormalizeMovements } from './pair-movements.js';
import { mergeWithMaster } from './merge-master.js';
import { buildXmlFiles, XML_ENCODING } from './xml-generator.js';

const DEFAULT_EMPRESA = {
  nifEmpresa: 'B96562467',
  ccc: '46109049727',
  codigoEmpresaA3: '96280',
  nivelFormativo: '23',
  indIncorporaActividad: 'S',
};

/**
 * Servicio principal: movimientos Saltra + maestro A3 → XML SEPE L2606002.
 */
export function generateSepeLlamamientosXml(options: GenerateOptions): GenerateResult {
  const logs: GenerateResult['logs'] = [];
  const empresa = { ...DEFAULT_EMPRESA, ...options.empresa };
  const maxRecords = options.maxRecordsPerFile ?? 30;
  const baseName = options.outputBaseName ?? 'LLAMAMIENTOS';

  let movementsRead = 0;
  try {
    const movements = ingestMovementFiles(options.movementPaths, {
      headerRow: options.headerRow,
    });
    movementsRead = movements.length;

    logs.push({
      level: 'info',
      message: `${movementsRead} movimientos leídos de ${options.movementPaths.length} archivo(s)`,
    });

    const { paired, logs: pairLogs, stats: pairStats } = pairAndNormalizeMovements(movements);
    logs.push(...pairLogs);

    const masterIndex = ingestMasterFile(options.masterPath, {
      headerRow: options.headerRow,
    });

    logs.push({
      level: 'info',
      message: `${masterIndex.size} trabajadores en base maestra`,
    });

    const {
      records,
      logs: mergeLogs,
      skipped,
    } = mergeWithMaster(paired, masterIndex, empresa);
    logs.push(...mergeLogs);

    const files = buildXmlFiles(records, baseName, maxRecords);

    return {
      ok: true,
      files,
      records,
      logs,
      stats: {
        movementsRead,
        paired: pairStats.paired,
        altaSinBaja: pairStats.altaSinBaja,
        orphanBajasDiscarded: pairStats.orphanBajasDiscarded,
        skippedNoMaster: skipped,
        recordsGenerated: records.length,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push({ level: 'error', message });
    return {
      ok: false,
      files: [],
      records: [],
      logs,
      stats: {
        movementsRead,
        paired: 0,
        altaSinBaja: 0,
        orphanBajasDiscarded: 0,
        skippedNoMaster: 0,
        recordsGenerated: 0,
      },
    };
  }
}

export interface WriteOutputOptions {
  outputDir: string;
}

/** Genera y escribe ficheros .XML en disco (ISO-8859-1) */
export function generateAndWriteXml(
  options: GenerateOptions & WriteOutputOptions,
): GenerateResult {
  const result = generateSepeLlamamientosXml(options);
  if (!result.ok) return result;

  mkdirSync(options.outputDir, { recursive: true });
  for (const file of result.files) {
    const outPath = `${options.outputDir}/${file.name}`;
    writeFileSync(outPath, file.xml, { encoding: 'latin1' });
  }

  result.logs.push({
    level: 'info',
    message: `${result.files.length} fichero(s) XML escritos en ${options.outputDir} (${XML_ENCODING})`,
  });

  return result;
}

export * from './types.js';
export * from './normalize.js';
export { buildLlamamientosXml, buildXmlFiles } from './xml-generator.js';

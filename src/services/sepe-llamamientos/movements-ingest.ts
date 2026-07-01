import type { RawMovement } from './types.js';
import {
  normalizeFechaYmd,
  normalizeNieIdentificador,
  normalizeNss,
  parseMovementType,
  splitNombreCompleto,
} from './normalize.js';
import {
  buildColumnIndex,
  getCell,
  readWorkbookFromPath,
  sheetToMatrix,
} from './excel-read.js';

const MOVEMENT_ALIASES: Record<string, string[]> = {
  MOVIMIENTO: ['TIPO_DE_MOVIMIENTO', 'TIPO_MOVIMIENTO', 'MOVIMIENTO'],
  NOMBRE: ['NOMBRE', 'NOMBRE_TRABAJADOR'],
  DNI: ['NIF_DNI_CIF', 'NIF/DNI/CIF', 'DNI', 'NIF', 'DOCUMENTO'],
  NSS: ['NSS', 'NUMERO_SEGURIDAD_SOCIAL', 'NAF'],
  CONTRATO: ['CONTRATO', 'CLAVE_CONTRATO_TRANS', 'CLAVE_CONTRATO'],
  FECHA: ['FECHA', 'FECHA_MOVIMIENTO'],
  CNO: ['CNO', 'CODIGO_OCUPACION', 'OCUPACION'],
  CCC: ['CUENTA_DE_COTIZACION', 'CUENTA_COTIZACION', 'CCC'],
};

function isEmptyRow(row: unknown[]): boolean {
  return !row?.length || row.every((c) => c === '' || c == null);
}

/**
 * Lee un Excel de movimientos Saltra (filas Alta/Baja).
 */
export function ingestMovementFile(
  filePath: string,
  options: { headerRow?: number } = {},
): RawMovement[] {
  const headerRow = options.headerRow ?? 1;
  const workbook = readWorkbookFromPath(filePath);
  const { rows } = sheetToMatrix(workbook, 0);

  if (rows.length < headerRow) {
    throw new Error(`Cabecera esperada en fila ${headerRow}: ${filePath}`);
  }

  const headers = rows[headerRow - 1] ?? [];
  const colIdx = buildColumnIndex(headers, MOVEMENT_ALIASES);

  if (colIdx.MOVIMIENTO === undefined || colIdx.FECHA === undefined) {
    throw new Error(`Formato Saltra no detectado en ${filePath}`);
  }

  const movements: RawMovement[] = [];
  const dataRows = rows.slice(headerRow);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || isEmptyRow(row)) continue;

    const movementType = parseMovementType(getCell(row, colIdx, 'MOVIMIENTO'));
    if (!movementType) continue;

    const nombreCompleto = getCell(row, colIdx, 'NOMBRE');
    const split = splitNombreCompleto(nombreCompleto);

    movements.push({
      excelRowNumber: headerRow + 1 + i,
      sourceFile: filePath,
      movementType,
      fecha: normalizeFechaYmd(getCell(row, colIdx, 'FECHA')),
      dni: normalizeNieIdentificador(getCell(row, colIdx, 'DNI')),
      nss: normalizeNss(getCell(row, colIdx, 'NSS')),
      nombre: split.nombre || nombreCompleto,
      primerApellido: split.primerApellido,
      segundoApellido: split.segundoApellido,
      contrato: getCell(row, colIdx, 'CONTRATO').replace(/\s+$/, '').trim(),
      cno: getCell(row, colIdx, 'CNO').replace(/\s+$/, '').trim(),
      ccc: getCell(row, colIdx, 'CCC').replace(/\s+/g, '').trim(),
    });
  }

  return movements;
}

/** Ingesta varios ficheros de movimientos y los concatena. */
export function ingestMovementFiles(
  paths: string[],
  options: { headerRow?: number } = {},
): RawMovement[] {
  return paths.flatMap((p) => ingestMovementFile(p, options));
}

import type { MasterWorker } from './types.js';
import {
  normalizeFechaYmd,
  normalizeNieIdentificador,
  normalizeNss,
  normalizeSexo,
} from './normalize.js';
import {
  buildColumnIndex,
  getCell,
  normalizeHeaderName,
  readWorkbookFromPath,
  sheetToMatrix,
} from './excel-read.js';

const MASTER_ALIASES: Record<string, string[]> = {
  DNI: ['DNI', 'NIF', 'NIF_DNI_CIF', 'NIF/DNI/CIF', 'IDENTIFICADORPFISICA', 'DOCUMENTO'],
  NOMBRE: ['NOMBRE', 'NOMBRE_TRABAJADOR'],
  PRIMER_APELLIDO: ['PRIMER_APELLIDO', 'APELLIDO1', 'APELLIDO_1', 'APELLIDO'],
  SEGUNDO_APELLIDO: ['SEGUNDO_APELLIDO', 'APELLIDO2', 'APELLIDO_2'],
  SEXO: ['SEXO', 'GENERO'],
  FECHA_NACIMIENTO: ['FECHA_NACIMIENTO', 'FEC_NACIMIENTO', 'NACIMIENTO'],
  NACIONALIDAD: ['NACIONALIDAD', 'COD_NACIONALIDAD'],
  MUNICIPIO: ['MUNICIPIO', 'MUNICIPIO_RESIDENCIA', 'COD_MUNICIPIO'],
  PAIS: ['PAIS', 'PAIS_RESIDENCIA', 'PAÍS_RESIDENCIA'],
  NSS: ['NSS', 'NUMERO_SEGURIDAD_SOCIAL', 'NAF'],
  NIVEL_ESTUDIOS: ['NIVEL_ESTUDIOS', 'NIVEL_FORMATIVO', 'NIVEL_FORMAT'],
  CNO: ['CNO', 'CODIGO_OCUPACION', 'OCUPACION'],
  CODIGO_TRABAJADOR: [
    'CODIGO_TRABAJADOR',
    'CODIGO_DEL_TRABAJADOR',
    'CODIGO_INTERNO_A3',
    'COD_TRABAJADOR',
  ],
  CODIGO_EMPRESA: ['CODIGO_EMPRESA_A3', 'CODIGO_EMPRESA'],
};

function detectHeaderRow(rows: unknown[][], preferred = 1): number {
  let bestIdx = preferred - 1;
  let bestScore = -1;
  const scan = Math.min(10, rows.length);
  for (let i = 0; i < scan; i++) {
    const headers = (rows[i] ?? []).map(normalizeHeaderName);
    let score = 0;
    if (headers.some((h) => h === 'DNI' || h.includes('DNI'))) score += 5;
    if (headers.includes('NOMBRE')) score += 2;
    if (headers.some((h) => h.includes('APELLIDO'))) score += 2;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx + 1;
}

function isEmptyRow(row: unknown[]): boolean {
  return !row?.length || row.every((c) => c === '' || c == null);
}

/**
 * Carga la base maestra A3 (tmp22E8.xls) indexada por DNI/NIE.
 */
export function ingestMasterFile(
  filePath: string,
  options: { headerRow?: number } = {},
): Map<string, MasterWorker> {
  const workbook = readWorkbookFromPath(filePath);
  const { rows } = sheetToMatrix(workbook, 0);
  const headerRow = options.headerRow ?? detectHeaderRow(rows);

  if (rows.length < headerRow) {
    throw new Error(`Cabecera no encontrada en maestro: ${filePath}`);
  }

  const colIdx = buildColumnIndex(rows[headerRow - 1] ?? [], MASTER_ALIASES);
  if (colIdx.DNI === undefined) {
    throw new Error(`Columna DNI no detectada en maestro: ${filePath}`);
  }

  const index = new Map<string, MasterWorker>();
  const dataRows = rows.slice(headerRow);

  for (const row of dataRows) {
    if (!row || isEmptyRow(row)) continue;

    const dni = normalizeNieIdentificador(getCell(row, colIdx, 'DNI'));
    if (!dni) continue;

    const worker: MasterWorker = {
      dni,
      nombre: getCell(row, colIdx, 'NOMBRE').toUpperCase(),
      primerApellido: getCell(row, colIdx, 'PRIMER_APELLIDO').toUpperCase(),
      segundoApellido: getCell(row, colIdx, 'SEGUNDO_APELLIDO').toUpperCase(),
      sexo: normalizeSexo(getCell(row, colIdx, 'SEXO')),
      fechaNacimiento: normalizeFechaYmd(getCell(row, colIdx, 'FECHA_NACIMIENTO')),
      nacionalidad: getCell(row, colIdx, 'NACIONALIDAD') || '724',
      municipio: getCell(row, colIdx, 'MUNICIPIO').replace(/\D/g, ''),
      pais: getCell(row, colIdx, 'PAIS') || '724',
      nss: normalizeNss(getCell(row, colIdx, 'NSS')),
      nivelFormativo: getCell(row, colIdx, 'NIVEL_ESTUDIOS') || '23',
      codigoOcupacion: getCell(row, colIdx, 'CNO').replace(/\D/g, '').slice(0, 4),
      codigoInternoA3: getCell(row, colIdx, 'CODIGO_TRABAJADOR'),
      codigoEmpresaA3: getCell(row, colIdx, 'CODIGO_EMPRESA'),
      indIncorpora: 'S',
    };

    index.set(dni, worker);
  }

  return index;
}

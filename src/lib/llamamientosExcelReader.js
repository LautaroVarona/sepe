import XLSX from 'xlsx';
import { readExcel, readExcelBuffer } from './excelReader.js';
import {
  readSaltraLlamamientosFromWorkbook,
  readSaltraLlamamientosBuffer,
  readSaltraLlamamientosFile,
} from './saltraLlamamientosReader.js';

/**
 * Lee Excel de llamamientos: detecta formato Saltra (Alta/Baja) o genérico SEPE.
 */
export function readLlamamientosExcel(filePath, options = {}) {
  const saltra = readSaltraLlamamientosFile(filePath, options);
  if (saltra) return saltra;
  return readExcel(filePath, options);
}

export function readLlamamientosExcelBuffer(buffer, options = {}) {
  const saltra = readSaltraLlamamientosBuffer(buffer, options);
  if (saltra) return saltra;
  return readExcelBuffer(buffer, options);
}

export function readLlamamientosFromWorkbook(workbook, options = {}) {
  const saltra = readSaltraLlamamientosFromWorkbook(workbook, options);
  if (saltra) return saltra;
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return readExcelBuffer(buffer, options);
}

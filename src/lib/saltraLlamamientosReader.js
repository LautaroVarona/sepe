import XLSX from 'xlsx';
import { ALL_FIELDS, normalizeHeaderName } from '../config/mapping.js';
import { normId, normNss, normText } from './trabajadorIndex.js';

const COL = {
  MOVIMIENTO: 'TIPO_DE_MOVIMIENTO',
  NOMBRE: 'NOMBRE',
  DNI: 'NIF_DNI_CIF',
  NSS: 'NSS',
  CONTRATO: 'CONTRATO',
  FECHA: 'FECHA',
  CNO: 'CNO',
  CCC: 'CUENTA_DE_COTIZACION',
};

const COL_ALIASES = {
  [COL.MOVIMIENTO]: ['TIPO_DE_MOVIMIENTO', 'TIPO_MOVIMIENTO', 'MOVIMIENTO'],
  [COL.NOMBRE]: ['NOMBRE', 'NOMBRE_TRABAJADOR'],
  [COL.DNI]: ['NIF_DNI_CIF', 'NIF/DNI/CIF', 'DNI', 'NIF', 'DOCUMENTO'],
  [COL.NSS]: ['NSS', 'NUMERO_SEGURIDAD_SOCIAL', 'NAF'],
  [COL.CONTRATO]: ['CONTRATO', 'CLAVE_CONTRATO_TRANS', 'CLAVE_CONTRATO'],
  [COL.FECHA]: ['FECHA', 'FECHA_MOVIMIENTO'],
  [COL.CNO]: ['CNO', 'CODIGO_OCUPACION', 'OCUPACION'],
  [COL.CCC]: [
    'CUENTA_DE_COTIZACION',
    'CUENTA_COTIZACION',
    'CUENTA_COTIZACIÓN',
    'CCC',
  ],
};

function isEmpty(val) {
  return val === undefined || val === null || String(val).trim() === '';
}

function cellStr(val) {
  if (val === undefined || val === null) return '';
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).trim();
}

export function isSaltraLlamamientosFormat(headerRow) {
  const norms = (headerRow ?? []).map((h) => normalizeHeaderName(h));
  return norms.some(
    (n) =>
      n === COL.MOVIMIENTO ||
      (n.includes('TIPO') && n.includes('MOVIMIENTO')),
  );
}

function buildSaltraColumnIndex(headerRow) {
  const index = {};
  headerRow.forEach((h, idx) => {
    const norm = normalizeHeaderName(h);
    for (const [key, aliases] of Object.entries(COL_ALIASES)) {
      if (aliases.some((a) => normalizeHeaderName(a) === norm)) {
        if (index[key] === undefined) index[key] = idx;
      }
    }
  });
  return index;
}

function parseMovementType(value) {
  const t = normText(value);
  if (t === 'ALTA' || t.startsWith('ALTA')) return 'alta';
  if (t === 'BAJA' || t.startsWith('BAJA')) return 'baja';
  return null;
}

function normalizeSaltraDni(value) {
  let d = normId(value);
  if (/^0\d{8}[A-Z]$/.test(d)) d = d.slice(1);
  return d;
}

function splitNombreCompleto(nombre) {
  const parts = normText(nombre).split(' ').filter(Boolean);
  if (parts.length >= 3) {
    return {
      NOMBRE: parts[0],
      PRIMER_APELLIDO: parts[1],
      SEGUNDO_APELLIDO: parts.slice(2).join(' '),
    };
  }
  if (parts.length === 2) {
    return { NOMBRE: parts[0], PRIMER_APELLIDO: parts[1], SEGUNDO_APELLIDO: '' };
  }
  return { NOMBRE: parts[0] ?? '', PRIMER_APELLIDO: '', SEGUNDO_APELLIDO: '' };
}

/** Fecha de movimiento → YYYYMMDD (validación posterior la refina). */
export function parseFechaMovimiento(value) {
  if (isEmpty(value)) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
  const raw = cellStr(value);
  if (/^\d{8}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/-/g, '');
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('/');
    return `${yyyy}${mm}${dd}`;
  }
  return raw;
}

function emptyRecord() {
  const r = {};
  for (const f of ALL_FIELDS) r[f] = '';
  return r;
}

function rowToMovement(row, colIdx, excelRowNumber) {
  const get = (key) => {
    const idx = colIdx[key];
    if (idx === undefined) return '';
    return cellStr(row[idx]);
  };

  const movementType = parseMovementType(get(COL.MOVIMIENTO));
  const nombreCompleto = get(COL.NOMBRE);
  const split = splitNombreCompleto(nombreCompleto);

  const record = emptyRecord();
  record.NOMBRE = split.NOMBRE || nombreCompleto;
  record.PRIMER_APELLIDO = split.PRIMER_APELLIDO;
  record.SEGUNDO_APELLIDO = split.SEGUNDO_APELLIDO;
  record.IDENTIFICADORPFISICA = normalizeSaltraDni(get(COL.DNI));
  record.NUMERO_SEGURIDAD_SOCIAL = normNss(get(COL.NSS));
  record.CLAVE_CONTRATO_TRANS = get(COL.CONTRATO).replace(/\s+$/, '').trim();
  record.CODIGO_OCUPACION = get(COL.CNO).replace(/\s+$/, '').trim();
  record.CCC = get(COL.CCC).replace(/\s+/g, '').trim();

  const fecha = parseFechaMovimiento(get(COL.FECHA));
  if (movementType === 'alta') record.FECHA_INICIO = fecha;
  if (movementType === 'baja') record.FECHA_FIN = fecha;

  return {
    record,
    excelRowNumber,
    movementType,
    fecha,
    nombreCompleto,
  };
}

function personKey(record) {
  const dni = normId(record.IDENTIFICADORPFISICA);
  const nss = normNss(record.NUMERO_SEGURIDAD_SOCIAL);
  if (dni) return `dni:${dni}`;
  if (nss) return `nss:${nss}`;
  const name = normText(
    [record.NOMBRE, record.PRIMER_APELLIDO, record.SEGUNDO_APELLIDO]
      .filter(Boolean)
      .join(' '),
  );
  return name ? `nom:${name}` : '';
}

function mergeField(target, altaVal, bajaVal) {
  if (!isEmpty(altaVal)) return String(altaVal).trim();
  if (!isEmpty(bajaVal)) return String(bajaVal).trim();
  return '';
}

function mergeAltaBaja(alta, baja) {
  const record = emptyRecord();
  const a = alta.record;
  const b = baja.record;

  for (const field of ALL_FIELDS) {
    record[field] = mergeField(record, a[field], b[field]);
  }

  record.FECHA_INICIO = alta.fecha || a.FECHA_INICIO || '';
  record.FECHA_FIN = baja.fecha || b.FECHA_FIN || '';

  return {
    record,
    excelRowNumber: alta.excelRowNumber,
    excelRowEnd: baja.excelRowNumber,
    sourceRows: [alta.excelRowNumber, baja.excelRowNumber],
    movementPair: 'alta+baja',
    movementTypes: ['alta', 'baja'],
  };
}

function finalizeAltaOnly(alta) {
  const record = { ...alta.record };
  record.FECHA_INICIO = alta.fecha || record.FECHA_INICIO || '';
  return {
    record,
    excelRowNumber: alta.excelRowNumber,
    sourceRows: [alta.excelRowNumber],
    movementPair: 'alta-sin-baja',
    movementTypes: ['alta'],
  };
}

function finalizeBajaOnly(baja) {
  const record = { ...baja.record };
  record.FECHA_FIN = baja.fecha || record.FECHA_FIN || '';
  return {
    record,
    excelRowNumber: baja.excelRowNumber,
    sourceRows: [baja.excelRowNumber],
    movementPair: 'baja-sin-alta',
    movementTypes: ['baja'],
  };
}

/**
 * Empareja filas Alta/Baja del Excel Saltra en un llamamiento (inicio + fin).
 */
export function pairAltaBajaMovements(movements) {
  const pending = new Map();
  const output = [];
  const warnings = [];
  let pairedCount = 0;
  let altaSinBaja = 0;
  let bajaSinAlta = 0;

  for (const mov of movements) {
    const key = personKey(mov.record);

    if (!mov.movementType) {
      output.push({
        ...mov,
        sourceRows: [mov.excelRowNumber],
        movementPair: 'sin-tipo',
      });
      warnings.push(
        `Fila ${mov.excelRowNumber}: tipo de movimiento no reconocido (se espera Alta o Baja)`,
      );
      continue;
    }

    if (!key) {
      output.push({
        ...mov,
        sourceRows: [mov.excelRowNumber],
        movementPair: mov.movementType,
      });
      warnings.push(
        `Fila ${mov.excelRowNumber}: sin DNI/NSS/nombre para emparejar Alta/Baja`,
      );
      continue;
    }

    if (mov.movementType === 'alta') {
      if (pending.has(key)) {
        const prev = pending.get(key);
        output.push(finalizeAltaOnly(prev));
        altaSinBaja += 1;
        warnings.push(
          `Filas ${prev.excelRowNumber}–${mov.excelRowNumber}: nueva Alta sin Baja de la Alta anterior (mismo trabajador)`,
        );
      }
      pending.set(key, mov);
      continue;
    }

    if (mov.movementType === 'baja') {
      const alta = pending.get(key);
      if (alta) {
        output.push(mergeAltaBaja(alta, mov));
        pending.delete(key);
        pairedCount += 1;
      } else {
        output.push(finalizeBajaOnly(mov));
        bajaSinAlta += 1;
        warnings.push(
          `Fila ${mov.excelRowNumber}: Baja sin Alta previa del mismo trabajador`,
        );
      }
    }
  }

  for (const alta of pending.values()) {
    output.push(finalizeAltaOnly(alta));
    altaSinBaja += 1;
    warnings.push(
      `Fila ${alta.excelRowNumber}: Alta sin Baja emparejada (mismo trabajador)`,
    );
  }

  return {
    rows: output,
    warnings,
    pairing: {
      excelMovements: movements.length,
      llamamientos: output.length,
      pairedAltaBaja: pairedCount,
      altaSinBaja,
      bajaSinAlta,
    },
  };
}

function readWorkbookRows(workbook, { sheetIndex = 0, headerRow = 1 } = {}) {
  const sheetName = workbook.SheetNames[sheetIndex];
  if (!sheetName) throw new Error('El archivo Excel no contiene hojas');

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  if (matrix.length < headerRow) {
    throw new Error(`Se esperaba cabecera en la fila ${headerRow}`);
  }

  return { sheetName, headerRow: matrix[headerRow - 1], dataRows: matrix.slice(headerRow) };
}

export function readSaltraLlamamientosFromWorkbook(workbook, options = {}) {
  const { sheetIndex = 0, headerRow = 1 } = options;
  const { sheetName, headerRow: headers, dataRows } = readWorkbookRows(workbook, {
    sheetIndex,
    headerRow,
  });

  if (!isSaltraLlamamientosFormat(headers)) {
    return null;
  }

  const colIdx = buildSaltraColumnIndex(headers);
  const movements = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.every((c) => c === '' || c == null)) continue;
    movements.push(rowToMovement(row, colIdx, headerRow + 1 + i));
  }

  const { rows, warnings, pairing } = pairAltaBajaMovements(movements);

  return {
    rows,
    meta: {
      format: 'saltra-alta-baja',
      sheetName,
      detectedColumns: [
        'NOMBRE',
        'IDENTIFICADORPFISICA',
        'NUMERO_SEGURIDAD_SOCIAL',
        'FECHA_INICIO',
        'FECHA_FIN',
        'CLAVE_CONTRATO_TRANS',
        'CODIGO_OCUPACION',
        'CCC',
      ],
      missingColumns: ALL_FIELDS.filter(
        (f) =>
          ![
            'NOMBRE',
            'IDENTIFICADORPFISICA',
            'NUMERO_SEGURIDAD_SOCIAL',
            'FECHA_INICIO',
            'FECHA_FIN',
            'CLAVE_CONTRATO_TRANS',
            'CODIGO_OCUPACION',
            'CCC',
          ].includes(f),
      ),
      unknownHeaders: [],
      pairing,
      saltraWarnings: warnings,
    },
  };
}

export function readSaltraLlamamientosBuffer(buffer, options) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    raw: false,
  });
  return readSaltraLlamamientosFromWorkbook(workbook, options);
}

export function readSaltraLlamamientosFile(filePath, options) {
  const workbook = XLSX.readFile(filePath, { cellDates: true, raw: false });
  return readSaltraLlamamientosFromWorkbook(workbook, options);
}

/** Etiqueta de fila para avisos y UI (ej. "2–3"). */
export function formatExcelRowLabel(row) {
  if (row.sourceRows?.length >= 2) {
    return `${row.sourceRows[0]}–${row.sourceRows[row.sourceRows.length - 1]}`;
  }
  return String(row.excelRowNumber ?? row.row ?? '');
}

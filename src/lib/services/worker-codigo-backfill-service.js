import { readExcelBuffer } from '../excelReader.js';
import { normalizeTrabajadorPayload } from '../store/worker-master-store.js';

function normDni(dni) {
  return String(dni ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, '');
}

function normCodigo(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';
  if (/^\d+$/.test(raw) && raw.length < 6) {
    return raw.padStart(6, '0');
  }
  return raw;
}

function resolveCodigoFromRecord(record) {
  return normCodigo(
    record.CODIGO_TRABAJADOR ??
      record.CODIGO_INTERNO_A3 ??
      record.CODIGO_DEL_TRABAJADOR ??
      '',
  );
}

/**
 * Rellena codigo_interno_a3 en trabajadores existentes desde Excel (por DNI).
 * Solo actualiza registros con código vacío; no sobrescribe códigos ya guardados.
 * @param {Buffer} buffer
 * @param {{ headerRow?: number, store: { trabajadores: object[] } }} options
 */
export function backfillCodigosFromExcelBuffer(buffer, { headerRow = 1, store } = {}) {
  const parsed = readExcelBuffer(buffer, { headerRow });

  const codigoByDni = new Map();
  for (const { record } of parsed.rows) {
    const dni = normDni(record.IDENTIFICADORPFISICA ?? record.DNI);
    const codigo = resolveCodigoFromRecord(record);
    if (!dni || !codigo || codigoByDni.has(dni)) continue;
    codigoByDni.set(dni, codigo);
  }

  let updated = 0;
  let alreadyOk = 0;
  let skippedHasCodigo = 0;
  let noEnExcel = 0;

  for (const t of store.trabajadores) {
    const dni = normDni(t.identificador_pfisica);
    const codigoExcel = codigoByDni.get(dni);
    if (!codigoExcel) {
      noEnExcel++;
      continue;
    }
    const actual = normCodigo(t.codigo_interno_a3);
    if (actual) {
      if (actual === codigoExcel) alreadyOk++;
      else skippedHasCodigo++;
      continue;
    }
    Object.assign(
      t,
      normalizeTrabajadorPayload(
        { ...t, codigo_interno_a3: codigoExcel },
        { id: t.id },
      ),
    );
    updated++;
  }

  return {
    ok: true,
    updated,
    alreadyOk,
    skippedHasCodigo,
    noEnExcel,
    dnisConCodigoEnExcel: codigoByDni.size,
    meta: {
      headerRowUsed: headerRow,
      detectedColumns: parsed.meta.detectedColumns,
    },
  };
}

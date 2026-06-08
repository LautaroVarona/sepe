import { readA3WorkerExcelBuffer } from '../a3-worker-excel/reader.js';
import { normalizeTrabajadorPayload } from '../store/worker-master-store.js';

function normDni(dni) {
  return String(dni ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, '');
}

/**
 * Rellena fecha_nacimiento en trabajadores existentes desde Excel A3 (por DNI).
 * @param {Buffer} buffer
 * @param {{ headerRow?: number, store: { trabajadores: object[] } }} options
 */
export function backfillFechasFromExcelBuffer(buffer, { headerRow = 1, store } = {}) {
  const parsed = readA3WorkerExcelBuffer(buffer, { headerRow });

  const fechaByDni = new Map();
  for (const { record } of parsed.rows) {
    const dni = normDni(record.DNI);
    const fecha = String(record.FECHA_NACIMIENTO ?? '').trim();
    if (!dni || !fecha || fechaByDni.has(dni)) continue;
    fechaByDni.set(dni, fecha);
  }

  let updated = 0;
  let alreadyOk = 0;
  let noEnExcel = 0;

  for (const t of store.trabajadores) {
    const dni = normDni(t.identificador_pfisica);
    const fechaExcel = fechaByDni.get(dni);
    if (!fechaExcel) {
      noEnExcel++;
      continue;
    }
    if (String(t.fecha_nacimiento ?? '').trim() === fechaExcel) {
      alreadyOk++;
      continue;
    }
    Object.assign(
      t,
      normalizeTrabajadorPayload(
        { ...t, fecha_nacimiento: fechaExcel },
        { id: t.id },
      ),
    );
    updated++;
  }

  return {
    ok: true,
    updated,
    alreadyOk,
    noEnExcel,
    dnisConFechaEnExcel: fechaByDni.size,
    meta: {
      headerRowUsed: parsed.meta.headerRowUsed,
      fechaNacimientoDetectada: parsed.meta.fechaNacimientoDetectada,
      filasConFecha: parsed.meta.filasConFecha,
    },
  };
}

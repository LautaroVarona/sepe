import { labelA3Column } from '../../config/a3-worker-excel.js';
import { readA3WorkerExcelBuffer } from './reader.js';
import {
  formatPersonaNombre,
  getPersonaFieldDiffs,
  mapRowToPersona,
  mapRowToRegistroLaboral,
  normalizeExcelRow,
} from './map-to-store.js';

function resolveEmpresaContext(store, { empresaId, codigoEmpresaA3 } = {}) {
  if (!store?.empresas?.length) {
    return { empresa: null, empresaId: empresaId || null };
  }

  if (empresaId) {
    const empresa = store.empresas.find((e) => e.id === empresaId) ?? null;
    return { empresa, empresaId: empresa?.id ?? null };
  }

  if (codigoEmpresaA3) {
    const empresa = store.empresas.find(
      (e) =>
        String(e.codigo_empresa_a3 ?? '').trim() === String(codigoEmpresaA3).trim(),
    );
    if (empresa) return { empresa, empresaId: empresa.id };
  }

  return { empresa: null, empresaId: null };
}

function buildPartialSourceInfo(meta) {
  const info = [];

  if (meta.optionalNotInFile?.length > 0) {
    info.push(
      `Columnas opcionales no presentes en este archivo: ${meta.optionalNotInFile.map(labelA3Column).join(', ')}`,
    );
  }

  if (meta.extendedAbsent?.length > 0) {
    info.push(
      'Campos no presentes en este Excel (esperado): NSS, país, contrato, empresa y demás datos SEPE se completan desde otras fuentes o el formulario.',
    );
  }

  if (meta.extendedPresent?.length > 0) {
    info.push(
      `Columnas adicionales detectadas (otra fuente en el mismo archivo): ${meta.extendedPresent.map(labelA3Column).join(', ')}`,
    );
  }

  return info;
}

/**
 * Procesa Excel A3 (fuente parcial): personas únicas por DNI y registros laborales.
 */
export function processA3WorkerExcel(source, options = {}) {
  const {
    sheetIndex = 0,
    headerRow = 1,
    originalFileName = 'trabajadores-a3.xlsx',
    empresaId = null,
    store = null,
  } = options;

  let parsed;
  if (Buffer.isBuffer(source)) {
    parsed = readA3WorkerExcelBuffer(source, { sheetIndex, headerRow });
  } else {
    throw new Error('Fuente no válida: se esperaba un buffer de Excel');
  }

  const { rows, meta } = parsed;

  if (meta.missingRequired?.length > 0) {
    return {
      ok: false,
      errors: [
        `El Excel no incluye las columnas obligatorias: ${meta.missingRequired.map(labelA3Column).join(', ')}`,
      ],
      meta,
    };
  }

  const descartadas = [];
  const registros = [];
  const personasByDni = new Map();
  /** @type {Map<string, { canonical: object, filaPrimera: number, conflictos: object[] }>} */
  const personaTracker = new Map();

  for (const { record, excelRowNumber } of rows) {
    const row = normalizeExcelRow(record);

    if (!row.dniValid) {
      descartadas.push({
        filaExcel: excelRowNumber,
        motivo: row.dniReason || 'DNI no válido',
        dniRaw: String(record.DNI ?? '').trim(),
        nombre: normalizeStringPreview(record.NOMBRE, record.PRIMER_APELLIDO),
      });
      continue;
    }

    const empresaCtx = resolveEmpresaContext(store, {
      empresaId,
      codigoEmpresaA3: row.codigoEmpresaA3,
    });

    registros.push(mapRowToRegistroLaboral(row, excelRowNumber, empresaCtx));

    const persona = mapRowToPersona(row);
    const existing = personasByDni.get(row.dni);

    if (!existing) {
      personasByDni.set(row.dni, persona);
      personaTracker.set(row.dni, {
        canonical: persona,
        filaPrimera: excelRowNumber,
        conflictos: [],
      });
    } else {
      const diffs = getPersonaFieldDiffs(existing, persona);
      if (diffs.length > 0) {
        const tracker = personaTracker.get(row.dni);
        tracker.conflictos.push({
          filaExcel: excelRowNumber,
          persona,
          nombreCompleto: formatPersonaNombre(persona),
          camposDistintos: diffs,
        });
      }
    }
  }

  const inconsistencias = [...personaTracker.entries()]
    .filter(([, t]) => t.conflictos.length > 0)
    .map(([dni, t]) => ({
      dni,
      filaPrimera: t.filaPrimera,
      personaCanonical: t.canonical,
      nombreCanonical: formatPersonaNombre(t.canonical),
      conflictos: t.conflictos,
      totalConflictos: t.conflictos.length,
    }))
    .sort((a, b) => a.dni.localeCompare(b.dni));

  const personas = [...personasByDni.values()];
  const warnings = [];
  if (meta.missingRequired?.length > 0) {
    warnings.push(
      `Faltan columnas obligatorias en el Excel: ${meta.missingRequired.map(labelA3Column).join(', ')}`,
    );
  }

  return {
    ok: true,
    fileName: originalFileName,
    stats: {
      filasLeidas: rows.length,
      filasValidas: registros.length,
      filasDescartadas: descartadas.length,
      personasUnicas: personas.length,
      registrosLaborales: registros.length,
      personasConInconsistencias: inconsistencias.length,
      filasConInconsistencias: inconsistencias.reduce(
        (n, i) => n + i.totalConflictos,
        0,
      ),
    },
    personas,
    registros,
    descartadas,
    inconsistencias,
    warnings,
    info: buildPartialSourceInfo(meta),
    meta,
  };
}

function normalizeStringPreview(nombre, apellido) {
  const n = String(nombre ?? '').trim();
  const a = String(apellido ?? '').trim();
  return [n, a].filter(Boolean).join(' ').trim();
}

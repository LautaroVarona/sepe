import type {
  EmpresaDefaults,
  GenerateLogEntry,
  MasterWorker,
  PairedLlamamiento,
  SepeLlamamientoRecord,
} from './types.js';
import {
  fixFechaChronology,
  formatCodigoOcupacion,
  normalizeNieIdentificador,
  truncateNameFields,
} from './normalize.js';
import { buildUsoLibreEmpresa } from './usolibre.js';

const MISSING = '???????';

function pickString(...values: (string | undefined)[]): string {
  for (const v of values) {
    if (v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

/**
 * Cruza llamamientos emparejados con la base maestra A3 (clave: DNI/NIE).
 * Si el trabajador no existe en maestro → log error y omite el registro.
 */
export function mergeWithMaster(
  paired: PairedLlamamiento[],
  masterIndex: Map<string, MasterWorker>,
  empresa: EmpresaDefaults,
): { records: SepeLlamamientoRecord[]; logs: GenerateLogEntry[]; skipped: number } {
  const logs: GenerateLogEntry[] = [];
  const records: SepeLlamamientoRecord[] = [];
  let skipped = 0;

  for (const row of paired) {
    const dni = normalizeNieIdentificador(row.dni);
    const master = masterIndex.get(dni);

    if (!master) {
      skipped += 1;
      logs.push({
        level: 'error',
        message: 'Trabajador no encontrado en base maestra',
        dni,
        row: row.sourceRows[0],
        file: row.sourceFile,
      });
      continue;
    }

    const { FECHA_INICIO, FECHA_FIN, swapped } = fixFechaChronology(
      row.fechaInicio,
      row.fechaFin,
    );
    if (swapped) {
      logs.push({
        level: 'warn',
        message: 'FECHA_INICIO posterior a FECHA_FIN: fechas invertidas',
        dni,
        row: row.sourceRows[0],
      });
    }

    const names = truncateNameFields({
      NOMBRE: pickString(master.nombre, row.nombre),
      PRIMER_APELLIDO: pickString(master.primerApellido, row.primerApellido),
      SEGUNDO_APELLIDO: pickString(master.segundoApellido, row.segundoApellido),
    });

    const cno = formatCodigoOcupacion(pickString(row.cno, master.codigoOcupacion));
    const contrato = pickString(row.contrato) || MISSING;
    const ccc = pickString(row.ccc, empresa.ccc) || MISSING;

    const draft: SepeLlamamientoRecord = {
      CCC: ccc,
      NIF_EMPRESA: empresa.nifEmpresa || MISSING,
      IDENTIFICADORPFISICA: dni,
      NOMBRE: names.NOMBRE,
      PRIMER_APELLIDO: names.PRIMER_APELLIDO,
      SEGUNDO_APELLIDO: names.SEGUNDO_APELLIDO,
      SEXO: master.sexo || '1',
      FECHA_NACIMIENTO: master.fechaNacimiento || MISSING,
      NACIONALIDAD: master.nacionalidad || '724',
      MUNICIPIO_RESIDENCIA: master.municipio || MISSING,
      PAIS_RESIDENCIA: master.pais || '724',
      NUMERO_SEGURIDAD_SOCIAL: pickString(row.nss, master.nss),
      FECHA_INICIO: FECHA_INICIO || MISSING,
      FECHA_FIN: FECHA_FIN || MISSING,
      CLAVE_CONTRATO_TRANS: contrato,
      IND_INCORPORA_ACTIVIDAD: master.indIncorpora || empresa.indIncorporaActividad || 'S',
      CODIGO_OCUPACION: cno || MISSING,
      NIVEL_FORMATIVO: master.nivelFormativo || empresa.nivelFormativo || '23',
      USOLIBRE_EMPRESA: '',
      CODIGO_EMPRESA_A3: pickString(empresa.codigoEmpresaA3, master.codigoEmpresaA3),
      CODIGO_INTERNO_A3: master.codigoInternoA3,
      CODIGO_CONTRATO_CORTO: /^\d{1,4}$/.test(row.contrato) ? row.contrato : '',
    };

    draft.USOLIBRE_EMPRESA = buildUsoLibreEmpresa(draft);
    records.push(draft);
  }

  return { records, logs, skipped };
}

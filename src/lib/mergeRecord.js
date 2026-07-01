import { ALL_FIELDS } from '../config/mapping.js';
import {
  buildTrabajadorIndex,
  findTrabajadorInIndex,
  normId,
} from './trabajadorIndex.js';

const EMPRESA_FIELDS = ['CCC', 'NIF_EMPRESA', 'USOLIBRE_EMPRESA'];
/** Campos de empresa que deben tomarse del maestro (no del Excel Saltra abreviado). */
const EMPRESA_IDENTITY_FIELDS = ['CCC', 'NIF_EMPRESA'];
const EMPRESA_DEFAULT_FIELDS = [
  'USOLIBRE_EMPRESA',
  'CLAVE_CONTRATO_TRANS',
  'NIVEL_FORMATIVO',
  'IND_INCORPORA_ACTIVIDAD',
];
const TRABAJADOR_FIELDS = [
  'IDENTIFICADORPFISICA',
  'NOMBRE',
  'PRIMER_APELLIDO',
  'SEGUNDO_APELLIDO',
  'SEXO',
  'FECHA_NACIMIENTO',
  'NACIONALIDAD',
  'MUNICIPIO_RESIDENCIA',
  'PAIS_RESIDENCIA',
  'NUMERO_SEGURIDAD_SOCIAL',
  'CODIGO_OCUPACION',
  'NIVEL_FORMATIVO',
  'IND_INCORPORA_ACTIVIDAD',
];

function isEmpty(val) {
  return val === undefined || val === null || String(val).trim() === '';
}

export function trabajadorToRecord(t) {
  if (!t) return {};
  return {
    IDENTIFICADORPFISICA: t.identificador_pfisica ?? '',
    NOMBRE: t.nombre ?? '',
    PRIMER_APELLIDO: t.primer_apellido ?? '',
    SEGUNDO_APELLIDO: t.segundo_apellido ?? '',
    SEXO: t.sexo ?? '',
    FECHA_NACIMIENTO: t.fecha_nacimiento ?? '',
    NACIONALIDAD: t.nacionalidad ?? '',
    MUNICIPIO_RESIDENCIA: t.municipio_residencia ?? '',
    PAIS_RESIDENCIA: t.pais_residencia ?? '',
    NUMERO_SEGURIDAD_SOCIAL: t.numero_seguridad_social ?? '',
    CODIGO_OCUPACION: t.codigo_ocupacion ?? '',
    NIVEL_FORMATIVO: t.nivel_formativo ?? '',
    IND_INCORPORA_ACTIVIDAD: t.ind_incorpora_actividad ?? '',
    CODIGO_INTERNO_A3: t.codigo_interno_a3 ?? '',
    CODIGO_EMPRESA_A3: t.codigo_empresa_a3 ?? '',
    A3_WORKER_TOKEN: t.a3_worker_token ?? '',
  };
}

export function empresaToRecord(e) {
  if (!e) return {};
  return {
    CCC: e.ccc ?? '',
    NIF_EMPRESA: e.nif_empresa ?? '',
    USOLIBRE_EMPRESA: e.usolibre_empresa ?? '',
    CLAVE_CONTRATO_TRANS: e.clave_contrato_trans ?? '',
    NIVEL_FORMATIVO: e.nivel_formativo ?? '',
    IND_INCORPORA_ACTIVIDAD: e.ind_incorpora_actividad ?? '',
  };
}

/**
 * Completa el registro: Excel tiene prioridad; vacíos se rellenan desde empresa/trabajador del sistema.
 */
export function mergeRecord(excelRecord, { empresa, trabajador, matchBy } = {}) {
  const merged = { ...excelRecord };
  const filledFrom = [];

  const empresaData = empresaToRecord(empresa);
  const trabajadorData = trabajadorToRecord(trabajador);

  for (const field of EMPRESA_DEFAULT_FIELDS) {
    const value = empresaData[field];
    if (isEmpty(merged[field]) && !isEmpty(value)) {
      merged[field] = value;
      filledFrom.push({ field, source: 'empresa' });
    }
  }

  if (empresa) {
    for (const field of EMPRESA_IDENTITY_FIELDS) {
      const value = empresaData[field];
      if (!isEmpty(value)) {
        if (merged[field] !== value) {
          merged[field] = value;
          filledFrom.push({ field, source: 'empresa' });
        }
      }
    }
  }

  for (const [field, value] of Object.entries(trabajadorData)) {
    if (isEmpty(merged[field]) && !isEmpty(value)) {
      merged[field] = value;
      filledFrom.push({ field, source: 'trabajador' });
    }
  }

  const codigoExcel =
    merged.CODIGO_TRABAJADOR || merged.CODIGO_DEL_TRABAJADOR || merged.CODIGO_INTERNO_A3;
  if (!isEmpty(codigoExcel)) {
    merged.CODIGO_TRABAJADOR = codigoExcel;
    merged.CODIGO_INTERNO_A3 = codigoExcel;
  }

  if (matchBy) {
    filledFrom.push({ field: '_match', source: 'trabajador', message: matchBy });
  }

  if (
    trabajador?.empresa_id &&
    empresa &&
    trabajador.empresa_id !== empresa.id
  ) {
    filledFrom.push({
      field: '_empresa',
      source: 'aviso',
      message: 'El trabajador pertenece a otra empresa en el sistema',
    });
  }

  const missingFields = ALL_FIELDS.filter((f) => isEmpty(merged[f]));

  return {
    record: merged,
    filledFrom,
    missingFields,
    matchedTrabajador: trabajador
      ? `${trabajador.nombre ?? ''} ${trabajador.primer_apellido ?? ''}`.trim()
      : null,
    matchedEmpresa: empresa?.nombre ?? null,
    matchBy: matchBy ?? null,
  };
}

export function resolveContext(excelRecord, store, { empresaId, trabajadorIndex } = {}) {
  const index =
    trabajadorIndex ?? buildTrabajadorIndex(store.trabajadores ?? []);
  const { trabajador, matchBy } = findTrabajadorInIndex(index, excelRecord);

  let empresa = null;

  if (empresaId) {
    empresa = store.empresas.find((e) => e.id === empresaId) ?? null;
  }
  if (!empresa && trabajador?.empresa_id) {
    empresa = store.empresas.find((e) => e.id === trabajador.empresa_id) ?? null;
  }
  if (!empresa) {
    const ccc = String(excelRecord.CCC ?? '').trim();
    const nif = normId(excelRecord.NIF_EMPRESA);
    empresa =
      store.empresas.find((e) => ccc && e.ccc === ccc) ??
      store.empresas.find((e) => nif && normId(e.nif_empresa) === nif) ??
      null;
  }

  return { empresa, trabajador, matchBy };
}

export { EMPRESA_FIELDS, TRABAJADOR_FIELDS, buildTrabajadorIndex };

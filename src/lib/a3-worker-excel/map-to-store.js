import { ALL_FIELDS } from '../../config/mapping.js';
import { EMPTY_WORKER_MASTER } from '../store/worker-master-store.js';
import {
  normalizeFechaYmd,
  normalizeIndIncorpora,
  normalizeNss,
  normalizeSexoStore,
  normalizeString,
} from './normalize.js';

/** Campos de identidad (único por DNI). */
export const PERSONA_STORE_KEYS = [
  'identificador_pfisica',
  'nombre',
  'primer_apellido',
  'segundo_apellido',
  'sexo',
  'fecha_nacimiento',
  'nacionalidad',
];

/**
 * Fila normalizada intermedia (claves internas del Excel A3).
 * @typedef {object} NormalizedExcelRow
 */

/**
 * @param {NormalizedExcelRow} row
 * @returns {object} Persona alineada con db.json (sin campos de contrato/empresa por fila).
 */
export function mapRowToPersona(row) {
  return {
    identificador_pfisica: row.dni,
    nombre: row.nombre,
    primer_apellido: row.apellido1,
    segundo_apellido: row.apellido2,
    sexo: normalizeSexoStore(row.sexo),
    fecha_nacimiento: row.fechaNacimientoYmd,
    nacionalidad: row.nacionalidad,
  };
}

/**
 * Payload listo para POST /api/trabajadores (un registro laboral = una fila Excel).
 * @param {NormalizedExcelRow} row
 * @param {{ empresa?: object | null, empresaId?: string | null }} context
 */
export function mapRowToTrabajadorPayload(row, context = {}) {
  const { empresa = null, empresaId = null } = context;
  const persona = mapRowToPersona(row);
  const master = { ...EMPTY_WORKER_MASTER() };

  master.codigo_interno_a3 = row.codigoInternoA3;
  master.estado_civil = row.estadoCivil;
  master.numero_hijos = row.numeroHijos;
  master.domicilio = row.domicilio;
  master.categoria = row.categoria;
  master.puesto_trabajo = row.puestoTrabajo;
  master.grupo_tarifa = row.grupoTarifa;
  master.tipo_contrato = row.tipoContrato;
  master.fecha_inicio_contrato = row.fechaInicioContratoYmd;
  master.fecha_fin_contrato = row.fechaFinContratoYmd;
  master.codigo_empresa_a3 =
    row.codigoEmpresaA3 || empresa?.codigo_empresa_a3?.trim() || '';
  master.nombre_empresa_pdf = empresa?.nombre_empresa?.trim() ?? '';

  let resolvedEmpresaId = empresaId || null;
  if (!resolvedEmpresaId && empresa?.id) {
    resolvedEmpresaId = empresa.id;
  }

  return {
    empresa_id: resolvedEmpresaId,
    ...persona,
    municipio_residencia: row.municipio,
    pais_residencia: row.pais || '724',
    numero_seguridad_social: row.nss,
    codigo_ocupacion: row.codigoOcupacion,
    nivel_formativo: row.nivelEstudios,
    ind_incorpora_actividad: row.indIncorpora,
    ...master,
  };
}

/**
 * Registro en formato SEPE (ALL_FIELDS) para generación XML / mergeRecord.
 * @param {NormalizedExcelRow} row
 * @param {{ empresa?: object | null }} context
 */
export function mapRowToLlamamientoRecord(row, context = {}) {
  const { empresa = null } = context;
  const record = {};
  for (const f of ALL_FIELDS) record[f] = '';

  record.IDENTIFICADORPFISICA = row.dni;
  record.NOMBRE = row.nombre;
  record.PRIMER_APELLIDO = row.apellido1;
  record.SEGUNDO_APELLIDO = row.apellido2;
  record.SEXO = normalizeSexoStore(row.sexo);
  record.FECHA_NACIMIENTO = row.fechaNacimientoYmd;
  record.NACIONALIDAD = row.nacionalidad;
  record.MUNICIPIO_RESIDENCIA = row.municipio;
  record.PAIS_RESIDENCIA = row.pais;
  record.NUMERO_SEGURIDAD_SOCIAL = row.nss;
  record.NIVEL_FORMATIVO = row.nivelEstudios;
  record.CODIGO_OCUPACION = row.codigoOcupacion;
  record.FECHA_INICIO = row.fechaInicioYmd;
  record.FECHA_FIN = row.fechaFinYmd;
  record.CLAVE_CONTRATO_TRANS = row.claveContrato;
  record.IND_INCORPORA_ACTIVIDAD = row.indIncorpora;
  record.USOLIBRE_EMPRESA = row.usolibreEmpresa;

  record.CCC = row.ccc || empresa?.ccc?.trim() || '';
  record.NIF_EMPRESA =
    row.nifEmpresa || empresa?.nif_empresa?.trim().toUpperCase() || '';
  record.CODIGO_EMPRESA_A3 =
    row.codigoEmpresaA3 || empresa?.codigo_empresa_a3?.trim() || '';

  return record;
}

/**
 * @param {NormalizedExcelRow} row
 * @param {number} filaExcel
 * @param {{ empresa?: object | null, empresaId?: string | null }} context
 */
export function mapRowToRegistroLaboral(row, filaExcel, context = {}) {
  return {
    filaExcel,
    trabajador: mapRowToTrabajadorPayload(row, context),
    llamamiento: mapRowToLlamamientoRecord(row, context),
  };
}

export function personaDiffers(a, b) {
  return getPersonaFieldDiffs(a, b).length > 0;
}

const PERSONA_FIELD_LABELS = {
  identificador_pfisica: 'DNI',
  nombre: 'Nombre',
  primer_apellido: 'Primer apellido',
  segundo_apellido: 'Segundo apellido',
  sexo: 'Sexo',
  fecha_nacimiento: 'F. nacimiento',
  nacionalidad: 'Nacionalidad',
};

/** Campos distintos entre dos personas (solo valores no vacíos en ambos). */
export function getPersonaFieldDiffs(canonical, alternativa) {
  const diffs = [];
  for (const k of PERSONA_STORE_KEYS) {
    if (k === 'identificador_pfisica') continue;
    const va = String(canonical[k] ?? '').trim();
    const vb = String(alternativa[k] ?? '').trim();
    if (va && vb && va !== vb) {
      diffs.push({
        campo: k,
        label: PERSONA_FIELD_LABELS[k] ?? k,
        canonical: va,
        alternativo: vb,
      });
    }
  }
  return diffs;
}

export function formatPersonaNombre(p) {
  return [p?.nombre, p?.primer_apellido, p?.segundo_apellido]
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * Normaliza una fila cruda del Excel a estructura intermedia.
 * @param {Record<string, string>} record
 */
export function normalizeExcelRow(record) {
  const dni = normalizeString(record.DNI).replace(/[\s-]/g, '');
  const dniValid =
    /^[0-9]{8}[A-Z]$/.test(dni) || /^[XYZ][0-9]{7}[A-Z]$/.test(dni);

  return {
    dni,
    dniValid,
    dniReason: dniValid ? '' : dni ? 'Formato DNI/NIE no válido' : 'DNI vacío',
    nombre: normalizeString(record.NOMBRE),
    apellido1: normalizeString(record.PRIMER_APELLIDO),
    apellido2: normalizeString(record.SEGUNDO_APELLIDO),
    sexo: record.SEXO,
    nacionalidad: normalizeString(record.NACIONALIDAD),
    municipio: normalizeString(record.MUNICIPIO),
    pais: normalizeString(record.PAIS),
    fechaNacimientoYmd: normalizeFechaYmd(record.FECHA_NACIMIENTO),
    nivelEstudios: normalizeString(record.NIVEL_ESTUDIOS),
    nss: normalizeNss(record.NUMERO_SEGURIDAD_SOCIAL),
    codigoOcupacion: normalizeString(record.CODIGO_OCUPACION),
    codigoInternoA3: normalizeString(record.CODIGO_INTERNO_A3),
    codigoEmpresaA3: normalizeString(record.CODIGO_EMPRESA_A3),
    tipoContrato: normalizeString(record.TIPO_CONTRATO),
    fechaInicioContratoYmd: normalizeFechaYmd(record.FECHA_INICIO_CONTRATO),
    fechaFinContratoYmd: normalizeFechaYmd(record.FECHA_FIN_CONTRATO),
    fechaInicioYmd: normalizeFechaYmd(record.FECHA_INICIO),
    fechaFinYmd: normalizeFechaYmd(record.FECHA_FIN),
    claveContrato: normalizeString(record.CLAVE_CONTRATO_TRANS),
    indIncorpora: normalizeIndIncorpora(record.IND_INCORPORA_ACTIVIDAD),
    categoria: normalizeString(record.CATEGORIA),
    puestoTrabajo: normalizeString(record.PUESTO_TRABAJO),
    grupoTarifa: normalizeString(record.GRUPO_TARIFA),
    domicilio: normalizeString(record.DOMICILIO),
    estadoCivil: normalizeString(record.ESTADO_CIVIL),
    numeroHijos: normalizeString(record.NUMERO_HIJOS),
    ccc: normalizeString(record.CCC),
    nifEmpresa: normalizeString(record.NIF_EMPRESA),
    usolibreEmpresa: normalizeString(record.USOLIBRE_EMPRESA),
  };
}

import { normalizeHeaderName } from './mapping.js';

/**
 * Excel estándar A3 de trabajadores (fuente parcial).
 * No incluye NSS, país, contrato, empresa, etc.
 */
export const A3_STANDARD_COLUMNS = [
  'DNI',
  'PRIMER_APELLIDO',
  'SEGUNDO_APELLIDO',
  'NOMBRE',
  'SEXO',
  'NACIONALIDAD',
  'MUNICIPIO',
  'FECHA_NACIMIENTO',
  'NIVEL_ESTUDIOS',
];

/** Obligatorios en cabecera del Excel A3 estándar. */
export const A3_REQUIRED_COLUMNS = ['DNI', 'NOMBRE', 'PRIMER_APELLIDO'];

/** Opcionales en el Excel A3 estándar (no generan aviso si faltan). */
export const A3_OPTIONAL_COLUMNS = [
  'SEXO',
  'FECHA_NACIMIENTO',
  'NACIONALIDAD',
  'MUNICIPIO',
  'NIVEL_ESTUDIOS',
  'SEGUNDO_APELLIDO',
];

/**
 * Columnas de otras fuentes (Saltra, ficha PDF, etc.).
 * Se leen si existen en el archivo; no se esperan en el Excel A3 estándar.
 */
export const A3_EXTENDED_COLUMNS = [
  'PAIS',
  'NUMERO_SEGURIDAD_SOCIAL',
  'CODIGO_OCUPACION',
  'CODIGO_INTERNO_A3',
  'CODIGO_EMPRESA_A3',
  'TIPO_CONTRATO',
  'FECHA_INICIO_CONTRATO',
  'FECHA_FIN_CONTRATO',
  'CATEGORIA',
  'PUESTO_TRABAJO',
  'GRUPO_TARIFA',
  'DOMICILIO',
  'ESTADO_CIVIL',
  'NUMERO_HIJOS',
  'CCC',
  'NIF_EMPRESA',
  'FECHA_INICIO',
  'FECHA_FIN',
  'CLAVE_CONTRATO_TRANS',
  'IND_INCORPORA_ACTIVIDAD',
  'USOLIBRE_EMPRESA',
];

/** Todas las columnas que el lector puede mapear. */
export const A3_WORKER_COLUMNS = [...A3_STANDARD_COLUMNS, ...A3_EXTENDED_COLUMNS];

/** Etiquetas legibles para la UI. */
export const A3_COLUMN_LABELS = {
  DNI: 'DNI/NIE',
  PRIMER_APELLIDO: 'Primer apellido',
  SEGUNDO_APELLIDO: 'Segundo apellido',
  NOMBRE: 'Nombre',
  SEXO: 'Sexo',
  NACIONALIDAD: 'Nacionalidad',
  MUNICIPIO: 'Municipio',
  FECHA_NACIMIENTO: 'Fecha nacimiento',
  NIVEL_ESTUDIOS: 'Nivel de estudios',
};

export function labelA3Column(key) {
  return A3_COLUMN_LABELS[key] ?? key;
}

export const A3_WORKER_HEADER_ALIASES = {
  DNI: ['DNI', 'NIE', 'DNI_NIE', 'DNI/NIE', 'NIF', 'NIF_NIE', 'DOCUMENTO', 'IDENTIFICADOR'],
  PRIMER_APELLIDO: ['PRIMER_APELLIDO', 'APELLIDO1', 'APELLIDO_1', '1ER_APELLIDO'],
  SEGUNDO_APELLIDO: ['SEGUNDO_APELLIDO', 'APELLIDO2', 'APELLIDO_2', '2O_APELLIDO'],
  NOMBRE: ['NOMBRE'],
  SEXO: ['SEXO', 'GENERO', 'GÉNERO'],
  NACIONALIDAD: ['NACIONALIDAD', 'COD_NACIONALIDAD', 'PAIS_NACIONALIDAD'],
  MUNICIPIO: ['MUNICIPIO', 'MUNICIPIO_RESIDENCIA', 'COD_MUNICIPIO'],
  FECHA_NACIMIENTO: [
    'FECHA_NACIMIENTO',
    'FEC_NACIMIENTO',
    'FECHA_DE_NACIMIENTO',
    'F_NACIMIENTO',
    'FNACIMIENTO',
    'FNAC',
    'FEC_NAC',
    'FECHA_NAC',
    'F_NAC',
    'F_NACIMIENTO',
    'F.NACIMIENTO',
    'F. NACIMIENTO',
    'FEC. NACIMIENTO',
    'FEC. NAC.',
    'NACIMIENTO',
    'FECHA NACIMIENTO',
    'FECHA NAC',
    'FECHA DE NACIMIENTO',
    'FECHA NACHIMIENTO',
    'FECHA_NACHIMIENTO',
  ],
  NIVEL_ESTUDIOS: [
    'NIVEL_ESTUDIOS',
    'NIVEL_DE_ESTUDIOS',
    'NIVEL_ESTUDIO',
    'NIVEL_FORMATIVO',
    'NIVEL FORMATIVO',
    'ESTUDIOS',
  ],
  PAIS: ['PAIS', 'PAIS_RESIDENCIA', 'PAÍS', 'PAÍS_RESIDENCIA', 'COD_PAIS'],
  NUMERO_SEGURIDAD_SOCIAL: [
    'NUMERO_SEGURIDAD_SOCIAL',
    'NSS',
    'NAF',
    'NUM_SS',
    'SEGURIDAD_SOCIAL',
    'NUMERO_SS',
  ],
  CODIGO_OCUPACION: ['CODIGO_OCUPACION', 'OCUPACION', 'CNO', 'COD_OCUPACION'],
  CODIGO_INTERNO_A3: [
    'CODIGO_INTERNO_A3',
    'CODIGO_TRABAJADOR',
    'CODIGO_DEL_TRABAJADOR',
    'COD_TRABAJADOR',
  ],
  CODIGO_EMPRESA_A3: [
    'CODIGO_EMPRESA_A3',
    'CODIGO_EMPRESA',
    'COD_EMPRESA',
    'EMPRESA_A3',
  ],
  TIPO_CONTRATO: ['TIPO_CONTRATO', 'CONTRATO'],
  FECHA_INICIO_CONTRATO: [
    'FECHA_INICIO_CONTRATO',
    'INICIO_CONTRATO',
    'FEC_INICIO_CONTRATO',
  ],
  FECHA_FIN_CONTRATO: ['FECHA_FIN_CONTRATO', 'FIN_CONTRATO', 'FEC_FIN_CONTRATO'],
  CATEGORIA: ['CATEGORIA', 'CATEGORÍA'],
  PUESTO_TRABAJO: ['PUESTO_TRABAJO', 'PUESTO', 'PUESTO_DE_TRABAJO'],
  GRUPO_TARIFA: ['GRUPO_TARIFA', 'GRUPO_DE_TARIFA'],
  DOMICILIO: ['DOMICILIO', 'DIRECCION', 'DIRECCIÓN'],
  ESTADO_CIVIL: ['ESTADO_CIVIL'],
  NUMERO_HIJOS: ['NUMERO_HIJOS', 'NUM_HIJOS', 'HIJOS'],
  CCC: ['CCC', 'CUENTA_COTIZACION', 'CUENTA_COTIZACIÓN', 'CTA_COTIZACION'],
  NIF_EMPRESA: ['NIF_EMPRESA', 'CIF', 'CIF_EMPRESA', 'NIF_CIF'],
  FECHA_INICIO: [
    'FECHA_INICIO',
    'FEC_INICIO',
    'INICIO',
    'FECHA_INICIO_LLAMAMIENTO',
  ],
  FECHA_FIN: ['FECHA_FIN', 'FEC_FIN', 'FIN', 'FECHA_FIN_LLAMAMIENTO'],
  CLAVE_CONTRATO_TRANS: [
    'CLAVE_CONTRATO_TRANS',
    'CLAVE_CONTRATO',
    'TIPO_CONTRATO_TRANS',
  ],
  IND_INCORPORA_ACTIVIDAD: [
    'IND_INCORPORA_ACTIVIDAD',
    'INCORPORA_ACTIVIDAD',
    'INCORPORA',
    'SE_INCORPORA',
  ],
  USOLIBRE_EMPRESA: ['USOLIBRE_EMPRESA', 'USO_LIBRE', 'REFERENCIA', 'REF_EMPRESA'],
};

const aliasLookup = new Map();
for (const [field, aliases] of Object.entries(A3_WORKER_HEADER_ALIASES)) {
  for (const alias of aliases) {
    aliasLookup.set(normalizeHeaderName(alias), field);
  }
}

export function resolveA3WorkerHeader(header) {
  const norm = normalizeHeaderName(header);
  if (aliasLookup.has(norm)) return aliasLookup.get(norm);
  if (A3_WORKER_COLUMNS.includes(norm)) return norm;
  return null;
}

/**
 * Metadatos de columnas para fuente parcial A3.
 * @param {string[]} detectedColumns
 */
export function buildA3PartialColumnMeta(detectedColumns) {
  const detected = new Set(detectedColumns);
  const availableInFile = A3_STANDARD_COLUMNS.filter((c) => detected.has(c));
  const optionalNotInFile = A3_OPTIONAL_COLUMNS.filter((c) => !detected.has(c));
  const missingRequired = A3_REQUIRED_COLUMNS.filter((c) => !detected.has(c));
  const extendedPresent = A3_EXTENDED_COLUMNS.filter((c) => detected.has(c));
  const extendedAbsent = A3_EXTENDED_COLUMNS.filter((c) => !detected.has(c));

  return {
    partialSource: true,
    schema: 'a3-trabajadores-parcial',
    detectedColumns: [...detectedColumns],
    availableInFile,
    optionalNotInFile,
    missingRequired,
    extendedPresent,
    extendedAbsent,
    /** @deprecated usar extendedAbsent — informativo, no es error */
    absentFromFile: extendedAbsent,
  };
}

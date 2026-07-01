/** Campos SEPE (clave interna = etiqueta XML). */
export const ALL_FIELDS = [
  'CCC',
  'NIF_EMPRESA',
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
  'FECHA_INICIO',
  'FECHA_FIN',
  'CLAVE_CONTRATO_TRANS',
  'IND_INCORPORA_ACTIVIDAD',
  'CODIGO_OCUPACION',
  'NIVEL_FORMATIVO',
  'USOLIBRE_EMPRESA',
];

/** Campos leídos del Excel pero no exportados al XML (join, USOLIBRE). */
export const EXCEL_AUX_FIELDS = [
  'CODIGO_TRABAJADOR',
  'CODIGO_DEL_TRABAJADOR',
  'CODIGO_INTERNO_A3',
  'CODIGO_EMPRESA_A3',
  'CODIGO_CONTRATO_CORTO',
  'A3_WORKER_TOKEN',
];

/**
 * Alias de cabeceras Excel (normalizadas: MAYÚSCULAS, sin espacios extra).
 * Incluye nombres SEPE y exportaciones típicas de Saltra.
 */
export const HEADER_ALIASES = {
  CCC: [
    'CCC',
    'CUENTA_COTIZACION',
    'CUENTA_COTIZACIÓN',
    'CUENTA_DE_COTIZACION',
    'CTA_COTIZACION',
  ],
  NIF_EMPRESA: ['NIF_EMPRESA', 'CIF', 'CIF_EMPRESA', 'NIF', 'NIF_CIF'],
  IDENTIFICADORPFISICA: [
    'IDENTIFICADORPFISICA',
    'DNI',
    'NIF_TRABAJADOR',
    'NIF_DNI_CIF',
    'NIF/DNI/CIF',
    'DOCUMENTO',
    'DOC',
    'ID_TRABAJADOR',
    'IDENTIFICADOR',
  ],
  NOMBRE: ['NOMBRE', 'NOMBRE_TRABAJADOR'],
  PRIMER_APELLIDO: [
    'PRIMER_APELLIDO',
    'APELLIDO1',
    'APELLIDO_1',
    'PRIMER_APELLIDO_TRABAJADOR',
    'APELLIDO',
  ],
  SEGUNDO_APELLIDO: [
    'SEGUNDO_APELLIDO',
    'APELLIDO2',
    'APELLIDO_2',
    'SEGUNDO_APELLIDO_TRABAJADOR',
  ],
  SEXO: ['SEXO', 'GENERO', 'GÉNERO'],
  FECHA_NACIMIENTO: [
    'FECHA_NACIMIENTO',
    'FEC_NACIMIENTO',
    'NACIMIENTO',
    'FECHA_DE_NACIMIENTO',
  ],
  NACIONALIDAD: ['NACIONALIDAD', 'COD_NACIONALIDAD'],
  MUNICIPIO_RESIDENCIA: [
    'MUNICIPIO_RESIDENCIA',
    'MUNICIPIO',
    'COD_MUNICIPIO',
    'MUNICIPIO_RES',
  ],
  PAIS_RESIDENCIA: ['PAIS_RESIDENCIA', 'PAIS', 'COD_PAIS', 'PAÍS_RESIDENCIA'],
  NUMERO_SEGURIDAD_SOCIAL: [
    'NUMERO_SEGURIDAD_SOCIAL',
    'NSS',
    'NAF',
    'NUM_SS',
    'SEGURIDAD_SOCIAL',
    'NUMERO_SS',
  ],
  FECHA_INICIO: [
    'FECHA_INICIO',
    'FEC_INICIO',
    'INICIO',
    'STARTDATE',
    'FECHA_INICIO_LLAMAMIENTO',
  ],
  FECHA_FIN: ['FECHA_FIN', 'FEC_FIN', 'FIN', 'ENDDATE', 'FECHA_FIN_LLAMAMIENTO'],
  CLAVE_CONTRATO_TRANS: [
    'CLAVE_CONTRATO_TRANS',
    'CLAVE_CONTRATO',
    'CONTRATO',
    'TIPO_CONTRATO',
  ],
  IND_INCORPORA_ACTIVIDAD: [
    'IND_INCORPORA_ACTIVIDAD',
    'INCORPORA_ACTIVIDAD',
    'QUESTION',
    'INCORPORA',
    'SE_INCORPORA',
  ],
  CODIGO_OCUPACION: ['CODIGO_OCUPACION', 'OCUPACION', 'CNO', 'COD_OCUPACION'],
  NIVEL_FORMATIVO: ['NIVEL_FORMATIVO', 'NIVEL_FORMAT', 'FORMACION'],
  USOLIBRE_EMPRESA: ['USOLIBRE_EMPRESA', 'USO_LIBRE', 'REFERENCIA', 'REF_EMPRESA'],
  CODIGO_TRABAJADOR: [
    'CODIGO_TRABAJADOR',
    'CODIGO_DEL_TRABAJADOR',
    'CODIGO_DE_TRABAJADOR',
    'CODIGO_INTERNO_A3',
    'COD_TRABAJADOR',
    'CODIGO_TRAB',
  ],
  CODIGO_DEL_TRABAJADOR: [
    'CODIGO_DEL_TRABAJADOR',
    'CODIGO_DE_TRABAJADOR',
    'CODIGO_TRABAJADOR',
    'CODIGO_INTERNO_A3',
  ],
  CODIGO_INTERNO_A3: [
    'CODIGO_INTERNO_A3',
    'CODIGO_TRABAJADOR',
    'CODIGO_DEL_TRABAJADOR',
    'COD_TRABAJADOR',
  ],
  CODIGO_EMPRESA_A3: ['CODIGO_EMPRESA_A3', 'CODIGO_EMPRESA'],
  CODIGO_CONTRATO_CORTO: ['CODIGO_CONTRATO_CORTO', 'CONTRATO_CORTO', 'COD_CONTRATO'],
};

/** Orden y rutas XML bajo LLAMAMIENTO_TIPO (estructura A3 L2606002). */
export const XML_STRUCTURE = [
  {
    block: 'DATOS_EMPRESA',
    fields: [
      {
        container: 'CIF_NIF_EMPRESA',
        fields: [{ xml: 'CIF_NIF', key: 'NIF_EMPRESA' }],
      },
      { xml: 'CCC', key: 'CCC' },
    ],
  },
  {
    block: 'DATOS_TRABAJADOR',
    fields: [
      { xml: 'IDENTIFICADORPFISICA', key: 'IDENTIFICADORPFISICA' },
      {
        container: 'NOMBRE_APELLIDOS',
        fields: [
          { xml: 'NOMBRE', key: 'NOMBRE' },
          { xml: 'PRIMER_APELLIDO', key: 'PRIMER_APELLIDO' },
          { xml: 'SEGUNDO_APELLIDO', key: 'SEGUNDO_APELLIDO' },
        ],
      },
      { xml: 'SEXO', key: 'SEXO' },
      { xml: 'FECHA_NACIMIENTO', key: 'FECHA_NACIMIENTO', format: 'date' },
      { xml: 'NACIONALIDAD', key: 'NACIONALIDAD' },
      { xml: 'MUNICIPIO_RESIDENCIA', key: 'MUNICIPIO_RESIDENCIA' },
      { xml: 'PAIS_RESIDENCIA', key: 'PAIS_RESIDENCIA' },
      { xml: 'NUMERO_SEGURIDAD_SOCIAL', key: 'NUMERO_SEGURIDAD_SOCIAL' },
    ],
  },
  {
    block: 'DATOS_LLAMAMIENTO',
    fields: [
      { xml: 'FECHA_INICIO', key: 'FECHA_INICIO', format: 'date' },
      { xml: 'FECHA_FIN', key: 'FECHA_FIN', format: 'date' },
      { xml: 'CLAVE_CONTRATO_TRANS', key: 'CLAVE_CONTRATO_TRANS' },
      { xml: 'IND_INCORPORA_ACTIVIDAD', key: 'IND_INCORPORA_ACTIVIDAD' },
      { xml: 'CODIGO_OCUPACION', key: 'CODIGO_OCUPACION' },
      { xml: 'NIVEL_FORMATIVO', key: 'NIVEL_FORMATIVO' },
    ],
  },
  {
    block: 'DATOS_USOLIBRE_EMPRESA',
    fields: [{ xml: 'USOLIBRE_EMPRESA', key: 'USOLIBRE_EMPRESA' }],
  },
];

export const MAX_RECORDS_PER_XML = 30;
export const XML_ENCODING = 'ISO-8859-1';
/** Extensión exigida por SEPE al exportar ficheros. */
export const XML_FILE_EXTENSION = '.XML';

/** Nombre de fichero de exportación con extensión .XML */
export function buildXmlExportFileName(baseName, partSuffix = '') {
  const stem = String(baseName ?? '')
    .trim()
    .replace(/\.(xml|XML)$/i, '');
  return `${stem}${partSuffix}${XML_FILE_EXTENSION}`;
}

/** Valor en el XML cuando no hay dato (exportación incompleta). */
export const MISSING_PLACEHOLDER = '???????';

/** Campos que pueden ir vacíos en el XML (sin placeholder). */
export const XML_OPTIONAL_EMPTY_FIELDS = new Set([
  'NUMERO_SEGURIDAD_SOCIAL',
  'CLAVE_CONTRATO_TRANS',
]);

export function isEmptyValue(val) {
  return val === undefined || val === null || String(val).trim() === '';
}

/** Sustituye campos vacíos por el marcador antes de generar XML. */
export function fillMissingForXml(record) {
  const out = { ...record };
  for (const field of ALL_FIELDS) {
    if (XML_OPTIONAL_EMPTY_FIELDS.has(field)) {
      if (out[field] === undefined || out[field] === null) {
        out[field] = '';
      }
      continue;
    }
    if (isEmptyValue(out[field])) {
      out[field] = MISSING_PLACEHOLDER;
    }
  }
  return out;
}

const aliasLookup = new Map();
for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
  for (const alias of aliases) {
    aliasLookup.set(normalizeHeaderName(alias), field);
  }
}

export function normalizeHeaderName(name) {
  return String(name ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_');
}

export function resolveHeaderToField(header) {
  const norm = normalizeHeaderName(header);
  if (aliasLookup.has(norm)) return aliasLookup.get(norm);
  if (ALL_FIELDS.includes(norm)) return norm;
  return null;
}

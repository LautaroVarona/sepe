/** Generación XML SEPE L2606002 en el navegador (sin POST a Vercel). */

export const MAX_RECORDS_PER_XML = 30;
const MISSING_PLACEHOLDER = '???????';
const XML_OPTIONAL_EMPTY_FIELDS = new Set([
  'NUMERO_SEGURIDAD_SOCIAL',
  'CLAVE_CONTRATO_TRANS',
]);

const ALL_FIELDS = [
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

const XML_STRUCTURE = [
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
      { xml: 'FECHA_NACIMIENTO', key: 'FECHA_NACIMIENTO' },
      { xml: 'NACIONALIDAD', key: 'NACIONALIDAD' },
      { xml: 'MUNICIPIO_RESIDENCIA', key: 'MUNICIPIO_RESIDENCIA' },
      { xml: 'PAIS_RESIDENCIA', key: 'PAIS_RESIDENCIA' },
      { xml: 'NUMERO_SEGURIDAD_SOCIAL', key: 'NUMERO_SEGURIDAD_SOCIAL' },
    ],
  },
  {
    block: 'DATOS_LLAMAMIENTO',
    fields: [
      { xml: 'FECHA_INICIO', key: 'FECHA_INICIO' },
      { xml: 'FECHA_FIN', key: 'FECHA_FIN' },
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

function isEmpty(val) {
  return val === undefined || val === null || String(val).trim() === '';
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeNieIdentificador(value) {
  let d = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '');
  if (!d) return '';
  if (/^0\d{8}[A-Z]$/.test(d)) d = d.slice(1);
  return d.replace(/^0+(?=[A-Z])/, '');
}

function isValidClaveContratoTrans(value) {
  return /^E\d{15}$/.test(String(value ?? '').trim());
}

function formatIdentificadorPfisicaForXml(value) {
  let id = normalizeNieIdentificador(value);
  if (!id) return '';
  if (/^[DEUW]/i.test(id)) return id.toUpperCase();
  if (/^[XYZ]/i.test(id)) return `E${id.toUpperCase()}`;
  return `D${id.toUpperCase()}`;
}

function formatCodigoOcupacionForXml(value) {
  if (isEmpty(value)) return '';
  const raw = String(value).trim();
  if (raw === MISSING_PLACEHOLDER) return raw;
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (!digits) return raw.substring(0, 8).padEnd(8, ' ');
  return digits.padEnd(8, ' ');
}

function sanitizeClaveContratoTrans(value) {
  const v = String(value ?? '').trim();
  if (isValidClaveContratoTrans(v)) return v;
  if (/^\d{1,4}$/.test(v)) return v;
  return '';
}

export function applySepeXmlFormatRules(record) {
  const out = { ...record };
  if (!isEmpty(out.IDENTIFICADORPFISICA)) {
    out.IDENTIFICADORPFISICA = formatIdentificadorPfisicaForXml(out.IDENTIFICADORPFISICA);
  }
  if (!isEmpty(out.CODIGO_OCUPACION)) {
    out.CODIGO_OCUPACION = formatCodigoOcupacionForXml(out.CODIGO_OCUPACION);
  }
  out.CLAVE_CONTRATO_TRANS = sanitizeClaveContratoTrans(out.CLAVE_CONTRATO_TRANS);
  return out;
}

export function fillMissingForXml(record) {
  const out = { ...record };
  for (const field of ALL_FIELDS) {
    if (XML_OPTIONAL_EMPTY_FIELDS.has(field)) {
      if (out[field] === undefined || out[field] === null) out[field] = '';
      continue;
    }
    if (isEmpty(out[field])) out[field] = MISSING_PLACEHOLDER;
  }
  return out;
}

function formatFieldValue(value, field) {
  if (field.key === 'IDENTIFICADORPFISICA') {
    if (isEmpty(value)) return MISSING_PLACEHOLDER;
    return formatIdentificadorPfisicaForXml(value);
  }
  if (field.key === 'CODIGO_OCUPACION') {
    if (isEmpty(value)) return MISSING_PLACEHOLDER;
    return formatCodigoOcupacionForXml(value);
  }
  if (isEmpty(value)) {
    if (XML_OPTIONAL_EMPTY_FIELDS.has(field.key)) return '';
    return MISSING_PLACEHOLDER;
  }
  return String(value).trim();
}

function appendFields(lines, fields, record, indent) {
  const pad = '  '.repeat(indent);
  for (const field of fields) {
    if (field.container) {
      lines.push(`${pad}<${field.container}>`);
      appendFields(lines, field.fields, record, indent + 1);
      lines.push(`${pad}</${field.container}>`);
      continue;
    }
    if (field.key === 'CLAVE_CONTRATO_TRANS' && !isValidClaveContratoTrans(record[field.key])) {
      continue;
    }
    const value = formatFieldValue(record[field.key], field);
    lines.push(`${pad}<${field.xml}>${escapeXml(value)}</${field.xml}>`);
  }
}

export function buildLlamamientosXml(records) {
  const lines = [
    '<?xml version="1.0" encoding="ISO-8859-1"?>',
    '<LLAMAMIENTOS>',
  ];
  for (const record of records) {
    lines.push('  <LLAMAMIENTO_TIPO>');
    for (const section of XML_STRUCTURE) {
      lines.push(`    <${section.block}>`);
      appendFields(lines, section.fields, record, 3);
      lines.push(`    </${section.block}>`);
    }
    lines.push('  </LLAMAMIENTO_TIPO>');
  }
  lines.push('</LLAMAMIENTOS>');
  return `${lines.join('\n')}\n`;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function padPart(num, width) {
  return String(num).padStart(width, '0');
}

export function buildXmlExportFileName(baseName, partSuffix = '') {
  const stem = String(baseName ?? '')
    .trim()
    .replace(/\.(xml|XML)$/i, '');
  return `${stem}${partSuffix}.XML`;
}

/**
 * @param {Array<{ record: object, complete?: boolean }>} processedRows
 */
export function buildXmlFilesFromRecords(processedRows, baseName, options = {}) {
  const chunkSize =
    options.singleFile || options.maxPerFile === 0
      ? Math.max(processedRows.length, 1)
      : options.maxPerFile ?? MAX_RECORDS_PER_XML;

  const records = processedRows.map((r) =>
    fillMissingForXml(applySepeXmlFormatRules(r.record ?? r)),
  );
  const chunks = chunkArray(records, chunkSize);
  const chunkMeta = chunkArray(processedRows, chunkSize);
  const totalParts = chunks.length;

  const files = chunks.map((chunk, i) => {
    const part = i + 1;
    const suffix = totalParts > 1 ? `_${padPart(part, 3)}` : '';
    return {
      name: buildXmlExportFileName(baseName, suffix),
      xml: buildLlamamientosXml(chunk),
      count: chunk.length,
      part,
      totalParts,
      startRow: i * chunkSize,
      incompleteInFile: chunkMeta[i].filter((r) => !r.complete).length,
    };
  });

  return { files, recordCount: records.length };
}

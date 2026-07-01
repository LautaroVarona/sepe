import { writeFileSync } from 'fs';
import { create } from 'xmlbuilder2';
import {
  XML_STRUCTURE,
  XML_ENCODING,
  MISSING_PLACEHOLDER,
  XML_OPTIONAL_EMPTY_FIELDS,
  isEmptyValue,
} from '../config/mapping.js';
import {
  isValidClaveContratoTrans,
  formatIdentificadorPfisicaForXml,
  formatCodigoOcupacionForXml,
} from './sepeXmlFormat.js';

/**
 * Construye el documento XML con estructura exacta SEPE L2606002.
 */
export function buildLlamamientosXml(records) {
  const root = create({ version: '1.0', encoding: XML_ENCODING }).ele('LLAMAMIENTOS');

  for (const record of records) {
    const llamamiento = root.ele('LLAMAMIENTO_TIPO');

    for (const section of XML_STRUCTURE) {
      const block = llamamiento.ele(section.block);
      appendXmlFields(block, section.fields, record);
    }
  }

  return root.end({ prettyPrint: true, headless: false });
}

function appendXmlFields(parent, fields, record) {
  for (const field of fields) {
    if (field.container) {
      appendXmlFields(parent.ele(field.container), field.fields, record);
      continue;
    }
    if (field.key === 'CLAVE_CONTRATO_TRANS' && !isValidClaveContratoTrans(record[field.key])) {
      continue;
    }
    const value = formatFieldValue(record[field.key], field);
    parent.ele(field.xml).txt(value);
  }
}

function formatFieldValue(value, field) {
  if (field.key === 'IDENTIFICADORPFISICA') {
    if (value === undefined || value === null || isEmptyValue(value)) {
      return MISSING_PLACEHOLDER;
    }
    return formatIdentificadorPfisicaForXml(value);
  }

  if (field.key === 'CODIGO_OCUPACION') {
    if (value === undefined || value === null || isEmptyValue(value)) {
      return MISSING_PLACEHOLDER;
    }
    return formatCodigoOcupacionForXml(value);
  }

  if (value === undefined || value === null) {
    if (XML_OPTIONAL_EMPTY_FIELDS.has(field.key)) return '';
    return MISSING_PLACEHOLDER;
  }
  if (isEmptyValue(value)) {
    if (XML_OPTIONAL_EMPTY_FIELDS.has(field.key)) return '';
    return MISSING_PLACEHOLDER;
  }
  if (field.format === 'date') {
    return String(value).trim();
  }
  return String(value).trim();
}

/**
 * Escribe el XML en disco con codificación ISO-8859-1 (latin1 en Node).
 */
export function writeXmlFile(filePath, xmlString) {
  writeFileSync(filePath, xmlString, { encoding: 'latin1' });
}

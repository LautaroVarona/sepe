import { writeFileSync } from 'fs';
import { create } from 'xmlbuilder2';
import {
  XML_STRUCTURE,
  XML_ENCODING,
  MISSING_PLACEHOLDER,
  XML_OPTIONAL_EMPTY_FIELDS,
  isEmptyValue,
} from '../config/mapping.js';

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
    const value = formatFieldValue(record[field.key], field);
    parent.ele(field.xml).txt(value);
  }
}

function formatFieldValue(value, field) {
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

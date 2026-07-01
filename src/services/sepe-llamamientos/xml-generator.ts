import { writeFileSync } from 'node:fs';
import { create } from 'xmlbuilder2';
import type { GeneratedXmlFile, SepeLlamamientoRecord } from './types.js';
import {
  formatCodigoOcupacion,
  formatIdentificadorPfisicaForXml,
  isValidClaveContratoTrans,
} from './normalize.js';

export const XML_ENCODING = 'ISO-8859-1';
export const MAX_RECORDS_PER_XML = 30;
export const MISSING_PLACEHOLDER = '???????';

/** Estructura L2606002 (referencia fuentes/L2606002.XML) */
const XML_STRUCTURE = [
  {
    block: 'DATOS_EMPRESA',
    fields: [
      {
        container: 'CIF_NIF_EMPRESA',
        fields: [{ xml: 'CIF_NIF', key: 'NIF_EMPRESA' as const }],
      },
      { xml: 'CCC', key: 'CCC' as const },
    ],
  },
  {
    block: 'DATOS_TRABAJADOR',
    fields: [
      { xml: 'IDENTIFICADORPFISICA', key: 'IDENTIFICADORPFISICA' as const },
      {
        container: 'NOMBRE_APELLIDOS',
        fields: [
          { xml: 'NOMBRE', key: 'NOMBRE' as const },
          { xml: 'PRIMER_APELLIDO', key: 'PRIMER_APELLIDO' as const },
          { xml: 'SEGUNDO_APELLIDO', key: 'SEGUNDO_APELLIDO' as const },
        ],
      },
      { xml: 'SEXO', key: 'SEXO' as const },
      { xml: 'FECHA_NACIMIENTO', key: 'FECHA_NACIMIENTO' as const },
      { xml: 'NACIONALIDAD', key: 'NACIONALIDAD' as const },
      { xml: 'MUNICIPIO_RESIDENCIA', key: 'MUNICIPIO_RESIDENCIA' as const },
      { xml: 'PAIS_RESIDENCIA', key: 'PAIS_RESIDENCIA' as const },
      { xml: 'NUMERO_SEGURIDAD_SOCIAL', key: 'NUMERO_SEGURIDAD_SOCIAL' as const },
    ],
  },
  {
    block: 'DATOS_LLAMAMIENTO',
    fields: [
      { xml: 'FECHA_INICIO', key: 'FECHA_INICIO' as const },
      { xml: 'FECHA_FIN', key: 'FECHA_FIN' as const },
      { xml: 'CLAVE_CONTRATO_TRANS', key: 'CLAVE_CONTRATO_TRANS' as const },
      { xml: 'IND_INCORPORA_ACTIVIDAD', key: 'IND_INCORPORA_ACTIVIDAD' as const },
      { xml: 'CODIGO_OCUPACION', key: 'CODIGO_OCUPACION' as const },
      { xml: 'NIVEL_FORMATIVO', key: 'NIVEL_FORMATIVO' as const },
    ],
  },
  {
    block: 'DATOS_USOLIBRE_EMPRESA',
    fields: [{ xml: 'USOLIBRE_EMPRESA', key: 'USOLIBRE_EMPRESA' as const }],
  },
] as const;

type FieldDef =
  | { xml: string; key: keyof SepeLlamamientoRecord }
  | { container: string; fields: FieldDef[] };

function fieldValue(record: SepeLlamamientoRecord, key: keyof SepeLlamamientoRecord): string {
  if (key === 'IDENTIFICADORPFISICA') {
    const val = record[key];
    if (val === undefined || val === null || String(val).trim() === '') return MISSING_PLACEHOLDER;
    return formatIdentificadorPfisicaForXml(val);
  }
  if (key === 'CODIGO_OCUPACION') {
    const val = record[key];
    if (val === undefined || val === null || String(val).trim() === '') return MISSING_PLACEHOLDER;
    return formatCodigoOcupacion(val);
  }
  const val = record[key];
  if (val === undefined || val === null || String(val).trim() === '') {
    if (key === 'NUMERO_SEGURIDAD_SOCIAL' || key === 'CLAVE_CONTRATO_TRANS') return '';
    return MISSING_PLACEHOLDER;
  }
  return String(val).trim();
}

function appendFields(
  parent: ReturnType<ReturnType<typeof create>['ele']>,
  fields: readonly FieldDef[],
  record: SepeLlamamientoRecord,
): void {
  for (const field of fields) {
    if ('container' in field) {
      appendFields(parent.ele(field.container), field.fields, record);
      continue;
    }
    if (field.key === 'CLAVE_CONTRATO_TRANS' && !isValidClaveContratoTrans(record[field.key])) {
      continue;
    }
    parent.ele(field.xml).txt(fieldValue(record, field.key));
  }
}

/** Genera XML con declaración encoding ISO-8859-1 */
export function buildLlamamientosXml(records: SepeLlamamientoRecord[]): string {
  const root = create({ version: '1.0', encoding: XML_ENCODING }).ele('LLAMAMIENTOS');

  for (const record of records) {
    const llamamiento = root.ele('LLAMAMIENTO_TIPO');
    for (const section of XML_STRUCTURE) {
      appendFields(llamamiento.ele(section.block), section.fields, record);
    }
  }

  return root.end({ prettyPrint: true, headless: false });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function buildXmlFiles(
  records: SepeLlamamientoRecord[],
  baseName: string,
  maxPerFile = MAX_RECORDS_PER_XML,
): GeneratedXmlFile[] {
  const chunks = chunk(records, maxPerFile);
  const totalParts = chunks.length || 1;

  if (records.length === 0) {
    return [
      {
        name: `${baseName}.XML`,
        xml: buildLlamamientosXml([]),
        count: 0,
        part: 1,
        totalParts: 1,
      },
    ];
  }

  return chunks.map((chunkRecords, i) => {
    const part = i + 1;
    const suffix = totalParts > 1 ? `_${String(part).padStart(3, '0')}` : '';
    return {
      name: `${baseName}${suffix}.XML`,
      xml: buildLlamamientosXml(chunkRecords),
      count: chunkRecords.length,
      part,
      totalParts,
    };
  });
}

/** Escribe fichero en ISO-8859-1 (latin1 en Node) */
export function writeXmlLatin1(filePath: string, xml: string): void {
  writeFileSync(filePath, xml, { encoding: 'latin1' });
}

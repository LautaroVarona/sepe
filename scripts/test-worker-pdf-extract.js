/**
 * Prueba del extractor ficha trabajador A3.
 * Ejecutar: npm run test:worker-pdf
 */
import { readFileSync, existsSync } from 'fs';
import { normalizeWorkerPdfText } from '../src/lib/pdf/text-normalizer.js';
import {
  segmentWorkerBlocks,
  extractWorkerFields,
} from '../src/lib/parsers/worker-field-extractor.js';
import { parseWorkerPdf } from '../src/lib/pdf/worker-parser.js';

const WORKER_1 = `
Ficha del Trabajador
Trabajador 10001 - GARCIA LOPEZ, JUAN
Empresa 96280 - EL ALTO VALENCIA, S.L.
Fecha listado 03/06/2026 Página 1
Datos de filiación
Código del Trabajador	10001
N.I.F.	12345678A
Nombre del Trabajador	JUAN
Primer Apellido	GARCIA
Segundo Apellido	LOPEZ
Número de la Seguridad Social	12 3456789 01
Sexo	H
Fecha Nacimiento	15/03/1985
Nacionalidad	011
Municipio	VALENCIA
País	011
Estado Civil	Casado/a
Número de Hijos	2
Datos de contrato
Tipo de Contrato	Indefinido
Fecha Inicio Contrato	01/01/2020
Fecha Fin Contrato
`;

const WORKER_2 = `
Ficha del Trabajador
Trabajador 10002 - MARTINEZ RUIZ, MARIA
Empresa 96280 - EL ALTO VALENCIA, S.L.
Página 1
Código del Trabajador	10002
N.I.F.	X1234567L
Nombre del Trabajador	MARIA
Primer Apellido	MARTINEZ
Segundo Apellido	RUIZ
Número de la Seguridad Social	98 7654321 09
Sexo	M
Fecha de Nacimiento	22/07/1990
Nacionalidad	011
Municipio residencia	VALENCIA
País de residencia	011
Datos de contrato
Tipo Contrato	Temporal
Fecha Inicio	01/06/2024
Fecha Fin Contrato	31/12/2024
`;

const SAMPLE_MULTI = WORKER_1 + WORKER_2;

function assertWorker(name, extracted, expected) {
  let failed = 0;
  for (const [key, exp] of Object.entries(expected)) {
    const got = extracted[key];
    if (got !== exp) {
      console.error(`[${name}] FAIL ${key}: expected "${exp}", got "${got}"`);
      failed++;
    }
  }
  if (failed) {
    console.log(JSON.stringify(extracted, null, 2));
    return false;
  }
  console.log(`OK — ${name}`);
  return true;
}

function testSegmentation() {
  const text = normalizeWorkerPdfText(SAMPLE_MULTI);
  const blocks = segmentWorkerBlocks(text);
  if (blocks.length !== 2) {
    console.error(`FAIL segmentación: expected 2 blocks, got ${blocks.length}`);
    return false;
  }
  console.log('OK — segmentación (2 trabajadores)');
  return true;
}

let ok = testSegmentation();

const text = normalizeWorkerPdfText(SAMPLE_MULTI);
const blocks = segmentWorkerBlocks(text);
const w1 = extractWorkerFields(blocks[0]);
const w2 = extractWorkerFields(blocks[1]);

ok =
  assertWorker('trabajador 1', w1, {
    codigoInterno: '10001',
    nifNie: '12345678A',
    nombre: 'JUAN',
    primerApellido: 'GARCIA',
    segundoApellido: 'LOPEZ',
    numeroSeguridadSocial: '12345678901',
    sexo: '1',
    fechaNacimiento: '19850315',
    tipoContrato: 'Indefinido',
    fechaInicioContrato: '20200101',
    codigoEmpresaA3: '96280',
  }) && ok;

ok =
  assertWorker('trabajador 2', w2, {
    codigoInterno: '10002',
    nifNie: 'X1234567L',
    nombre: 'MARIA',
    sexo: '2',
    fechaNacimiento: '19900722',
    tipoContrato: 'Temporal',
    fechaInicioContrato: '20240601',
    fechaFinContrato: '20241231',
  }) && ok;

const pdfPath = process.argv[2];
if (pdfPath && existsSync(pdfPath)) {
  const buf = readFileSync(pdfPath);
  parseWorkerPdf(buf).then(({ normalizedText, workers }) => {
    console.log(`--- ${workers.length} trabajadores ---`);
    console.log(normalizedText.slice(0, 1500));
    console.log(JSON.stringify(workers.slice(0, 3), null, 2));
  });
} else if (!ok) {
  process.exit(1);
} else if (!pdfPath) {
  console.log('Tip: npm run test:worker-pdf -- "ruta/fichas-trabajadores.pdf"');
}

import assert from 'node:assert/strict';
import { buildLlamamientosXml } from '../src/lib/xmlGenerator.js';
import { applySepeXmlFormatRules } from '../src/lib/sepeXmlFormat.js';
import { fillMissingForXml } from '../src/config/mapping.js';
import {
  applySepeXmlFormatRules as clientFormat,
  fillMissingForXml as clientFill,
  buildLlamamientosXml as clientBuild,
  buildXmlFilesFromRecords,
} from '../public/js/xml-build.js';

const record = {
  CCC: '0114610904927',
  NIF_EMPRESA: 'B12345678',
  IDENTIFICADORPFISICA: '48714799V',
  NOMBRE: 'JUAN',
  PRIMER_APELLIDO: 'GARCIA',
  SEGUNDO_APELLIDO: 'LOPEZ',
  SEXO: '1',
  FECHA_NACIMIENTO: '19900101',
  NACIONALIDAD: '724',
  MUNICIPIO_RESIDENCIA: '46250',
  PAIS_RESIDENCIA: '724',
  NUMERO_SEGURIDAD_SOCIAL: '123456789012',
  FECHA_INICIO: '20260214',
  FECHA_FIN: '20260328',
  CLAVE_CONTRATO_TRANS: '300',
  IND_INCORPORA_ACTIVIDAD: 'S',
  CODIGO_OCUPACION: '5120',
  NIVEL_FORMATIVO: '23',
  USOLIBRE_EMPRESA: 'TEST',
};

const serverXml = buildLlamamientosXml([
  fillMissingForXml(applySepeXmlFormatRules(record)),
]);
const clientXml = clientBuild([clientFill(clientFormat(record))]);

assert.match(clientXml, /<IDENTIFICADORPFISICA>D48714799V<\/IDENTIFICADORPFISICA>/);
assert.match(clientXml, /<CODIGO_OCUPACION>5120 {4}<\/CODIGO_OCUPACION>/);
assert.doesNotMatch(clientXml, /<CLAVE_CONTRATO_TRANS>/);
assert.match(serverXml, /<IDENTIFICADORPFISICA>D48714799V<\/IDENTIFICADORPFISICA>/);
assert.doesNotMatch(serverXml, /<CLAVE_CONTRATO_TRANS>/);

const { files } = buildXmlFilesFromRecords(
  Array.from({ length: 31 }, (_, i) => ({
    record: { ...record, FECHA_INICIO: `202601${String(i + 1).padStart(2, '0')}` },
    complete: true,
  })),
  'TEST',
);
assert.equal(files.length, 2);
assert.equal(files[0].count, 30);
assert.equal(files[1].count, 1);

const one = buildXmlFilesFromRecords([{ record, complete: true }], 'TEST', {
  singleFile: true,
});
assert.equal(one.files.length, 1);

console.log('test-client-xml-build: OK');

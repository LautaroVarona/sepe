import assert from 'node:assert/strict';
import {
  formatIdentificadorPfisicaForXml,
  formatCodigoOcupacionForXml,
  isValidClaveContratoTrans,
  sanitizeClaveContratoTrans,
  applySepeXmlFormatRules,
} from '../src/lib/sepeXmlFormat.js';
import { buildLlamamientosXml } from '../src/lib/xmlGenerator.js';

assert.equal(formatIdentificadorPfisicaForXml('48714799V'), 'D48714799V');
assert.equal(formatIdentificadorPfisicaForXml('Z3160179F'), 'EZ3160179F');
assert.equal(formatIdentificadorPfisicaForXml('D23870088K'), 'D23870088K');

assert.equal(formatCodigoOcupacionForXml('5120'), '5120    ');
assert.equal(formatCodigoOcupacionForXml('5120').length, 8);

assert.equal(isValidClaveContratoTrans('300'), false);
assert.equal(isValidClaveContratoTrans('E462022046454500'), true);
assert.equal(sanitizeClaveContratoTrans('300'), '');
assert.equal(sanitizeClaveContratoTrans('E462022046454500'), 'E462022046454500');

const formatted = applySepeXmlFormatRules({
  IDENTIFICADORPFISICA: '48714799V',
  CLAVE_CONTRATO_TRANS: '300',
  CODIGO_OCUPACION: '5120',
});
assert.equal(formatted.IDENTIFICADORPFISICA, 'D48714799V');
assert.equal(formatted.CLAVE_CONTRATO_TRANS, '');
assert.equal(formatted.CODIGO_OCUPACION, '5120    ');

const xml = buildLlamamientosXml([
  {
    CCC: '0114610904927',
    NIF_EMPRESA: 'B12345678',
    ...formatted,
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
    IND_INCORPORA_ACTIVIDAD: 'S',
    NIVEL_FORMATIVO: '23',
    USOLIBRE_EMPRESA: 'TEST',
  },
]);

assert.match(xml, /<IDENTIFICADORPFISICA>D48714799V<\/IDENTIFICADORPFISICA>/);
assert.match(xml, /<CODIGO_OCUPACION>5120 {4}<\/CODIGO_OCUPACION>/);
assert.doesNotMatch(xml, /<CLAVE_CONTRATO_TRANS>/);

console.log('test-sepe-xml-format: OK');

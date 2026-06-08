import {
  normalizeSexo,
  mapNacionalidadToCodigo,
  normalizePaisResidencia,
  normalizeMunicipio,
  normalizeFechaYmd,
  normalizeIndIncorpora,
  normalizeRecordForSepe,
} from '../src/lib/normalizeSepeFields.js';

const cases = [
  { fn: () => normalizeSexo('Hombre'), expected: '1', label: 'sexo Hombre' },
  { fn: () => normalizeSexo('Mujer'), expected: '2', label: 'sexo Mujer' },
  { fn: () => normalizeSexo('H'), expected: '1', label: 'sexo H' },
  { fn: () => normalizeSexo('M'), expected: '2', label: 'sexo M' },
  {
    fn: () => mapNacionalidadToCodigo('ESPAÑA').code,
    expected: '724',
    label: 'nacionalidad ESPAÑA',
  },
  {
    fn: () => mapNacionalidadToCodigo('724').code,
    expected: '724',
    label: 'nacionalidad 724',
  },
  {
    fn: () => normalizePaisResidencia(''),
    expected: '724',
    label: 'pais default 724',
  },
  {
    fn: () => normalizeMunicipio('46250'),
    expected: '46250',
    label: 'municipio 46250',
  },
  {
    fn: () => normalizeFechaYmd('22/05/2005'),
    expected: '20050522',
    label: 'fecha dd/mm/yyyy',
  },
  {
    fn: () => normalizeIndIncorpora(''),
    expected: 'S',
    label: 'ind incorpora default S',
  },
];

let failed = 0;

for (const { fn, expected, label } of cases) {
  const got = fn();
  const ok = got === expected;
  console.log(`${ok ? 'OK' : 'FAIL'} ${label}`);
  if (!ok) {
    console.log(`  got:      ${got}`);
    console.log(`  expected: ${expected}`);
    failed += 1;
  }
}

const { record } = normalizeRecordForSepe({
  SEXO: 'Mujer',
  NACIONALIDAD: 'ESPAÑA',
  PAIS_RESIDENCIA: '',
  MUNICIPIO_RESIDENCIA: '46250',
  FECHA_NACIMIENTO: '2005-05-22',
  IND_INCORPORA_ACTIVIDAD: '',
  NUMERO_SEGURIDAD_SOCIAL: '',
});

const recordOk =
  record.SEXO === '2' &&
  record.NACIONALIDAD === '724' &&
  record.PAIS_RESIDENCIA === '724' &&
  record.MUNICIPIO_RESIDENCIA === '46250' &&
  record.FECHA_NACIMIENTO === '20050522' &&
  record.IND_INCORPORA_ACTIVIDAD === 'S' &&
  record.NUMERO_SEGURIDAD_SOCIAL === '';

console.log(`${recordOk ? 'OK' : 'FAIL'} normalizeRecordForSepe integrado`);
if (!recordOk) {
  console.log('  record:', record);
  failed += 1;
}

process.exit(failed > 0 ? 1 : 0);

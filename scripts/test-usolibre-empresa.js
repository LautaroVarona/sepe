import {
  buildUsoLibreEmpresa,
  enrichRecordForUsoLibre,
} from '../src/lib/buildUsoLibreEmpresa.js';

const samples = [
  {
    label: 'A3 registro 1 (L2606002)',
    record: {
      CODIGO_EMPRESA_A3: '96280',
      A3_WORKER_TOKEN: '019916',
      CODIGO_CONTRATO_CORTO: '300',
      FECHA_INICIO: '20260228',
    },
    expected: 'E96280T019916C300F20260228',
  },
  {
    label: 'A3 registro 2 (L2606002)',
    record: {
      CODIGO_EMPRESA_A3: '96280',
      A3_WORKER_TOKEN: '021106',
      CODIGO_CONTRATO_CORTO: '300',
      FECHA_INICIO: '20260310',
    },
    expected: 'E96280T021106C300F20260310',
  },
];

let failed = 0;

for (const { label, record, expected } of samples) {
  const { value, complete } = buildUsoLibreEmpresa(record);
  const ok = value === expected && complete;
  console.log(`${ok ? 'OK' : 'FAIL'} ${label}`);
  console.log(`  got:      ${value}`);
  if (!ok) {
    console.log(`  expected: ${expected} (complete=${complete})`);
    failed += 1;
  }
}

const fromWorker = enrichRecordForUsoLibre(
  { CLAVE_CONTRATO_TRANS: '300', FECHA_INICIO: '20260310' },
  {
    trabajador: { codigo_interno_a3: '021106' },
    empresa: { codigo_empresa_a3: '96280' },
  },
);
const builtFromWorker = buildUsoLibreEmpresa(fromWorker);
const expectedWorker = 'E96280T021106C300F20260310';
const okWorker =
  builtFromWorker.value === expectedWorker && builtFromWorker.complete;
console.log(`${okWorker ? 'OK' : 'FAIL'} codigo_interno_a3 desde trabajador`);
console.log(`  got:      ${builtFromWorker.value}`);
if (!okWorker) {
  console.log(`  expected: ${expectedWorker}`);
  failed += 1;
}

const missing = buildUsoLibreEmpresa({ FECHA_INICIO: '20260101' });
console.log('\nFaltantes (debe generar valor + warnings, sin lanzar):');
console.log(`  value: ${missing.value}`);
console.log(`  warnings: ${missing.warnings.length}`);
if (!missing.value.startsWith('E') || missing.warnings.length === 0) failed += 1;

process.exit(failed > 0 ? 1 : 0);

import assert from 'node:assert/strict';
import {
  normalizeNieIdentificador,
  fixFechaChronology,
  cleanLlamamientoRecord,
} from '../src/lib/cleanLlamamientoPipeline.js';

assert.equal(normalizeNieIdentificador('0Z3160179F'), 'Z3160179F');
assert.equal(normalizeNieIdentificador('048714799V'), '48714799V');
assert.equal(normalizeNieIdentificador(' 48714799-V '), '48714799V');

const swapped = fixFechaChronology('20260328', '20260214');
assert.equal(swapped.swapped, true);
assert.equal(swapped.FECHA_INICIO, '20260214');
assert.equal(swapped.FECHA_FIN, '20260328');

const ok = fixFechaChronology('20260214', '20260328');
assert.equal(ok.swapped, false);

const { record, warnings } = cleanLlamamientoRecord({
  IDENTIFICADORPFISICA: '0Z3160179F',
  FECHA_INICIO: '20260401',
  FECHA_FIN: '20260201',
});
assert.equal(record.IDENTIFICADORPFISICA, 'Z3160179F');
assert.equal(record.FECHA_INICIO, '20260201');
assert.equal(record.FECHA_FIN, '20260401');
assert.ok(warnings.length >= 2);

console.log('test-clean-llamamiento: OK');
